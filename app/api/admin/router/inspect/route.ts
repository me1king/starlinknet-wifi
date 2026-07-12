import { NextRequest, NextResponse } from 'next/server';
import { getMikrotikActiveSessions, pingDeviceFromRouter } from '@/lib/mikrotik';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';
    const voucherCode = searchParams.get('voucherCode');
    const macAddress = searchParams.get('macAddress');

    const active = await getMikrotikActiveSessions(siteId);
    const session = active.find((s: any) =>
        (voucherCode && s.user === voucherCode) ||
        (macAddress && s.macAddress === macAddress)
    );

    if (!session) {
      return NextResponse.json({ error: "User not currently active on router" }, { status: 404 });
    }

    // Live Ping from Router to Device
    const pingResult = await pingDeviceFromRouter(session.address, siteId);

    return NextResponse.json({
        ...session,
        ping: pingResult,
        timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
