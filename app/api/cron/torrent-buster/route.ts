import { NextRequest, NextResponse } from 'next/server';
import { executeRestCommand } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    console.log(`[Torrent Buster] Scanning for high-connection users on ${siteId}...`);

    // 1. Fetch all active connections from the router
    const connections = await executeRestCommand('/ip/firewall/connection', 'GET', undefined, siteId);

    if (!Array.isArray(connections)) {
        return NextResponse.json({ success: true, message: "No active connections found." });
    }

    // 2. Count connections per source IP
    const connCounts: Record<string, number> = {};
    connections.forEach((c: any) => {
        const srcIp = c['src-address']?.split(':')[0]; // Remove port if present
        if (srcIp && srcIp.startsWith('10.5.50.')) { // Only track hotspot users
            connCounts[srcIp] = (connCounts[srcIp] || 0) + 1;
        }
    });

    const offenders = Object.entries(connCounts).filter(([ip, count]) => count > 150);
    let punishedCount = 0;

    // 3. Punish offenders (Put in a Punishment Queue or simple drop rule)
    for (const [ip, count] of offenders) {
        console.log(`[Torrent Buster] Punishing ${ip} for ${count} connections.`);

        // Add to "PUNISHMENT" address list for 30 minutes
        await executeRestCommand('/ip/firewall/address-list', 'POST', {
            list: 'TORRENT_PUNISHMENT',
            address: ip,
            timeout: '00:30:00',
            comment: `Torrent Buster: ${count} connections detected`
        }, siteId).catch(() => {});

        punishedCount++;
    }

    return NextResponse.json({
        success: true,
        punishedCount,
        offenders: offenders.map(([ip, count]) => ({ ip, count })),
        timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[Torrent Buster] Crash:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
