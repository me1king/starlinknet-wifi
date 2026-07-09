const net = require('net');

const regions = [
  'eu-central-1', 'us-east-1', 'us-west-1', 'ap-southeast-1', 'ap-northeast-1',
  'sa-east-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'me-central-1', 'ap-south-1', 'ap-southeast-2', 'af-south-1', 'me-south-1'
];

async function checkRegion(region) {
  return new Promise((resolve) => {
    const projectRef = 'mkcwwrxwfhjpafiiqvzq';
    const host = `aws-0-${region}.pooler.supabase.com`;
    const socket = new net.Socket();
    socket.setTimeout(2000);

    socket.on('connect', () => {
      // Port is open
      socket.write(Buffer.from([0,0,0,8,4,210,22,47])); // SSL request
    });

    socket.on('data', (d) => {
        // After SSL request, we send startup
        const buffer = Buffer.alloc(100);
        const userStr = `user\0postgres.${projectRef}\0database\0postgres\0\0`;
        buffer.writeInt32BE(8 + userStr.length, 0);
        buffer.writeInt32BE(196608, 4);
        buffer.write(userStr, 8);
        socket.write(buffer.slice(0, 8 + userStr.length));
    });

    socket.on('data', (d) => {
        const response = d.toString();
        if (response.includes('ENOTFOUND')) {
            resolve({ success: false, reason: 'wrong-region' });
        } else {
            resolve({ success: true, response: response });
        }
        socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, reason: 'timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, reason: err.message });
    });

    socket.connect(5432, host);
  });
}

async function run() {
  console.log("Searching for region...");
  for (const region of regions) {
    process.stdout.write(`Checking ${region}... `);
    const result = await checkRegion(region);
    if (result.success) {
      console.log("✅ FOUND! Project is in " + region);
      return;
    } else {
      console.log(result.reason);
    }
  }
}

run();
