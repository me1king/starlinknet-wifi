import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WIFI_BILLING_CATALOG } from '@/app/config/packages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  console.log("[Pay] Starting Paystack (M-Pesa) checkout process...");

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request data" }, { status: 400 });

    const { phoneNumber, packageId, email, mac, ip, siteId, linkLogin, linkOrig } = body;

    if (!packageId) {
      return NextResponse.json({ error: "Missing packageId" }, { status: 400 });
    }

    const currentSite = siteId || 'default-site';

    // 1. Resolve Package
    const dbOffer = await prisma.voucherOffer.findUnique({ where: { id: packageId } }).catch(() => null);
    const staticPkg = WIFI_BILLING_CATALOG[packageId];

    const price = dbOffer?.price || staticPkg?.price || 0;
    const name = dbOffer?.name || staticPkg?.name || "WiFi Plan";

    if (price <= 0) return NextResponse.json({ error: "The selected package is unavailable." }, { status: 400 });

    // 2. Initialize Paystack Transaction
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: "Paystack Secret Key is not configured in the cloud environment." }, { status: 500 });
    }

    // Paystack expects amount in Kobo (or cents) but for KES it's usually just the amount * 100
    const amountInMinorUnits = Math.round(price * 100);

    // FORCE PRODUCTION DOMAIN: Prevent redirecting to Vercel
    const productionUrl = 'https://starlinkwifinet.duckdns.org';
    const callbackUrl = new URL(productionUrl);
    if (mac) callbackUrl.searchParams.set('mac', mac);
    if (ip) callbackUrl.searchParams.set('ip', ip);
    if (siteId) callbackUrl.searchParams.set('siteId', siteId);
    if (linkLogin) callbackUrl.searchParams.set('link-login', linkLogin);
    if (linkOrig) callbackUrl.searchParams.set('link-orig', linkOrig);

    // Improved Email Logic: Ensure a valid email is ALWAYS passed to Paystack
    const finalEmail = (email && email.includes('@'))
      ? email
      : `customer_${Math.floor(Math.random() * 1000000)}@starlinknet.wifi`;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: finalEmail,
        amount: amountInMinorUnits,
        currency: "KES",
        metadata: {
          macAddress: mac,
          ipAddress: ip,
          siteId: currentSite,
          packageId,
          phoneNumber
        },
        callback_url: callbackUrl.toString()
      })
    });

    const data = await paystackResponse.json();

    if (!paystackResponse.ok || !data.status) {
      console.error("[Paystack Error]", data);
      return NextResponse.json({ error: data.message || "Failed to initialize Paystack transaction." }, { status: 400 });
    }

    const { authorization_url, reference } = data.data;

    // 3. Store a pending payment record
    try {
      await prisma.payment.create({
        data: {
          transactionRef: reference,
          amount: price,
          phoneNumber: phoneNumber || null,
          voucherCode: 'PENDING',
          offerId: dbOffer ? packageId : null,
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min window
          siteId: currentSite,
          resultDesc: `Paystack initialized for ${name}`
        }
      });
    } catch (dbErr: any) {
      console.error("[Pay] Database Tracking Error:", dbErr.message);
    }

    return NextResponse.json({
      status: "success",
      authorization_url,
      reference
    });

  } catch (error: any) {
    console.error("[Pay] Checkout Crash:", error.message);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}