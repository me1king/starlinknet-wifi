const net = require('net');

const regions = [
  'eu-central-1', 'us-east-1', 'ap-southeast-1', 'sa-east-1', 'us-west-1'
];

async function probe(region) {
  return new Promise((resolve) => {
    const projectRef = 'mkcwwrxwfhjpafiiqvzq';
    const host = `aws-0-${region}.pooler.supabase.com`;
    const socket = new net.Socket();
    socket.setTimeout(2000);

    socket.on('connect', () => {
      // Send SSL request
      socket.write(Buffer.from([0,0,0,8,4,210,22,47]));
    });

    socket.on('data', (d) => {
        if (d.toString() === 'N') { // SSL not supported (unlikely for Supabase pooler)
            // Send startup
        }
        const userStr = `user\0postgres.${projectRef}\0database\0postgres\0\0`;
        const buffer = Buffer.alloc(8 + userStr.length);
        buffer.writeInt32BE(8 + userStr.length, 0);
        buffer.writeInt32BE(196608, 4);
        buffer.write(userStr, 8);
        socket.write(buffer);
    });

    socket.on('data', (d) => {
        const response = d.toString('hex');
        const responseStr = d.toString();
        resolve({ region, response, responseStr });
        socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ region, error: 'timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ region, error: err.message });
    });

    socket.connect(5432, host);
  });
}

async function run() {
  for (const region of regions) {
    const res = await probe(region);
    console.log(`Region ${region}:`, res.error || (res.responseStr.includes('ENOTFOUND') ? 'NOT FOUND' : 'OK (' + res.response.substring(0, 10) + ')'));
  }
}

run();
