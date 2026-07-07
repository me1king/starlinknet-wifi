import { prisma } from './prisma';

/**
 * PRODUCTION WHATSAPP SENDER
 * --------------------------
 * This uses your phone linked via the Railway background worker.
 * It's 100% FREE with no "3-chat" limits.
 */
export async function sendVoucherWhatsApp(phoneNumber: string, voucherCode: string, planName: string) {
  const message = `🎫 *YOUR WIFI VOUCHER* 🎫\n\n` +
                  `Plan: ${planName}\n` +
                  `Code: *${voucherCode}*\n\n` +
                  `Thank you for choosing Starlinknet.WIFI!`;

  try {
    // Talk to the background bridge running on Railway (Internal Port 4000)
    // In production, we use the internal network name or localhost if in the same container
    const res = await fetch('http://localhost:4000/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, message })
    });

    if (res.ok) {
      console.log(`[WhatsApp] Voucher sent to ${phoneNumber}`);
      return { success: true };
    }

    throw new Error('Bridge failed');
  } catch (err: any) {
    console.warn(`[WhatsApp] Cloud send failed: ${err.message}. Retrying via backup...`);
    return { success: false, error: err.message };
  }
}
