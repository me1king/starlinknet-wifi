const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const isPostgres = process.env.DATABASE_URL.startsWith('postgresql');
    let result;

    if (isPostgres) {
      result = await prisma.$queryRawUnsafe(`
        SELECT column_name as name, data_type as type
        FROM information_schema.columns
        WHERE table_name = 'Payment';
      `);
    } else {
      result = await prisma.$queryRawUnsafe(`PRAGMA table_info(Payment);`);
    }

    console.log("Payment Table Columns:");
    console.table(result.map(r => ({ name: r.name, type: r.type })));
  } catch (error) {
    console.error("Error checking columns:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
