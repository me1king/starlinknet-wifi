import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendGenericWhatsApp } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const maxDuration = 60; // Marketing broadcasts can take longer

/**
 * POST /api/admin/broadcast
 * Sends a marketing message to all unique customers
 */
export async function POST(req: NextRequest) {
  try {
    const { message, siteId = 'default-site' } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    // 1. Fetch all unique phone numbers from successful payments
    const payments = await prisma.payment.findMany({
      where: {
        siteId,
        status: 'active',
        phoneNumber: {
          not: null,
          notIn: ['Unknown', 'N/A', '', 'undefined']
        }
      },
      select: {
        phoneNumber: true
      },
      distinct: ['phoneNumber']
    });

    if (payments.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No customers found to broadcast to" });
    }

    console.log(`[Broadcast API] Starting broadcast to ${payments.length} customers...`);

    // 2. Iterate and send messages
    let successCount = 0;
    let failCount = 0;

    for (const payment of payments) {
      try {
        const result = await sendGenericWhatsApp(payment.phoneNumber!, message);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      failed: failCount,
      total: payments.length
    });

  } catch (error: any) {
    console.error("[Broadcast API] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
