import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createMikrotikVoucher, activateHotspotSession } from '@/lib/mikrotik';
import { sendPersonalAdminAlert } from '@/lib/whatsappPersonal';

import { WIFI_BILLING_CATALOG } from '@/app/config/packages';

export const runtime = 'nodejs';
export const maxDuration = 30;

function generateVoucherCode(length = 8): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, I, 1
  return Array.from({ length }, () => charset.charAt(Math.floor(Math.random() * charset.length))).join('');
}

async function processSuccessfulPayment(paymentData: any) {
  try {
    const reference = paymentData.reference;
    const amountInSubunits = paymentData.amount;
    const amount = amountInSubunits / 100;
    const metadata = paymentData.metadata;
    const packageId = metadata?.packageId;
    const siteId = metadata?.siteId || 'default-site';
    const phoneNumber = metadata?.phoneNumber || paymentData.customer?.phone || 'Unknown';
    const macAddress = metadata?.macAddress;
    const ipAddress = metadata?.ipAddress;

    console.log(`[Paystack Webhook] 💰 Processing Success: Ref=${reference}, Amt=${amount}, Pkg=${packageId}, MAC=${macAddress}`);

    if (!packageId) {
      console.error(`[Paystack Webhook] ❌ Missing packageId for Ref: ${reference}. Using fallback '1hr'.`);
    }

    const finalPackageId = packageId || '1hr';

    // 1. Fetch package details
    let dbOffer = await prisma.voucherOffer.findUnique({
      where: { id: finalPackageId }
    }).catch(() => null);

    let durationMin = 60;
    let expiryMode = "CONTINUOUS";
    let speedLimit = "5M/5M";
    let packageName = "Standard Pass";
    let dataLimitMB = 0;

    if (dbOffer) {
      durationMin = dbOffer.durationMin;
      expiryMode = dbOffer.expiryMode;
      speedLimit = dbOffer.speedLimit || "5M/5M";
      packageName = dbOffer.name;
      dataLimitMB = dbOffer.dataLimitMB || 0;
    } else if (WIFI_BILLING_CATALOG[finalPackageId]) {
      const staticPkg = WIFI_BILLING_CATALOG[finalPackageId];
      durationMin = (staticPkg.durationHours || 1) * 60;
      speedLimit = `${staticPkg.speedLimit || '5M'}/${staticPkg.speedLimit || '5M'}`;
      packageName = staticPkg.name;
    }

    let voucherCode = generateVoucherCode();
    const expiresAt = new Date(Date.now() + durationMin * 60 * 1000);

    console.log(`[Paystack Webhook] 🎫 Generated Voucher: ${voucherCode} for ${packageName}`);

    // 1.5 Ensure the site exists to satisfy foreign key constraints
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      console.log(`[Paystack Webhook] Creating missing site during payment: ${siteId}`);
      await prisma.site.create({
        data: {
          id: siteId,
          name: siteId === 'default-site' ? 'Main Operations' : siteId,
          location: 'Auto-Provisioned'
        }
      });
    }

    // 2. Database Operations
    try {
        await prisma.voucher.create({
          data: {
            code: voucherCode,
            durationMin,
            price: Number(amount),
            isUsed: true,
            activatedAt: new Date(),
            siteId: siteId
          },
        });

        await prisma.payment.upsert({
          where: { transactionRef: reference },
          update: {
            status: 'active',
            voucherCode: voucherCode,
            expiresAt: expiresAt,
            resultDesc: `Paystack: ${packageName} (Activated via Webhook)`
          },
          create: {
            transactionRef: reference,
            amount: Number(amount),
            phoneNumber: String(phoneNumber),
            voucherCode: voucherCode,
            offerId: dbOffer ? finalPackageId : null,
            status: 'active',
            expiresAt: expiresAt,
            siteId: siteId,
            resultDesc: `Paystack: ${packageName}`
          }
        });

        await prisma.paymentEvent.create({
          data: {
            externalReference: reference,
            phoneNumber: String(phoneNumber),
            amount: Number(amount),
            status: 'SUCCESS',
            resultDesc: `Voucher ${voucherCode} generated`,
            siteId: siteId
          }
        });
    } catch (dbErr: any) {
        console.error("[Paystack Webhook] ❌ DB Error:", dbErr.message);
    }

    // 3. MikroTik Provisioning
    console.log(`[Paystack Webhook] 🚀 Provisioning on Router: ${voucherCode} (${durationMin}m)`);
    const routerResult = await createMikrotikVoucher(
      voucherCode,
      finalPackageId,
      durationMin + 5,
      expiryMode,
      macAddress,
      speedLimit,
      dataLimitMB || undefined,
      undefined, undefined, undefined,
      siteId,
      dbOffer?.maxDevices || 1
    );

    // 4. Update Provisioning Status
    await prisma.payment.update({
      where: { transactionRef: reference },
      data: {
        provisioned: routerResult.success,
        resultDesc: routerResult.success
          ? `Successfully provisioned ${packageName} (Inc. 5min grace)`
          : `ROUTER_OFFLINE: ${routerResult.error}`
      }
    });

    if (routerResult.success) {
      console.log(`[Paystack Webhook] ✅ Router Sync Success: ${voucherCode}`);
      // Instant Activation
      if (macAddress && ipAddress) {
        console.log(`[Paystack Webhook] ⚡ Auto-logging in user: ${macAddress}`);
        await activateHotspotSession(macAddress, ipAddress, voucherCode, siteId).catch(e => {
            console.warn("[Paystack Webhook] Auto-login failed:", e.message);
        });
      }
    } else {
      console.error(`[Paystack Webhook] ❌ Router Sync FAILED for ${voucherCode}: ${routerResult.error}`);
    }

    // 5. WhatsApp Alert
    try {
      await sendPersonalAdminAlert(Number(amount), String(phoneNumber), voucherCode);
    } catch (waError) {
      console.error("[Paystack Webhook] 📱 WhatsApp Alert failed:", waError);
    }

  } catch (error: any) {
    console.error('[Paystack Webhook] 🔥 Critical process error:', error.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    // Sanitize secret key (remove quotes/spaces)
    const secret = (process.env.PAYSTACK_SECRET_KEY || "").replace(/['"]+/g, '').trim();

    console.log(`[Paystack Webhook] Received event. Signature: ${paystackSignature ? 'Present' : 'MISSING'}`);

    if (!secret || !paystackSignature) {
      console.error('[Paystack Webhook] CRITICAL: Missing secret key or signature header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (hash !== paystackSignature) {
      console.error('[Paystack Webhook] Signature Mismatch! Expected:', hash, 'Received:', paystackSignature);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      processSuccessfulPayment(event.data).catch(err => {
        console.error("[Paystack Webhook] Background task crash:", err);
      });
    } else {
        // Track failed or abandoned payments for analytics
        await prisma.payment.create({
          data: {
            transactionRef: event.data?.reference || 'N/A',
            amount: (event.data?.amount || 0) / 100,
            phoneNumber: event.data?.customer?.phone || 'N/A',
            voucherCode: 'FAILED',
            status: 'failed',
            resultDesc: `Event: ${event.event} - ${event.data?.gateway_response || 'Payment not completed'}`,
            expiresAt: new Date()
          }
        }).catch(() => {});

        await prisma.paymentEvent.create({
            data: {
                externalReference: event.data?.reference || 'N/A',
                status: 'EVENT_' + event.event.toUpperCase(),
                resultDesc: `Event ${event.event} received: ${event.data?.gateway_response || 'N/A'}`
            }
        }).catch(() => {});
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error: any) {
    console.error('[Paystack Webhook] Error:', error.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
  }
}
