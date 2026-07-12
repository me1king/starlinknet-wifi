import { NextRequest, NextResponse } from 'next/server';
import { executeRestCommand } from '@/lib/mikrotik';

export async function POST(req: NextRequest) {
  try {
    const { siteId, enabled } = await req.json();

    // ADGUARD DNS for Network-Wide Ad Blocking
    const dnsServers = enabled
        ? "94.140.14.14,94.140.15.15" // AdGuard DNS
        : "1.1.1.1,8.8.8.8";        // Default Cloudflare/Google

    await executeRestCommand('/ip/dns', 'PATCH', {
        'servers': dnsServers,
        'allow-remote-requests': 'yes'
    }, siteId);

    // Flush cache to take effect immediately
    await executeRestCommand('/ip/dns/cache/flush', 'POST', {}, siteId);

    return NextResponse.json({
        success: true,
        message: enabled ? "Ad-Blocking Enabled (AdGuard DNS)" : "Standard DNS Restored"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
