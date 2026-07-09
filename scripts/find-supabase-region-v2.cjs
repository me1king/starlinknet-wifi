const { Client } = require('pg');

const regions = [
  'eu-central-1', 'us-east-1', 'us-west-1', 'ap-southeast-1', 'ap-northeast-1',
  'sa-east-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'me-central-1', 'ap-south-1', 'ap-southeast-2'
];

async function checkRegion(region) {
  const projectRef = 'mkcwwrxwfhjpafiiqvzq';
  const password = 'CKkGLUUiRbPxICLq';
  const host = `aws-0-${region}.pooler.supabase.com`;

  const client = new Client({
    host: host,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 2000
  });

  try {
    await client.connect();
    await client.end();
    return { success: true };
  } catch (err) {
    if (err.message.includes('tenant/user') && err.message.includes('not found')) {
      return { success: false, reason: 'wrong-region' };
    }
    return { success: false, reason: err.message };
  }
}

async function run() {
  console.log("Searching for correct Supabase region for project mkcwwrxwfhjpafiiqvzq...");
  for (const region of regions) {
    process.stdout.write(`Checking ${region}... `);
    const result = await checkRegion(region);
    if (result.success) {
      console.log("✅ FOUND! Project is in " + region);
      break;
    } else {
      console.log(result.reason);
    }
  }
}

run();
