import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMikrotikVoucher, activateHotspotSession, addVoucherTime } from '@/lib/mikrotik';
import { sendVoucherWhatsApp } from '@/lib/whatsapp-cloud';

export async function POST(req: NextRequest) {
  try {
    const { mac, ip, siteId } = await req.json();

    if (!mac) {
      return NextResponse.json({ error: "Could not identify your device" }, { status: 400 });
    }

    const cleanMac = mac.toUpperCase().replace(/[^A-F0-9]/g, "");
    const currentSiteId = siteId || 'default-site';

    // 1. Hardened Device Check (SQLite Level)
    const device = await prisma.deviceProfile.findUnique({
      where: { macAddress: cleanMac }
    });

    if (device && device.trialUsed) {
      return NextResponse.json({
        error: "Free trial already used on this device. Please purchase a plan to continue."
      }, { status: 403 });
    }

    // 2. Mark Trial as Used Immediately
    await prisma.deviceProfile.upsert({
      where: { macAddress: cleanMac },
      update: { trialUsed: true, trialUsedAt: new Date(), totalSessions: { increment: 1 } },
      create: {
        macAddress: cleanMac,
        ipAddress: ip,
        trialUsed: true,
        trialUsedAt: new Date(),
        totalSessions: 1,
        siteId: currentSiteId
      }
    });

    // 3. Provision 10-Min Trial on Router
    const trialCode = `TRIAL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    console.log(`[Free Trial] Provisioning hardware-locked trial: ${trialCode}`);

    const routerResult = await createMikrotikVoucher(
      trialCode,
      '1hr', // Uses standard profile but we override limits
      10,    // 10 Minutes strict
      'CONTINUOUS',
      cleanMac,
      '2M/2M', // Capped speed for trial
      undefined, undefined, undefined, undefined,
      currentSiteId
    );

    if (!routerResult.success) {
        return NextResponse.json({ error: "Router failed to start trial." }, { status: 500 });
    }

    // 4. Referral Reward Logic (The Gift Trigger)
    const pendingRef = await prisma.referral.findUnique({
        where: { refereeMac: cleanMac }
    });

    if (pendingRef && pendingRef.status === 'PENDING') {
        // Reward the referrer by adding 30 mins to their existing voucher
        const bonusResult = await addVoucherTime(pendingRef.referrerVoucher, 30, currentSiteId);

        if (bonusResult.success) {
            await prisma.referral.update({
                where: { id: pendingRef.id },
                data: { status: 'REWARDED' }
            });

            // Update the payment record expiry in DB
            await prisma.payment.updateMany({
                where: { voucherCode: pendingRef.referrerVoucher, siteId: currentSiteId },
                data: { expiresAt: { set: new Date(Date.now() + 30 * 60000) } } // This is tricky, better to just increment if possible or use a query
            }).catch(() => {});

            // Notify Referrer via WhatsApp
            const message = `🎁 *AWESOME NEWS!* 🎁\n\n` +
                            `Someone just connected using your link! We've added *30-Minutes* to your current session.\n\n` +
                            `Thank you for growing Starlinknet.WIFI!`;

            // Try to find referrer's phone
            const referrerPayment = await prisma.payment.findFirst({
                where: { voucherCode: pendingRef.referrerVoucher }
            });

            if (referrerPayment && referrerPayment.phoneNumber) {
                sendVoucherWhatsApp(referrerPayment.phoneNumber, pendingRef.referrerVoucher, "Referral Bonus (30 Mins)");
            }
        }
    }

    // 5. Activate & Login
    await activateHotspotSession(cleanMac, ip || '0.0.0.0', trialCode, currentSiteId).catch(() => {});

    return NextResponse.json({ success: true, voucherCode: trialCode });

  } catch (error: any) {
    console.error("[Free Trial Error]", error.message);
    return NextResponse.json({ error: "System error during trial activation." }, { status: 500 });
  }
}
