import { NextRequest, NextResponse } from 'next/server';
import { getMikrotikResources, getMikrotikActiveSessions } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    // Fetch real-time health data from the router
    const [resources, sessions] = await Promise.all([
      getMikrotikResources(siteId).catch(() => null),
      getMikrotikActiveSessions(siteId).catch(() => [])
    ]);

    const healthData = {
      isOnline: !!resources,
      cpu: resources ? (parseInt(resources['cpu-load']) || 0) : 0,
      memory: resources ? (parseInt(resources['free-memory']) / (1024 * 1024)).toFixed(1) : '0',
      uptime: resources ? resources.uptime : 'offline',
      activeUsers: sessions.length,
      lastCheck: new Date().toISOString(),
      status: resources ? 'Healthy' : 'Unreachable',
      peripherals: [
        { name: 'MikroTik Gateway', ip: '192.168.150.2', alive: !!resources },
        { name: 'Wan Interface', ip: 'ISP', alive: !!resources }
      ]
    };

    return NextResponse.json(healthData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
