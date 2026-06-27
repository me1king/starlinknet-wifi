import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ success: false, message: "Missing reference" }, { status: 400 });
    }

    // Lookup payment status
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: reference }
    });

    if (payment) {
      // Map API Error Codes to actionable instructions
      let message = "Processing";
      if (payment.status === 'failed') {
        const desc = payment.resultDesc?.toLowerCase() || "";
        if (desc.includes('balance')) message = "❌ Your balance is too low. Please top up your M-Pesa.";
        else if (desc.includes('timeout') || desc.includes('1032')) message = "❌ Request timed out. Did you enter your PIN?";
        else if (desc.includes('cancelled')) message = "❌ You cancelled the transaction.";
        else message = `❌ Payment failed: ${payment.resultDesc || "Unknown error"}`;
      }

      return NextResponse.json({
        success: payment.status === 'active' || payment.voucherCode !== 'PENDING',
        voucherCode: payment.voucherCode,
        provisioned: payment.provisioned,
        status: payment.status,
        message: message
      });
    }

    return NextResponse.json({ success: false, message: "Payment not found yet" });

  } catch (error: any) {
    console.error("[Verify] Error:", error.message);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}
