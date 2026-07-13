import { NextRequest, NextResponse } from 'next/server';
import { executeRestCommand } from '@/lib/mikrotik';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

export const dynamic = 'force-dynamic';

const DOMAINS_TO_WATCH = [
    'api.paystack.co',
    'checkout.paystack.com',
    'starlinkwifinet.duckdns.org',
    'google.com'
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    console.log(`[Walled Garden Healer] Synchronizing IP addresses for ${siteId}...`);

    let totalAdded = 0;

    for (const domain of DOMAINS_TO_WATCH) {
        try {
            const ips = await resolve4(domain);

            for (const ip of ips) {
                // Add to Walled Garden IP List
                // We use PUT (REST) or check if exists before POST
                await executeRestCommand('/ip/hotspot/walled-garden/ip', 'POST', {
                    'dst-address': ip,
                    'action': 'accept',
                    'comment': `AUTO_HEALER_${domain}`
                }, siteId).catch(() => {
                    // Ignore errors if IP already exists
                });
                totalAdded++;
            }
        } catch (e: any) {
            console.warn(`[Walled Garden Healer] Could not resolve ${domain}: ${e.message}`);
        }
    }

    return NextResponse.json({
        success: true,
        domainsChecked: DOMAINS_TO_WATCH.length,
        ipsSynced: totalAdded,
        timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
