import { Buffer } from 'buffer';
import { prisma } from './prisma';
import {
    createLegacyVoucher,
    getLegacyActiveSessions,
    testLegacyConnection,
    terminateLegacySession,
    getLegacyResources,
    getLegacyTraffic,
    addLegacyVoucherTime,
    checkLegacyUserExists,
    executeLegacyCommand
} from './mikrotik-legacy';

interface MikrotikConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout: number;
}

interface VoucherCreationResult {
  success: boolean;
  voucherCode: string;
  profileName: string;
  error?: string;
}

async function getMikrotikConfig(siteId?: string): Promise<MikrotikConfig> {
  // 1. Start with values from .env.local (The Source of Truth)
  let config: MikrotikConfig = {
    host: process.env.MIKROTIK_HOST || '10.5.50.1',
    port: parseInt(process.env.MIKROTIK_PORT || '80'),
    username: process.env.MIKROTIK_USER || 'admin',
    password: process.env.MIKROTIK_PASSWORD || '',
    timeout: 20000,
  };

  // 2. If a specific site is requested, try to override with site-specific settings
  if (siteId && siteId !== 'default-site') {
    try {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (site && site.routerHost) {
        const parts = site.routerHost.split(':');
        config.host = parts[0];
        if (parts[1]) config.port = parseInt(parts[1]);
        if (site.routerUser) config.username = site.routerUser;
        if (site.routerPass) config.password = site.routerPass;
      }
    } catch (e) {
      console.warn(`[MikroTik Config] Could not fetch site ${siteId}, using defaults.`);
    }
  }

  // 3. Final safety check: if port is 8728 but we are on ROS 7+,
  // we should encourage using 80, but we respect the config.

  console.log(`[MikroTik Config] FINAL: ${config.host}:${config.port} (User: ${config.username})`);
  return config;
}

/**
 * Executes a command on MikroTik using the REST API (Port 80/443).
 * Requires RouterOS v7.1+.
 */
async function executeRestCommand(path: string, method: string = 'GET', body?: any, siteId?: string): Promise<any> {
    const config = await getMikrotikConfig(siteId);
    const protocol = config.port === 443 ? 'https' : 'http';
    const url = `${protocol}://${config.host}:${config.port}/rest${path}`;
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404) {
                throw new Error(`MikroTik REST API Not Found (404). Ensure 'www' service is enabled and you are on RouterOS v7.1+. Tip: Try switching MIKROTIK_PORT to 8728 in .env.local to use the Legacy API instead.`);
            }
            throw new Error(`MikroTik REST Error (${response.status}): ${errorText || response.statusText}`);
        }

        return await response.json();
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') throw new Error("MikroTik REST API Timeout");
        throw e;
    }
}

function getProfileName(packageId: string): string {
  const profileMap: Record<string, string> = {
    '1hr': '1-Hour-Pass',
    '24hr': '24-Hour-Pass',
    '7day': '7-Day-Pass',
    'offer_1hr': '1-Hour-Pass',
    'offer_3hr': '3-Hour-Pass',
    'offer_netflix': 'Netflix-Special',
    'offer_work': 'Work-Mode-Pass',
    'offer_night': '6-Hour-Pass',
    'offer_midnight_oil': 'Midnight-Oil-Pass',
    'offer_weekend': '48-Hour-Pass',
  };
  return profileMap[packageId] || '1-Hour-Pass';
}

async function createMikrotikVoucher(
  voucherCode: string,
  packageId: string,
  durationMin?: number,
  expiryMode?: string,
  macAddress?: string,
  rateLimit?: string,
  dataLimitMB?: number,
  burstLimit?: string,
  burstThreshold?: string,
  burstTime?: string,
  siteId?: string,
  maxDevices?: number
): Promise<VoucherCreationResult> {
  const profileName = getProfileName(packageId);
  const config = await getMikrotikConfig(siteId);

  if (!macAddress) {
      console.warn(`[MikroTik] Creating voucher ${voucherCode} without binding it to a MAC address.`);
  }

  // Calculate rate limit if not provided
  const finalRateLimit = rateLimit || '5M/5M';
  const finalBytesTotal = dataLimitMB ? dataLimitMB * 1024 * 1024 : 0;
  const finalMaxDevices = maxDevices || 1;

  // If port is 80 or 443, use REST API
  if (config.port === 80 || config.port === 443) {
      try {
          console.log(`[MikroTik REST] Creating voucher ${voucherCode} on site ${siteId || 'default'}`);

          // FOR REST API, the path is /ip/hotspot/user
          const restBody: any = {
              name: voucherCode,
              password: voucherCode,
              profile: profileName,
              server: 'hotspot1',
              comment: `STARLINKNET.WIFI REST - ${new Date().toISOString()}`,
              'rate-limit': finalRateLimit,
              'shared-users': String(finalMaxDevices)
          };

          if (finalBytesTotal > 0) {
              restBody['limit-bytes-total'] = finalBytesTotal.toString();
          }

          if (durationMin) {
              const h = Math.floor(durationMin / 60);
              const m = durationMin % 60;
              restBody['limit-uptime'] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
          }

          await executeRestCommand('/ip/hotspot/user', 'PUT', restBody, siteId);
          return { success: true, voucherCode, profileName };
      } catch (e: any) {
          console.error("[MikroTik REST] Voucher Creation Error:", e.message);

          // HEAL: If PUT fails, try POST (Some ROS versions prefer POST for creation)
          try {
              console.log("[MikroTik REST] Retrying with POST...");
              const postBody: any = {
                  name: voucherCode,
                  password: voucherCode,
                  profile: profileName,
                  server: 'hotspot1',
                  'rate-limit': finalRateLimit,
                  'shared-users': String(finalMaxDevices)
              };
              await executeRestCommand('/ip/hotspot/user', 'POST', postBody, siteId);
              return { success: true, voucherCode, profileName };
          } catch (retryErr: any) {
              return { success: false, voucherCode, profileName, error: retryErr.message };
          }
      }
  }

  // Otherwise fallback to Legacy API
  const result = await createLegacyVoucher(
      voucherCode,
      profileName,
      siteId,
      durationMin,
      finalRateLimit,
      dataLimitMB,
      finalMaxDevices
  );
  if (result.success) return { success: true, voucherCode, profileName };
  return { success: false, voucherCode, profileName, error: result.error };
}

async function terminateMikrotikSession(voucherCode: string, siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          // Remove active session
          const active = await executeRestCommand('/ip/hotspot/active', 'GET', undefined, siteId);
          const sessions = active.filter((s: any) => s.user === voucherCode);
          for (const s of sessions) {
              await executeRestCommand(`/ip/hotspot/active/${s['.id']}`, 'DELETE', undefined, siteId);
          }
          // Remove user
          const users = await executeRestCommand('/ip/hotspot/user', 'GET', undefined, siteId);
          const matchedUsers = users.filter((u: any) => u.name === voucherCode);
          for (const u of matchedUsers) {
              await executeRestCommand(`/ip/hotspot/user/${u['.id']}`, 'DELETE', undefined, siteId);
          }
          return { success: true };
      } catch (e: any) {
          return { success: false, error: e.message };
      }
  }

  return await terminateLegacySession(voucherCode, siteId);
}

async function testMikrotikConnection(siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  console.log(`[MikroTik] Diagnostic check to ${config.host}:${config.port} (Site: ${siteId || 'default'})`);

  if (config.port === 80 || config.port === 443) {
      try {
          const data = await executeRestCommand('/system/identity', 'GET', undefined, siteId);
          return { success: true, message: `Connected to MikroTik (REST): ${data.name}` };
      } catch (e: any) {
          console.error(`[MikroTik REST] Connection failed: ${e.message}`);
          return { success: false, message: `REST Connection Failed: ${e.message}`, error: e.message };
      }
  }

  try {
    const result = await testLegacyConnection(siteId);
    if (result.success) {
      return { success: true, message: `Connected to MikroTik (Legacy): ${result.name}` };
    }
    console.error(`[MikroTik Legacy] Connection failed: ${result.error}`);
    return { success: false, message: `Legacy Connection Failed: ${result.error}`, error: result.error };
  } catch (e: any) {
    console.error(`[MikroTik Legacy] Fatal error: ${e.message}`);
    return { success: false, message: `Legacy Fatal Error: ${e.message}`, error: e.message };
  }
}

async function getMikrotikActiveSessions(siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          const data = await executeRestCommand('/ip/hotspot/active', 'GET', undefined, siteId);
          return data.map((item: any) => ({
              '.id': item['.id'],
              user: item.user,
              address: item.address,
              uptime: item.uptime,
              'mac-address': item['mac-address'],
              'bytes-in': item['bytes-in'],
              'bytes-out': item['bytes-out']
          }));
      } catch (e) { return []; }
  }

  return await getLegacyActiveSessions(siteId);
}

async function getMikrotikResources(siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          const [resources, identity] = await Promise.all([
              executeRestCommand('/system/resource', 'GET', undefined, siteId),
              executeRestCommand('/system/identity', 'GET', undefined, siteId)
          ]);

          return {
              ...(Array.isArray(resources) ? resources[0] : resources),
              name: identity?.name || "MikroTik"
          };
      } catch (e: any) {
          console.error(`[MikroTik REST] Resource fetch failed: ${e.message}`);
          return null;
      }
  }

  try {
      const data = await getLegacyResources(siteId);
      return data || null;
  } catch (e) {
      return null;
  }
}

async function addVoucherTime(voucherCode: string, minutes: number, siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          const users = await executeRestCommand('/ip/hotspot/user', 'GET', undefined, siteId);
          const user = users.find((u: any) => u.name === voucherCode);
          if (user) {
              const currentLimit = user['limit-uptime'] || "00:00:00";
              const parts = currentLimit.split(':').map(Number);
              let totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
              totalSeconds += (minutes * 60);
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              const newLimit = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
              await executeRestCommand(`/ip/hotspot/user/${user['.id']}`, 'PATCH', { 'limit-uptime': newLimit }, siteId);
              return { success: true };
          }
          return { success: false, error: "User not found" };
      } catch (e: any) { return { success: false, error: e.message }; }
  }

  return await addLegacyVoucherTime(voucherCode, minutes, siteId);
}

async function getMikrotikTraffic(siteId?: string, interfaceName: string = 'ether1') {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          const data = await executeRestCommand('/interface/monitor-traffic', 'POST', {
              interface: interfaceName,
              once: true
          }, siteId);
          return Array.isArray(data) ? data[0] : data;
      } catch (e: any) {
          console.error(`[MikroTik REST] Traffic fetch failed: ${e.message}`);
          return null;
      }
  }

  return await getLegacyTraffic(interfaceName, siteId);
}

// These are secondary/optional for now
async function getMikrotikInterfaces(siteId?: string) { return []; }
async function pingDeviceFromRouter(address: string, siteId?: string): Promise<{ alive: boolean, avgRtt?: string }> {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          const result = await executeRestCommand('/ping', 'POST', {
              address,
              count: 3
          }, siteId);
          // REST API /ping returns an array of results
          const successful = result.filter((r: any) => r.received > 0);
          if (successful.length > 0) {
              return {
                  alive: true,
                  avgRtt: successful[0]['avg-rtt'] || "20ms"
              };
          }
          return { alive: false };
      } catch (e) {
          return { alive: false };
      }
  }

  return { alive: false };
}
async function getMikrotikExport(siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          // For REST API, we fetch basic system identity and resource info as a "backup"
          const identity = await executeRestCommand('/system/identity', 'GET', undefined, siteId);
          const resources = await executeRestCommand('/system/resource', 'GET', undefined, siteId);
          const users = await executeRestCommand('/ip/hotspot/user', 'GET', undefined, siteId);
          const profiles = await executeRestCommand('/ip/hotspot/user/profile', 'GET', undefined, siteId);

          const backupHeader = `# STARLINKNET.WIFI REST Cloud Backup\n# Identity: ${identity.name}\n# Generated: ${new Date().toISOString()}\n\n`;
          return backupHeader + JSON.stringify({ identity, resources, profiles, usersCount: users.length }, null, 2);
      } catch (e: any) {
          console.error(`[MikroTik REST] Export failed: ${e.message}`);
          return null;
      }
  }

  try {
      // For Legacy API, we use identity and resource print as a proof of backup
      const [identity, resources] = await Promise.all([
          executeLegacyCommand(['/system/identity/print'], siteId),
          executeLegacyCommand(['/system/resource/print'], siteId)
      ]);

      if (identity && identity.length > 0) {
          const backupHeader = `# STARLINKNET.WIFI Legacy Cloud Backup\n# Identity: ${identity[0].name}\n# Generated: ${new Date().toISOString()}\n\n`;
          return backupHeader + JSON.stringify({ identity: identity[0], resources: resources[0] }, null, 2);
      }
      return null;
  } catch (e) {
      console.error(`[MikroTik Legacy] Export failed:`, e);
      return null;
  }
}
async function scanForRogueAPs(siteId?: string) { return []; }
async function banMikrotikDevice(macAddress: string, voucherCode: string, siteId?: string) { return { success: false, message: "Not implemented in legacy" }; }
async function setTetheringBlock(enabled: boolean, siteId?: string) { return { success: false, message: "Not implemented in legacy" }; }
async function activateHotspotSession(mac: string, ip: string, code: string, siteId?: string) {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          console.log(`[MikroTik REST] Activating session for MAC: ${mac}, IP: ${ip}, User: ${code}`);
          // Attempt to login via REST (if supported/configured in some setups)
          // Note: Most Hotspots require the client to POST to /login.
          // However, we can use the API to "active" a user if we have their details.
          // Another way is to add them to /ip/hotspot/active directly if the router allows it via API.

          const body = {
              user: code,
              'mac-address': mac,
              address: ip,
              server: 'hotspot1'
          };

          await executeRestCommand('/ip/hotspot/active', 'POST', body, siteId);
          return { success: true, message: "Session activated via REST" };
      } catch (e: any) {
          console.error(`[MikroTik REST] Activation failed: ${e.message}`);
          return { success: false, message: e.message };
      }
  }

  return { success: false, message: "Manual activation not implemented for Legacy API" };
}

async function checkMikrotikUserExists(voucherCode: string, siteId?: string): Promise<boolean> {
  const config = await getMikrotikConfig(siteId);

  if (config.port === 80 || config.port === 443) {
      try {
          const users = await executeRestCommand('/ip/hotspot/user', 'GET', undefined, siteId);
          return users.some((u: any) => u.name === voucherCode);
      } catch (e) { return false; }
  }

  return await checkLegacyUserExists(voucherCode, siteId);
}

// Ensure executeLegacyCommand is available for checkMikrotikUserExists if needed
// or we can import it if it was exported. Let's just use the existing legacy functions.

export {
  createMikrotikVoucher,
  testMikrotikConnection,
  terminateMikrotikSession,
  getMikrotikConfig,
  getProfileName,
  getMikrotikActiveSessions,
  getMikrotikResources,
  getMikrotikInterfaces,
  pingDeviceFromRouter,
  getMikrotikExport,
  scanForRogueAPs,
  addVoucherTime,
  getMikrotikTraffic,
  banMikrotikDevice,
  setTetheringBlock,
  activateHotspotSession,
  checkMikrotikUserExists
};
export type { MikrotikConfig, VoucherCreationResult };
