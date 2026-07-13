import { NextRequest, NextResponse } from 'next/server';
import { executeRestCommand } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    console.log(`[Rogue Sniper] Scanning MikroTik logs for imposters on ${siteId}...`);

    // 1. Fetch only DHCP warnings from the router log
    const logs = await executeRestCommand('/log', 'GET', undefined, siteId);

    if (!Array.isArray(logs)) {
        return NextResponse.json({ success: true, message: "No logs found." });
    }

    // 2. Filter for the exact rogue warning message
    // Log looks like: "rogue dhcp server detected on bridge by MAC 00:11:22:33:44:55"
    const rogueLogs = logs.filter((log: any) =>
      log.topics?.includes('dhcp') &&
      log.topics?.includes('warning') &&
      log.message.toLowerCase().includes('rogue dhcp server')
    );

    let neutralizedCount = 0;
    const targets: string[] = [];

    for (const log of rogueLogs) {
      // 3. Extract the MAC address using regex
      const macMatch = log.message.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);

      if (macMatch) {
        const rogueMac = macMatch[0];
        targets.push(rogueMac);

        console.log(`🚨 ROGUE DETECTED: Isolating MAC ${rogueMac}`);

        // 4. Hit the MikroTik Bridge Filter API to instantly drop all traffic from this MAC
        // We use the /interface/bridge/filter path
        await executeRestCommand('/interface/bridge/filter', 'PUT', {
            chain: 'forward',
            'src-mac-address': rogueMac,
            action: 'drop',
            comment: `AUTO-SNIPER: Rogue DHCP detected - ${new Date().toISOString()}`
        }, siteId).catch(err => {
            console.error(`[Rogue Sniper] Failed to isolate ${rogueMac}:`, err.message);
        });

        neutralizedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      neutralizedCount,
      neutralizedMacs: targets,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[Rogue Sniper] Critical Failure:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
