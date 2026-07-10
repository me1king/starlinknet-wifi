import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
    const host = (process.env.MIKROTIK_HOST || '192.168.88.1').replace(/https?:\/\//g, '').trim();
    const user = (process.env.MIKROTIK_USER || 'admin').trim();
    const pass = (process.env.MIKROTIK_PASSWORD || '').trim();
    const port = parseInt(process.env.MIKROTIK_PORT || '80');

    console.log("--- MikroTik Tailscale Verification ---");
    console.log(`Target Host: ${host}`);
    console.log(`Port: ${port}`);
    console.log(`User: ${user}`);
    console.log("---------------------------------------");

    if (host === '100.72.4.99') {
        console.warn("⚠️  WARNING: You are still using the laptop's Tailscale IP (100.72.4.99).");
        console.warn("Please update MIKROTIK_HOST in .env.local to the new Router IP.");
    }

    try {
        console.log("Testing connection...");
        const auth = Buffer.from(`${user}:${pass}`).toString('base64');
        const url = `http://${host}:${port}/rest/system/identity`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            console.log("✅ SUCCESS: Successfully connected to MikroTik over Tailscale!");
            console.log(`Router Identity: ${data.name}`);
        } else {
            console.error(`❌ FAILED: Router returned status ${response.status}`);
            const text = await response.text();
            console.error(`Response: ${text}`);
        }
    } catch (error: any) {
        console.error("❌ CRITICAL ERROR during verification:");
        console.error(error.message);
        if (error.name === 'AbortError') {
            console.log("Tip: The request timed out. Check if Tailscale is running and the IP is correct.");
        }
    }
}

main();
