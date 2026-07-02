import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVoucherToCustomer } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    // Find the payment
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: reference },
      include: { offer: true }
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    if (!payment.phoneNumber || payment.phoneNumber === 'Unknown' || payment.phoneNumber === 'N/A') {
      return NextResponse.json({ error: "No valid phone number associated with this payment" }, { status: 400 });
    }

    if (!payment.voucherCode || payment.voucherCode === 'FAILED') {
        return NextResponse.json({ error: "No voucher code available to resend" }, { status: 400 });
    }

    const packageName = payment.offer?.name || "Standard Pass";
    const amount = payment.amount;

    console.log(`[Resend API] Resending voucher ${payment.voucherCode} to ${payment.phoneNumber}`);

    // Trigger WhatsApp Resend
    await sendVoucherToCustomer(
        payment.phoneNumber,
        payment.voucherCode,
        packageName,
        amount
    );

    return NextResponse.json({ success: true, message: "Voucher resent via WhatsApp" });

  } catch (error: any) {
    console.error("[Resend API] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
