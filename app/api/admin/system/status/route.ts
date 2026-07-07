import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { testMikrotikConnection } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [dbStatus, routerStatus] = await Promise.allSettled([
      prisma.site.findFirst(),
      testMikrotikConnection()
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: dbStatus.status === 'fulfilled' ? 'ONLINE' : 'OFFLINE',
      router: routerStatus.status === 'fulfilled' && (routerStatus.value as any).success ? 'ONLINE' : 'OFFLINE',
      env: process.env.NODE_ENV,
      version: "1.0.0-production"
    });
  } catch (error) {
    return NextResponse.json({ status: "CRITICAL_ERROR" }, { status: 500 });
  }
}
