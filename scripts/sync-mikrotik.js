/**
 * MikroTik Sync Script
 *
 * This script triggers the device synchronization API to keep the
 * Cloud Database updated with the router's active sessions.
 *
 * Usage: node scripts/sync-mikrotik.js [siteId]
 */

const siteId = process.argv[2] || 'default-site';
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET || 'starlinknet_wifi_super_secret_cron_123';

console.log(`[${new Date().toISOString()}] Starting sync for site: ${siteId}...`);

async function runSync() {
  try {
    const response = await fetch(`${baseUrl}/api/cron/sync-devices?siteId=${siteId}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Success] ${data.message}`);
    console.log(`- Router Active: ${data.routerActiveCount}`);
    console.log(`- Disconnected: ${data.disconnectedCount}`);
  } catch (error) {
    console.error(`[Error] Sync failed: ${error.message}`);
    process.exit(1);
  }
}

runSync();
