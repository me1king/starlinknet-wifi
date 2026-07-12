import { NextRequest, NextResponse } from 'next/server';
import { getMikrotikResources } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    // 1. Try to fetch LIVE data directly from the MikroTik (Direct Tunnel Mode)
    try {
        const liveData = await getMikrotikResources(siteId);
        if (liveData) {
            return NextResponse.json({
                'cpu-load': liveData['cpu-load'] || 0,
                'free-memory': liveData['free-memory'] || 0,
                uptime: liveData.uptime || '0s',
                name: liveData.name || 'MikroTik',
                boardName: liveData['board-name'] || 'RouterBoard',
                version: liveData.version || '7.x',
                model: liveData.model || 'Unknown',
                isOnline: true
            });
        }
    } catch (directErr) {
        console.warn(`[System Info] Direct pull failed for ${siteId}, falling back to heartbeats.`);
    }

    // 2. Fallback to "pushed" heartbeat data (Laptop Bridge Mode)
    const heartbeats = (global as any).routerHeartbeats || {};
    const siteData = heartbeats[siteId];

    if (siteData) {
      const lastSeen = new Date(siteData.lastSeen).getTime();
      const now = Date.now();

      if (now - lastSeen < 60000) {
          return NextResponse.json({
              'cpu-load': siteData['cpu-load'] || 0,
              'free-memory': siteData['free-memory'] || 0,
              uptime: siteData.uptime || '0s',
              name: 'MikroTik (Cloud Pushed)',
              boardName: siteData['board-name'] || 'RouterBoard',
              version: siteData.version || '7.x',
              isOnline: true
          });
      }
    }

    return NextResponse.json({
        'cpu-load': 0,
        'free-memory': 0,
        uptime: 'offline',
        name: 'MikroTik (Offline)',
        isOffline: true,
        isOnline: false
    });
  } catch (error: any) {
    console.error("[System Info API] Crash:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
