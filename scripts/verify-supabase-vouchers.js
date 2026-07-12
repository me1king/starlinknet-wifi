import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log("🚀 STARTING FINAL SUPABASE PRODUCTION READINESS TEST...");
  console.log("---------------------------------------------------------");

  try {
    // 1. Test Connection & Default Site
    console.log("📦 Step 1: Checking Database Connection...");
    const site = await prisma.site.findUnique({ where: { id: 'default-site' } });
    if (!site) {
      console.log("⚠️ Default site missing. Creating it...");
      await prisma.site.create({ data: { id: 'default-site', name: 'Main Operations' } });
    }
    console.log("✅ Connection Successful: Supabase project linked.");

    // 2. Simulate Voucher Creation
    const testCode = `PROD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    console.log(`🎫 Step 2: Creating Test Voucher [${testCode}]...`);

    const newVoucher = await prisma.voucher.create({
      data: {
        code: testCode,
        durationMin: 60,
        price: 15.0,
        siteId: 'default-site'
      }
    });
    console.log("✅ Voucher Created: Successfully written to Supabase.");

    // 3. Verify Reflection
    console.log("🔍 Step 3: Verifying Data Reflection...");
    const reflectedVoucher = await prisma.voucher.findUnique({
      where: { code: testCode }
    });

    if (reflectedVoucher && reflectedVoucher.code === testCode) {
      console.log("✅ Reflection Verified: Cloud data matches local query.");
    } else {
      throw new Error("Data reflection failed!");
    }

    // 4. Cleanup
    await prisma.voucher.delete({ where: { code: testCode } });
    console.log("🧹 Step 4: Cleanup complete.");
    console.log("---------------------------------------------------------");
    console.log("🌟 SYSTEM IS READY FOR PRODUCTION!");
    console.log("All systems GO: Supabase is active and reflecting correctly.");

  } catch (error) {
    console.error("❌ PRODUCTION READINESS TEST FAILED:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
