const { Client } = require('pg');

async function test() {
  const projectRef = 'mkcwwrxwfhjpafiiqvzq';
  const password = 'CKkGLUUiRbPxICLq';
  const region = 'eu-central-1';
  const host = `aws-0-${region}.pooler.supabase.com`;

  console.log(`Attempting auth to ${host} with user postgres.${projectRef}...`);

  const client = new Client({
    host: host,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Success! Authenticated via Pooler.");
    const res = await client.query('SELECT NOW()');
    console.log("DB Time:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("❌ Auth failed!");
    console.error("Error:", err.message);
  }
}

test();
