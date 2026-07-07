const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');

/**
 * WHATSAPP BRIDGE SERVER
 * -----------------------
 * This script runs a background worker that handles WhatsApp messaging.
 * It's 100% FREE because it uses your own phone.
 */

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "starlinknet-production"
    }),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Generate the QR code for initial linking
client.on('qr', (qr) => {
    console.log('\n---------------------------------------------------------');
    console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP TO LINK YOUR PHONE:');
    console.log('---------------------------------------------------------\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n🚀 WhatsApp Automation is LIVE and connected!');
    console.log('System is ready to send vouchers for FREE.\n');
});

client.on('auth_failure', msg => {
    console.error('❌ AUTHENTICATION FAILURE:', msg);
});

client.initialize();

// Create a small HTTP server so the Next.js app can "talk" to this script
const server = http.createServer(async (req, res) => {
    // Only allow POST to /send
    if (req.method === 'POST' && req.url === '/send') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { phoneNumber, message } = JSON.parse(body);

                if (!phoneNumber || !message) {
                    res.writeHead(400);
                    return res.end('Missing params');
                }

                // Format number: 07... -> 254...
                let formattedNumber = phoneNumber.replace(/[^0-9]/g, "");
                if (formattedNumber.startsWith("0")) {
                    formattedNumber = "254" + formattedNumber.substr(1);
                }
                const whatsappId = `${formattedNumber}@c.us`;

                await client.sendMessage(whatsappId, message);
                console.log(`✅ Message sent to ${phoneNumber}`);

                res.writeHead(200);
                res.end('Sent');
            } catch (err) {
                console.error("❌ Send Error:", err.message);
                res.writeHead(500);
                res.end(err.message);
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

// Listen on a local port that Next.js will call
const BRIDGE_PORT = 4000;
server.listen(BRIDGE_PORT, () => {
    console.log(`📡 WhatsApp Bridge listening on port ${BRIDGE_PORT}`);
});
