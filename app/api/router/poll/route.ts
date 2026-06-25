import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMikrotikResources, getMikrotikTraffic } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId') || 'default-site';

  try {
    // 1. Log System Heartbeat
    const resources = await getMikrotikResources(siteId);
    if (resources) {
        // Log CPU and uptime to admin alerts for monitoring
        if (parseInt(resources['cpu-load']) > 90) {
            await prisma.adminAlert.create({
                data: {
                    siteId,
                    type: 'HIGH_USAGE',
                    severity: 'HIGH',
                    title: 'Router CPU Stress',
                    message: `Router at ${siteId} is under heavy load (${resources['cpu-load']}%).`
                }
            });
        }
    }

    // 2. Fetch Live Traffic
    const traffic = await getMikrotikTraffic(siteId, 'ether1');

    return NextResponse.json({
      success: true,
      resources,
      traffic,
      timestamp: new Date()
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
