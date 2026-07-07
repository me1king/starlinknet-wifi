import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { referrerVoucher, refereeMac, siteId } = await req.json();

    if (!referrerVoucher || !refereeMac) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const cleanMac = refereeMac.toUpperCase().replace(/[^A-F0-9]/g, "");

    // 1. Verify referrer exists
    const referrer = await prisma.payment.findFirst({
        where: { voucherCode: referrerVoucher }
    });

    if (!referrer) return NextResponse.json({ error: "Invalid referrer" }, { status: 404 });

    // 2. Create pending referral
    await prisma.referral.upsert({
      where: { refereeMac: cleanMac },
      update: { referrerVoucher },
      create: {
        referrerVoucher,
        refereeMac: cleanMac,
        status: 'PENDING',
        rewardMinutes: 30
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
