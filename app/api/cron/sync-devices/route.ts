import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMikrotikActiveSessions } from '@/lib/mikrotik';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Security check: Ensure only authorized scripts can hit this route
  const authHeader = req.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET || 'starlinknet_wifi_super_secret_cron_123'}`;

  if (authHeader !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    console.log(`[Sync] Starting device synchronization for site: ${siteId}`);

    // 1. Get current active sessions from MikroTik
    const routerSessions = await getMikrotikActiveSessions(siteId);
    const activeMacs = new Set(routerSessions.map((s: any) => s['mac-address']));

    console.log(`[Sync] Router reports ${activeMacs.size} active devices.`);

    // 2. Fetch what we think is active in our DB
    const dbActiveConnections = await prisma.deviceConnection.findMany({
      where: {
        siteId,
        status: 'CONNECTED',
        disconnectedAt: null,
      }
    });

    const dbActiveMacs = dbActiveConnections.map(c => c.macAddress);
    const macsToDisconnect = dbActiveMacs.filter(mac => !activeMacs.has(mac));

    console.log(`[Sync] Found ${macsToDisconnect.length} devices to mark as DISCONNECTED.`);

    // 3. Update DB: Mark missing devices as DISCONNECTED
    if (macsToDisconnect.length > 0) {
      await prisma.deviceConnection.updateMany({
        where: {
          macAddress: { in: macsToDisconnect },
          status: 'CONNECTED',
          disconnectedAt: null,
          siteId
        },
        data: {
          status: 'DISCONNECTED',
          disconnectedAt: new Date(),
        }
      });
    }

    // 4. Update/Create DB records for current active router sessions
    for (const session of routerSessions) {
      const mac = session['mac-address'];
      const ip = session.address;
      const user = session.user;
      const deviceName = session.user || 'Unknown Device';

      const existing = await prisma.deviceConnection.findFirst({
        where: {
          macAddress: mac,
          status: 'CONNECTED',
          disconnectedAt: null,
          siteId
        }
      });

      if (existing) {
        // Just update IP or other details if they changed
        if (existing.ipAddress !== ip || existing.voucherCode !== user) {
          await prisma.deviceConnection.update({
            where: { id: existing.id },
            data: { ipAddress: ip, voucherCode: user }
          });
        }
      } else {
        // Create new active connection log
        await prisma.deviceConnection.create({
          data: {
            macAddress: mac,
            ipAddress: ip,
            deviceName,
            voucherCode: user,
            status: 'CONNECTED',
            siteId
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      routerActiveCount: activeMacs.size,
      disconnectedCount: macsToDisconnect.length,
      message: `Synchronized ${activeMacs.size} devices, disconnected ${macsToDisconnect.length}.`
    });

  } catch (error: any) {
    console.error("[Sync] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
