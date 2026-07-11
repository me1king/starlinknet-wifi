import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- DATABASE REFLECTION TEST ---");

    // 1. Create a unique test package
    const testName = `Test Offer - ${Date.now()}`;
    console.log(`Creating package: ${testName}`);

    try {
        const newOffer = await prisma.voucherOffer.create({
            data: {
                id: `test-${Date.now()}`,
                name: testName,
                duration: "1 Hour",
                durationMin: 60,
                price: 99.0,
                siteId: 'default-site',
                expiryMode: 'CONTINUOUS',
                downloadLimit: '5M',
                uploadLimit: '5M',
                speedLimit: '5M/5M'
            }
        });

        console.log("✅ Success: Package added to Cloud Database!");
        console.log(`Package ID: ${newOffer.id}`);

        // 2. Fetch all packages to confirm reflection
        const allOffers = await prisma.voucherOffer.findMany({
            where: { siteId: 'default-site' },
            orderBy: { createdAt: 'desc' }
        });

        const found = allOffers.find(o => o.name === testName);
        if (found) {
            console.log("✅ Confirmation: New package reflected in query results!");
            console.log(`Total packages in DB: ${allOffers.length}`);
        } else {
            console.log("❌ Error: Package created but not found in reflection query.");
        }

        // 3. Cleanup (Optional - remove the test package)
        await prisma.voucherOffer.delete({ where: { id: newOffer.id } });
        console.log("🧹 Cleanup: Test package removed.");

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
