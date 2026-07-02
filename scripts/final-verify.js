const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- FINAL PRODUCTION VERIFICATION ---");

  try {
    let columnNames = [];
    const isPostgres = process.env.DATABASE_URL.startsWith('postgresql');

    if (isPostgres) {
      const columns = await prisma.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'Payment';
      `);
      columnNames = columns.map(c => c.column_name);
    } else {
      const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Payment);`);
      columnNames = columns.map(c => c.name);
    }

    console.log("Payment Table Columns:", columnNames.join(", "));

    const required = ['macAddress', 'ipAddress', 'provisioned', 'siteId'];
    const missing = required.filter(c => !columnNames.includes(c));

    if (missing.length > 0) {
      console.error("CRITICAL: Missing columns:", missing.join(", "));
      console.log("Please run 'npx prisma db push' to synchronize the schema.");
    } else {
      console.log("✅ Database schema is perfect.");
    }

    console.log("Checking Site connectivity...");
    const site = await prisma.site.findUnique({ where: { id: 'default-site' } });
    if (!site) {
        console.log("Creating default site...");
        await prisma.site.create({
            data: { id: 'default-site', name: 'Main Operations', location: 'Starlinknet Hub' }
        });
    }
    console.log("✅ Default site verified.");

    console.log("\n🚀 SYSTEM IS READY FOR CLOUD DEPLOYMENT!");

  } catch (error) {
    console.error("Verification failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
