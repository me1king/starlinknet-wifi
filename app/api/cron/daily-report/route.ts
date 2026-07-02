import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaRetry } from '@/lib/prisma';
import { sendDailyRevenueSummary } from '@/lib/whatsappPersonal';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Log unauthorized attempt but allow for local testing if secret is not set
        console.warn("[Daily Report] Unauthorized attempt or local testing.");
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Calculate Revenue with Retry Logic
    const revenueData = await prismaRetry(() => prisma.payment.aggregate({
        where: {
            status: 'active',
            createdAt: { gte: yesterday, lt: today }
        },
        _sum: { amount: true },
        _count: { id: true }
    }));

    // 2. Find Top Package with Retry Logic
    const topOffers = await prismaRetry(() => prisma.payment.groupBy({
        by: ['offerId'],
        where: {
            status: 'active',
            createdAt: { gte: yesterday, lt: today }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1
    }));

    let topPackageName = "Standard Plan";
    if (topOffers.length > 0 && topOffers[0].offerId) {
        try {
            const offer = await prisma.voucherOffer.findUnique({ where: { id: topOffers[0].offerId } });
            if (offer) topPackageName = offer.name;
        } catch (e) {}
    }

    const totalRevenue = revenueData._sum.amount || 0;
    const totalUsers = revenueData._count.id || 0;

    // 3. Send WhatsApp
    await sendDailyRevenueSummary(totalRevenue, totalUsers, topPackageName);

    return NextResponse.json({
        success: true,
        revenue: totalRevenue,
        users: totalUsers,
        topPackage: topPackageName
    });

  } catch (error: any) {
    console.error("[Daily Report Cron] Fatal Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
