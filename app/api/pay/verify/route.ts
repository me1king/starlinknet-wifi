import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPaymentSuccess } from '@/lib/payment-processor';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60s for slow router responses

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ success: false, message: "Missing reference" }, { status: 400 });
    }

    // 1. Check local DB first
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: reference }
    });

    if (payment && payment.voucherCode !== 'PENDING') {
      return NextResponse.json({
        success: true,
        voucherCode: payment.voucherCode,
        status: payment.status
      });
    }

    // 2. Fallback: Verify with Paystack directly
    // This handles cases where the webhook is slow
    const secret = (process.env.PAYSTACK_SECRET_KEY || "").replace(/['"]+/g, '').trim();
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { 'Authorization': `Bearer ${secret}` }
    });
    const paystackData = await paystackRes.json();

    if (paystackData.status && paystackData.data.status === 'success') {
        console.log(`[Verify] Paystack confirmed success for ${reference}. Processing now...`);
        const result = await processPaymentSuccess(reference, paystackData.data.amount / 100, paystackData.data.metadata);
        return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, message: "Waiting for payment confirmation..." });

  } catch (error: any) {
    console.error("[Verify] Error:", error.message);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}
