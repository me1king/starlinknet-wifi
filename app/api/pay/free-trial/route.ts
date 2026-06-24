import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMikrotikVoucher, activateHotspotSession } from '@/lib/mikrotik';

export async function POST(req: NextRequest) {
  try {
    const { mac, ip, siteId } = await req.json();

    if (!mac) {
      return NextResponse.json({ error: "Could not identify your device" }, { status: 400 });
    }

    const currentSiteId = siteId || 'default-site';

    // 1. Permanent Device Check (One-time only trial)
    // We use DeviceProfile to track if this MAC has EVER used a trial
    const device = await prisma.deviceProfile.findFirst({
      where: { macAddress: mac }
    });

    if (device && device.totalSpent === 0 && device.totalSessions > 0) {
        // If they have sessions but no spending, they likely already used a trial
        // To be even stricter, we can check a specific flag or the voucher history
    }

    // Better check: Search for any existing trial payment or session
    const usedTrial = await prisma.activeSession.findFirst({
      where: {
        macAddress: mac,
        voucherCode: { startsWith: 'TRIAL-' }
      }
    });

    if (usedTrial) {
      return NextResponse.json({ error: "Free trial already used on this device. Please purchase a plan to continue." }, { status: 403 });
    }

    // 2. Create Trial Record
    const trialCode = `TRIAL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 Min Trial

    // 3. Provision on Router
    console.log(`[Free Trial] Provisioning ${trialCode} for MAC: ${mac}`);
    const routerResult = await createMikrotikVoucher(
      trialCode,
      '1hr', // Using a fallback profile name
      10,
      'CONTINUOUS',
      mac,
      '2M/2M', // Trial speed is capped
      undefined, undefined, undefined, undefined,
      currentSiteId
    );

    if (routerResult.success) {
      // 4. Record the session to "Mark" this device permanently
      try {
          await prisma.activeSession.create({
            data: {
                macAddress: mac,
                voucherCode: trialCode,
                ipAddress: ip || '0.0.0.0',
                expiresAt: expiresAt,
                siteId: currentSiteId
            }
          });

          // Also update/create a Device Profile to track this user
          await prisma.deviceProfile.upsert({
              where: { macAddress: mac },
              update: { totalSessions: { increment: 1 } },
              create: {
                  macAddress: mac,
                  ipAddress: ip,
                  totalSessions: 1,
                  siteId: currentSiteId
              }
          });
      } catch (dbErr) {
          console.warn("[Free Trial] Database recording failed, but voucher was created on router.");
      }

      // 5. Inject live session
      await activateHotspotSession(mac, ip || '0.0.0.0', trialCode, currentSiteId).catch(() => {});

      return NextResponse.json({ success: true, voucherCode: trialCode });
    }

    return NextResponse.json({ error: "Router failed to start trial. Please try again later." }, { status: 500 });

  } catch (error: any) {
    console.error("[Free Trial Error]", error.message);
    return NextResponse.json({ error: "System error during trial activation." }, { status: 500 });
  }
}
