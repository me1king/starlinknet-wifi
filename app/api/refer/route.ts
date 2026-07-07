import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMikrotikVoucher } from '@/lib/mikrotik';
import { sendVoucherWhatsApp } from '@/lib/whatsapp-cloud';

export async function POST(req: NextRequest) {
  try {
    const { referrerVoucher, referredPhone } = await req.json();

    if (!referrerVoucher || !referredPhone) {
      return NextResponse.json({ error: "Missing information" }, { status: 400 });
    }

    // 1. Check if the referrer exists and is active
    const payment = await prisma.payment.findFirst({
      where: { voucherCode: referrerVoucher, status: 'active' }
    });

    if (!payment) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    // 2. Create a Gift Voucher for the friend
    const giftCode = `GIFT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const giftResult = await createMikrotikVoucher(
      giftCode,
      '1hr', // Profile
      30,    // 30 Mins
      'CONTINUOUS',
      undefined, // No MAC lock yet
      '5M/5M',
      undefined, undefined, undefined, undefined,
      payment.siteId
    );

    if (!giftResult.success) {
      return NextResponse.json({ error: "Failed to create gift voucher" }, { status: 500 });
    }

    // 3. Log the referral
    await prisma.referral.create({
      data: {
        referrerVoucher,
        refereeMac: 'GIFT-' + giftCode,
        rewardMinutes: 30,
        status: 'REWARDED'
      }
    });

    // 4. Notify the friend via Official Linked Phone (FREE Mode)
    sendVoucherWhatsApp(referredPhone, giftCode, "Gift Voucher (30 Mins)");

    return NextResponse.json({ success: true, message: "Gift Sent! Your friend will receive a 30-min voucher code." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
