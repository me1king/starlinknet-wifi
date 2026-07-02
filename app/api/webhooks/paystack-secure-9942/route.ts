import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processPaymentSuccess } from '@/lib/payment-processor';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secret = (process.env.PAYSTACK_SECRET_KEY || "").replace(/['"]+/g, '').trim();

    if (!secret || !signature) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    if (payload.event === 'charge.success') {
      const { reference, amount, metadata } = payload.data;
      await processPaymentSuccess(reference, amount / 100, metadata).catch((err: any) => {
        console.error("[Webhook] Background Error:", err.message);
      });
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('[Webhook Error]', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
