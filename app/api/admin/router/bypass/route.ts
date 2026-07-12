import { NextRequest, NextResponse } from 'next/server';
import { executeRestCommand } from '@/lib/mikrotik';

export async function POST(req: NextRequest) {
  try {
    const { macAddress, siteId, action } = await req.json();

    if (action === 'bypass') {
        // Direct REST command for IP Binding (Captive Portal Bypass)
        // This is high-speed and doesn't touch Supabase
        await executeRestCommand('/ip/hotspot/ip-binding', 'POST', {
            'mac-address': macAddress,
            type: 'bypassed',
            comment: `VIP_BYPASS_${new Date().toLocaleDateString()}`
        }, siteId);

        return NextResponse.json({ success: true, message: "Device now bypassing captive portal" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
