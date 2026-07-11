import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMikrotikVoucher, activateHotspotSession } from '@/lib/mikrotik';
import { sendPersonalAdminAlert, sendVoucherToCustomer } from '@/lib/whatsapp';
import { WIFI_BILLING_CATALOG } from '@/app/config/packages';

export const runtime = 'nodejs';
export const maxDuration = 30;

function generateVoucherCode(length = 6): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => charset.charAt(Math.floor(Math.random() * charset.length))).join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[M-Pesa Callback] 📥 Received Callback:", JSON.stringify(body));

    const callbackData = body.Body?.stkCallback;
    if (!callbackData) {
        console.error("[M-Pesa Callback] Invalid payload structure");
        return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid payload" });
    }

    const checkoutRequestID = callbackData.CheckoutRequestID;
    const resultCode = callbackData.ResultCode;
    const resultDesc = callbackData.ResultDesc;

    // 1. Find the pending payment using the unique CheckoutRequestID
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: checkoutRequestID },
      include: { offer: true }
    });

    if (!payment) {
      console.warn(`[M-Pesa Callback] ⚠️ No record found for CheckoutID: ${checkoutRequestID}`);
      // We still return 0 to Safaricom so they stop retrying
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted but no local record" });
    }

    if (resultCode === 0) {
      // --- PAYMENT SUCCESS ---
      const metadata = callbackData.CallbackMetadata.Item;
      const mpesaReceipt = metadata.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
      const amount = metadata.find((i: any) => i.Name === 'Amount')?.Value;
      const phoneNumber = metadata.find((i: any) => i.Name === 'PhoneNumber')?.Value || payment.phoneNumber;

      console.log(`[M-Pesa Callback] ✅ SUCCESS: ${mpesaReceipt} | KSh ${amount} from ${phoneNumber}`);

      // Generate a clean 6-digit Voucher
      const voucherCode = generateVoucherCode();

      // Resolve Package Details from the Offer linked to the payment
      const durationMin = payment.offer?.durationMin || 60;
      const speedLimit = payment.offer?.speedLimit || "5M/5M";
      const packageName = payment.offer?.name || "WiFi Plan";
      const expiryMode = payment.offer?.expiryMode || "CONTINUOUS";

      const expiresAt = new Date(Date.now() + durationMin * 60 * 1000);

      // 2. Database Update
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'active',
            voucherCode: voucherCode,
            resultDesc: `Success: ${mpesaReceipt}`,
            expiresAt: expiresAt,
            provisioned: false // Will set to true after router sync
          }
        }),
        prisma.voucher.create({
          data: {
            code: voucherCode,
            durationMin,
            price: Number(amount),
            isUsed: true,
            activatedAt: new Date(),
            siteId: payment.siteId
          }
        })
      ]);

      // 3. MikroTik Provisioning (Live Sync with Robustness)
      console.log(`[MikroTik] Provisioning ${voucherCode} on site ${payment.siteId}`);
      let routerResult = { success: false };

      try {
        routerResult = await createMikrotikVoucher(
          voucherCode,
          payment.offerId || '1hr',
          durationMin + 5,
          expiryMode,
          undefined,
          speedLimit,
          payment.offer?.dataLimitMB || undefined,
          undefined, undefined, undefined,
          payment.siteId,
          payment.offer?.maxDevices || 1
        );
      } catch (routerErr: any) {
        console.error(`[MikroTik Failure] Could not push voucher to router: ${routerErr.message}`);
        // NO EMBARRASSMENT: We continue anyway because the voucher is in the DB
        // and sent to customer. Admin can manually sync later or retry.
      }

      // 4. Force immediate session activation if MAC is available
      if (routerResult.success && payment.macAddress) {
        console.log(`[MikroTik] Auto-activating session for MAC: ${payment.macAddress}`);
        await activateHotspotSession(payment.macAddress, payment.ipAddress || '0.0.0.0', voucherCode, payment.siteId).catch(() => {});
      }

      // 4. Update Provisioning Status (Even if it failed, we mark payment active so customer gets voucher)
      await prisma.payment.update({
        where: { id: payment.id },
        data: { provisioned: routerResult.success }
      });

      // 5. WhatsApp Notifications
      try {
        await sendPersonalAdminAlert(Number(amount), String(phoneNumber), voucherCode);
        await sendVoucherToCustomer(String(phoneNumber), voucherCode, packageName, Number(amount));
      } catch (waError) {
        console.error("[WhatsApp] Failed to send alerts:", waError);
      }

      console.log(`[M-Pesa] Processed: ${mpesaReceipt}. Voucher: ${voucherCode}`);
    } else {
      // --- PAYMENT FAILED/CANCELLED ---
      console.log(`[M-Pesa Callback] ❌ FAILED (${resultCode}): ${resultDesc}`);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          resultDesc: resultDesc
        }
      }).catch(() => {});
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (error: any) {
    console.error("[M-Pesa Callback] 🔥 CRITICAL CRASH:", error.message);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Internal Server Error" }, { status: 500 });
  }
}
