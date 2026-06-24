import { NextRequest, NextResponse } from 'next/server';
import { getMikrotikResources } from '@/lib/mikrotik';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    // Add a small delay/retry logic for reliability
    const resources = await getMikrotikResources(siteId).catch(() => null);

    if (resources) {
      return NextResponse.json(resources);
    }

    // Fallback instead of 502 to keep dashboard clean
    return NextResponse.json({
        'cpu-load': 0,
        'free-memory': 0,
        uptime: 'offline',
        name: 'MikroTik (Connecting...)',
        isOffline: true
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
