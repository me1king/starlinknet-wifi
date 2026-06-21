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

    if (!packageId) {
      throw new Error(`Missing packageId in metadata for reference: ${reference}`);
    }

    // 1. Fetch package details (with fallback to static catalog)
    let dbOffer = await prisma.voucherOffer.findUnique({
      where: { id: packageId }
    });

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
    } else if (WIFI_BILLING_CATALOG[packageId]) {
      const staticPkg = WIFI_BILLING_CATALOG[packageId];
      durationMin = staticPkg.durationHours * 60;
      speedLimit = `${staticPkg.speedLimit}/${staticPkg.speedLimit}`;
      packageName = staticPkg.name;
    }

    let voucherCode = generateVoucherCode();
    const expiresAt = new Date(Date.now() + durationMin * 60 * 1000);

    // 2. Database Operations - Upsert payment to handle pre-created records
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
        offerId: dbOffer ? packageId : null,
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

    // 3. MikroTik Provisioning
    const routerResult = await createMikrotikVoucher(
      voucherCode,
      packageId,
      durationMin + 3,
      expiryMode,
      macAddress,
      speedLimit,
      dataLimitMB,
      undefined, undefined, undefined,
      siteId
    );

    // 4. Update Provisioning Status
    await prisma.payment.update({
      where: { transactionRef: reference },
      data: {
        provisioned: routerResult.success,
        resultDesc: routerResult.success
          ? `Successfully provisioned ${packageName} (Inc. 3min grace)`
          : `ROUTER_OFFLINE: ${routerResult.error}`
      }
    });

    if (!routerResult.success) {
      console.error(`[Paystack] !!! CRITICAL: Payment received but Router is OFFLINE for ${voucherCode}`);
      // Send Emergency WhatsApp Alert
      try {
        await sendPersonalAdminAlert(0, "SYSTEM_ALERT", `CRITICAL: Router is OFFLINE. Payment ${reference} received but user ${voucherCode} was NOT provisioned.`);
      } catch (e) {}
    }

    // 5. Instant Internet Activation (If possible)
    if (routerResult.success && macAddress && ipAddress) {
      console.log(`[Paystack] Attempting instant activation for MAC: ${macAddress}, IP: ${ipAddress}`);
      const activationResult = await activateHotspotSession(macAddress, ipAddress, voucherCode);
      if (!activationResult.success) {
        console.warn(`[Paystack] Instant activation failed: ${activationResult.message}`);
      } else {
        console.log(`[Paystack] ✓ Instant activation successful for ${macAddress}`);
      }
    }

    // 4. WhatsApp Alert
    try {
      await sendPersonalAdminAlert(Number(amount), String(phoneNumber), voucherCode);
    } catch (waError) {
      console.error("[Paystack] WhatsApp Alert failed:", waError);
    }

    console.log(`[Paystack] ✓ Fully processed payment reference: ${reference}`);
  } catch (error: any) {
    console.error('[Paystack] Error processing successful payment:', error.message);
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
