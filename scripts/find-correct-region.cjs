const net = require('net');

const regions = [
  'eu-central-1', 'us-east-1', 'us-west-1', 'ap-southeast-1', 'ap-northeast-1',
  'sa-east-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'me-central-1', 'ap-south-1', 'ap-southeast-2'
];

async function checkRegion(region) {
  return new Promise((resolve) => {
    const projectRef = 'mkcwwrxwfhjpafiiqvzq';
    const host = `aws-0-${region}.pooler.supabase.com`;
    const socket = new net.Socket();
    socket.setTimeout(3000);

    let data = '';
    socket.on('data', (d) => {
        data += d.toString();
        // If we get any data, the port is open.
        // But we want to see the error message from the pooler.
    });

    socket.on('connect', () => {
      // Send a startup message to trigger the pooler's response
      // This is a simplified Postgres startup packet
      const buffer = Buffer.alloc(100);
      buffer.writeInt32BE(100, 0); // Length
      buffer.writeInt32BE(196608, 4); // Protocol version 3.0
      // user postgres.mkcwwrxwfhjpafiiqvzq
      const userStr = `user\0postgres.${projectRef}\0database\0postgres\0\0`;
      buffer.write(userStr, 8);
      socket.write(buffer.slice(0, 8 + userStr.length));
    });

    socket.on('data', (d) => {
        // Supabase pooler returns an ErrorResponse if tenant not found
        // or AuthenticationRequest if found.
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
  console.log("Searching for the correct region for project mkcwwrxwfhjpafiiqvzq...");
  for (const region of regions) {
    process.stdout.write(`Checking ${region}... `);
    const result = await checkRegion(region);
    if (result.success) {
      console.log("✅ FOUND! Project is likely in " + region);
      break;
    } else {
      console.log(result.reason);
    }
  }
}

run();
