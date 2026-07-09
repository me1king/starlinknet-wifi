const { Client } = require('pg');

async function test() {
  const projectRef = 'mkcwwrxwfhjpafiiqvzq';
  const password = 'Starlinknet1234';

  // Try direct connection first to various potential regions if needed,
  // but let's try the common ones or just the db host.
  const host = `db.${projectRef}.supabase.co`;

  console.log(`Attempting connection to ${host}...`);

  const client = new Client({
    host: host,
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Success! Connected to new Supabase DB.");
    const res = await client.query('SELECT NOW()');
    console.log("DB Time:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("❌ Connection failed!");
    console.error("Error:", err.message);
  }
}

test();
