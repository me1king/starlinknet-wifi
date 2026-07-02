import { prisma } from './prisma';
import { createMikrotikVoucher, activateHotspotSession } from './mikrotik';
import { sendVoucherToCustomer } from './whatsapp';
import { WIFI_BILLING_CATALOG } from '@/app/config/packages';

function generateVoucherCode(length = 8): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => charset.charAt(Math.floor(Math.random() * charset.length))).join('');
}

export async function processPaymentSuccess(reference: string, amount: number, metadata: any) {
  try {
    // 1. Check if already processed to prevent duplicates
    const existing = await prisma.payment.findUnique({
      where: { transactionRef: reference }
    });

    if (existing && existing.voucherCode !== 'PENDING') {
      return { success: true, voucherCode: existing.voucherCode };
    }

    const packageId = metadata?.packageId || '1hr';
    const siteId = metadata?.siteId || 'default-site';
    const macAddress = metadata?.macAddress;
    const ipAddress = metadata?.ipAddress;
    const phoneNumber = metadata?.phoneNumber || 'Unknown';

    // 2. Resolve Package Details
    let dbOffer = await prisma.voucherOffer.findUnique({ where: { id: packageId } }).catch(() => null);
    let durationMin = 60;
    let expiryMode = "CONTINUOUS";
    let speedLimit = "5M/5M";
    let packageName = "Standard Pass";

    if (dbOffer) {
      durationMin = dbOffer.durationMin;
      expiryMode = dbOffer.expiryMode;
      speedLimit = dbOffer.speedLimit || "5M/5M";
      packageName = dbOffer.name;
    } else if (WIFI_BILLING_CATALOG[packageId]) {
      const staticPkg = WIFI_BILLING_CATALOG[packageId];
      durationMin = (staticPkg.durationHours || 1) * 60;
      speedLimit = `${staticPkg.speedLimit || '5M'}/${staticPkg.speedLimit || '5M'}`;
      packageName = staticPkg.name;
    }

    // 3. Generate Voucher
    const voucherCode = generateVoucherCode();
    const expiresAt = new Date(Date.now() + durationMin * 60 * 1000);

    // 4. Update Database
    await prisma.$transaction([
      prisma.voucher.create({
        data: {
          code: voucherCode,
          durationMin,
          price: amount,
          isUsed: true,
          activatedAt: new Date(),
          siteId: siteId
        }
      }),
      prisma.payment.upsert({
        where: { transactionRef: reference },
        update: {
          status: 'active',
          voucherCode: voucherCode,
          expiresAt: expiresAt,
          phoneNumber: String(phoneNumber),
          resultDesc: `Activated: ${packageName}`
        },
        create: {
          transactionRef: reference,
          amount: amount,
          phoneNumber: String(phoneNumber),
          voucherCode: voucherCode,
          offerId: dbOffer ? packageId : null,
          status: 'active',
          expiresAt: expiresAt,
          siteId: siteId,
          resultDesc: `Activated: ${packageName}`
        }
      })
    ]);

    // 5. Provision on Router
    console.log(`[Processor] Provisioning ${voucherCode} on Router...`);
    const routerResult = await createMikrotikVoucher(
      voucherCode,
      packageId,
      durationMin + 5,
      expiryMode,
      macAddress,
      speedLimit,
      undefined, undefined, undefined, undefined,
      siteId,
      dbOffer?.maxDevices || 1
    );

    // 6. Final Status & Notifications
    if (routerResult.success && macAddress && ipAddress) {
      await activateHotspotSession(macAddress, ipAddress, voucherCode, siteId).catch(() => {});
    }

    // WhatsApp Message via Green API
    sendVoucherToCustomer(String(phoneNumber), voucherCode, packageName, amount).catch(() => {});

    return { success: true, voucherCode };
  } catch (error: any) {
    console.error("[Processor] Fatal Error:", error.message);
    throw error;
  }
}
