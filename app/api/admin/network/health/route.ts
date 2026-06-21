import { NextRequest, NextResponse } from 'next/server';
import { getMikrotikInterfaces, pingDeviceFromRouter } from '@/lib/mikrotik';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    // 1. Get live interfaces to find the real WAN Gateway
    const interfaces = await getMikrotikInterfaces(siteId).catch(() => []);

    // 2. Peripheral devices to monitor
    // We detected your gateway is on the 192.168.150.x subnet
    const peripherals = [
      { name: 'Fiber Gateway', ip: '192.168.150.1' }, // YOUR REAL GATEWAY
      { name: 'Core Switch', ip: '192.168.88.2' },
      { name: 'Access Point East', ip: '192.168.88.10' }
    ];

    const pingResults = await Promise.all(
      peripherals.map(async (p) => {
        try {
          const result = await pingDeviceFromRouter(p.ip, siteId);
          return { ...p, ...result };
        } catch (e) {
          return { ...p, alive: false };
        }
      })
    );

    // Filter to show only one Fiber Gateway in the UI (whichever is alive)
    const activeGateway = pingResults.find(r => r.name.includes('Fiber') && r.alive) || pingResults[0];
    const otherPeripherals = pingResults.filter(r => !r.name.includes('Fiber'));

    const finalPeripherals = [activeGateway, ...otherPeripherals];

    const wanInterface = interfaces.find(i =>
      i.name.toLowerCase().includes('ether1') ||
      i.name.toLowerCase().includes('wan')
    );

    return NextResponse.json({
      wanStats: wanInterface ? {
        name: wanInterface.name,
        rxRate: wanInterface['rx-bits-per-second'] || "0",
        txRate: wanInterface['tx-bits-per-second'] || "0"
      } : null,
      peripherals: finalPeripherals
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}