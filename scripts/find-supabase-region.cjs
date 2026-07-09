const net = require('net');

const regions = [
  'eu-central-1', 'us-east-1', 'us-west-1', 'ap-southeast-1', 'ap-northeast-1',
  'sa-east-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'me-central-1', 'ap-south-1', 'ap-southeast-2'
];

async function checkRegion(region) {
  return new Promise((resolve) => {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const socket = new net.Socket();
    socket.setTimeout(2000);

    socket.on('connect', () => {
      console.log(`✅ ${region} is reachable!`);
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(6543, host);
  });
}

async function run() {
  console.log("Searching for active Supabase Pooler region...");
  for (const region of regions) {
    process.stdout.write(`Checking ${region}... `);
    const ok = await checkRegion(region);
    if (!ok) console.log("timed out");
  }
}

run();
