const net = require('net');

const regions = [
  'eu-central-1', 'eu-central-2', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-south-1', 'sa-east-1', 'ca-central-1', 'me-south-1', 'af-south-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1'
];

async function checkRegion(region) {
  return new Promise((resolve) => {
    const projectRef = 'mkcwwrxwfhjpafiiqvzq';
    const host = `aws-0-${region}.pooler.supabase.com`;
    const socket = new net.Socket();
    socket.setTimeout(1500);

    socket.on('connect', () => {
      // Send a fake SSL request
      socket.write(Buffer.from([0,0,0,8,4,210,22,47]));
    });

    socket.on('data', (d) => {
        // Send startup
        const userStr = `user\0postgres.${projectRef}\0database\0postgres\0\0`;
        const buffer = Buffer.alloc(8 + userStr.length);
        buffer.writeInt32BE(8 + userStr.length, 0);
        buffer.writeInt32BE(196608, 4);
        buffer.write(userStr, 8);
        socket.write(buffer);
    });

    socket.on('data', (d) => {
        const response = d.toString();
        if (response.includes('ENOTFOUND')) {
            resolve({ success: false, reason: 'wrong-region' });
        } else {
            resolve({ success: true, response: response.substring(0, 50) });
        }
        socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, reason: 'timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, reason: 'unreachable' });
    });

    socket.connect(5432, host);
  });
}

async function run() {
  console.log("Brute-forcing Supabase regions...");
  for (const region of regions) {
    const result = await checkRegion(region);
    if (result.success) {
      console.log(`✅ ${region}: FOUND!`);
    } else if (result.reason !== 'wrong-region' && result.reason !== 'unreachable') {
      console.log(`❓ ${region}: ${result.reason}`);
    }
  }
  console.log("Done.");
}

run();
