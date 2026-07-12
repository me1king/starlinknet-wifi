import { NextRequest, NextResponse } from 'next/server';
import { executeRestCommand } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    // Fetch the last 50 log entries from the router
    const logs = await executeRestCommand('/log', 'GET', undefined, siteId);

    // Format logs for easier frontend reading
    const formattedLogs = Array.isArray(logs) ? logs.slice(-50).map((l: any) => ({
        id: l['.id'],
        time: l.time,
        topics: l.topics,
        message: l.message
    })) : [];

    return NextResponse.json(formattedLogs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
