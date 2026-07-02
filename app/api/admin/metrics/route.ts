import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';

    // 1. Calculate Total Revenue
    let totalRevenue = 0;
    try {
       const revenueSum = await prismaRetry(() => prisma.payment.aggregate({
        _sum: { amount: true },
        where: { siteId, status: 'active' }
      })) as any;
      totalRevenue = revenueSum?._sum?.amount || 0;
    } catch (e: any) {
      console.error("[Metrics] Revenue Aggregate Error:", e.message);
    }

    // 2. Fetch Active Tickets/Sessions
    let activeTickets: any[] = [];
    try {
      activeTickets = await prismaRetry(() => prisma.activeSession.findMany({
        where: {
          siteId,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }));
    } catch (e: any) {
      console.error("[Metrics] Active Sessions Error:", e.message);
    }

    // 3. Fetch Recent Payments
    let recentPayments: any[] = [];
    try {
      recentPayments = await prismaRetry(() => prisma.payment.findMany({
        where: { siteId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }));
    } catch (e: any) {
      console.error("[Metrics] Recent Payments Error:", e.message);
    }

    return NextResponse.json({
      totalRevenue,
      activeTickets,
      recentPayments
    });

  } catch (error: any) {
    console.error("Critical Metrics API Error:", error.message);
    return NextResponse.json({
        totalRevenue: 0,
        activeTickets: [],
        recentPayments: [],
        error: "Database link interrupted. Please run 'npx prisma db push'."
    });
  }
}
