import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processPaymentSuccess } from '@/lib/payment-processor';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    // 1. Validate signature and secret
    const secret = (process.env.PAYSTACK_SECRET_KEY || "").replace(/['"]+/g, '').trim();

    if (!secret || !paystackSignature) {
      console.error('[Webhook] Missing secret or signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    if (hash !== paystackSignature) {
      console.error('[Webhook] Signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      await processPaymentSuccess(
          event.data.reference,
          event.data.amount / 100,
          event.data.metadata
      ).catch(err => console.error("[Webhook] Background Error:", err.message));
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error: any) {
    console.error('[Webhook] Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
