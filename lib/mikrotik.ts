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
    executeLegacyCommand,
    setLegacyTetheringBlock,
    banLegacyDevice
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
  // Source of Truth: environment variables
  // FAIL-SAFE: If switching ISPs, WireGuard/Tailscale IPs stay constant (10.0.0.2 / 100.x.x.x)
  // This ensures the system doesn't break when you change from Starlink to Fiber etc.
  const envHost = (process.env.MIKROTIK_HOST || '10.0.0.2').replace(/https?:\/\//g, '').replace(/['"]+/g, '').trim();
  const envPort = parseInt((process.env.MIKROTIK_PORT || '8728').replace(/['"]+/g, '').trim());

  let config: MikrotikConfig = {
    host: envHost,
    port: envPort,
    username: (process.env.MIKROTIK_USER || 'admin').replace(/['"]+/g, '').trim(),
    password: (process.env.MIKROTIK_PASSWORD || 'Hazy.123').replace(/['"]+/g, '').trim(),
    timeout: 20000, // Increased to 20s to handle high-latency ISP switches
  };

  // If siteId is specified, we try to fetch site-specific credentials from DB
  if (siteId && siteId !== 'default-site') {
    try {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (site && site.routerHost) {
        const hostClean = site.routerHost.replace(/https?:\/\//g, '').replace(/['"]+/g, '').trim();
        const parts = hostClean.split(':');
        config.host = parts[0];
        if (parts[1]) config.port = parseInt(parts[1]);
        if (site.routerUser) config.username = site.routerUser.replace(/['"]+/g, '').trim();
        if (site.routerPass) config.password = site.routerPass.replace(/['"]+/g, '').trim();
      }
    } catch (e) {
      console.warn(`[MikroTik Config] Site ${siteId} fetch failed. Using global defaults.`);
    }
  }

  // LOGGING: Crucial for debugging "I can't access MikroTik"
  console.log(`[MikroTik] Target: ${config.host}:${config.port} (User: ${config.username})`);

  return config;
}

/**
 * Robust execution of commands.
 */
async function executeRestCommand(path: string, method: string = 'GET', body?: any, siteId?: string): Promise<any> {
    const config = await getMikrotikConfig(siteId);

    const protocol = config.port === 443 ? 'https' : 'http';
    const url = `${protocol}://${config.host}:${config.port}/rest${path}`;
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

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
            if (response.status === 404) throw new Error("REST_NOT_FOUND");
            const errorText = await response.text();
            throw new Error(`REST Error (${response.status}): ${errorText}`);
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.error("[MikroTik REST] JSON Parse Error. Body starts with:", text.substring(0, 100));
            if (text.toLowerCase().includes("<html>") || text.toLowerCase().includes("<!doctype")) {
                throw new Error("REST_HTML_RESPONSE");
            }
            throw new Error("REST_INVALID_JSON");
        }
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') throw new Error("REST_TIMEOUT");
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
    'offer_tv': 'Smart-TV-Pass'
  };

  // If it's a custom DB offer (CUID), we default to a standard profile
  // and override the speed/time limits directly on the user record.
  return profileMap[packageId] || 'default';
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

  const finalRateLimit = rateLimit || '5M/5M';
  const finalBytesTotal = dataLimitMB ? dataLimitMB * 1024 * 1024 : 0;
  const finalMaxDevices = maxDevices || 1;

  try {
      console.log(`[MikroTik] Creating voucher ${voucherCode} on port ${config.port}`);

      // REST API ATTEMPT
      const restBody: any = {
          name: voucherCode,
          password: voucherCode,
          profile: profileName,
          server: 'hotspot1',
          comment: `STARLINKNET REST - ${new Date().toISOString()}`,
          'rate-limit': finalRateLimit,
          'shared-users': String(finalMaxDevices),
          'mac-address': macAddress || undefined // MAC BINDING: Locks voucher to this device
      };

      if (finalBytesTotal > 0) restBody['limit-bytes-total'] = String(finalBytesTotal);
      if (durationMin) {
          const h = Math.floor(durationMin / 60);
          const m = durationMin % 60;
          restBody['limit-uptime'] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      }

      await executeRestCommand('/ip/hotspot/user', 'PUT', restBody, siteId);
      return { success: true, voucherCode, profileName };

  } catch (e: any) {
      if (e.message === "REST_NOT_FOUND" || config.port !== 80) {
          console.log("[MikroTik] Switching to Legacy API...");
          const result = await createLegacyVoucher(voucherCode, profileName, siteId, durationMin, finalRateLimit, dataLimitMB, finalMaxDevices);
          if (result.success) return { success: true, voucherCode, profileName };
          return { success: false, voucherCode, profileName, error: result.error };
      }
      return { success: false, voucherCode, profileName, error: e.message };
  }
}

async function testMikrotikConnection(siteId?: string) {
  const config = await getMikrotikConfig(siteId);
  try {
      const data = await executeRestCommand('/system/identity', 'GET', undefined, siteId);
      return { success: true, message: `Connected to MikroTik (REST): ${data.name}` };
  } catch (e: any) {
      if (e.message === "REST_NOT_FOUND" || e.message === "REST_HTML_RESPONSE" || config.port !== 80) {
          const legacy = await testLegacyConnection(siteId);
          if (legacy.success) return { success: true, message: `Connected to MikroTik (Legacy): ${legacy.name}` };
          const tip = e.message === "REST_HTML_RESPONSE"
            ? "Router sent HTML instead of JSON. Run '/ip hotspot ip-binding add address=10.0.0.0/24 type=bypassed' in MikroTik."
            : "Check if router API is accessible and port is correct.";
          return { success: false, error: legacy.error, tip };
      }
      return { success: false, error: e.message, tip: "Verify MIKROTIK_HOST matches router IP." };
  }
}

async function getMikrotikActiveSessions(siteId?: string) {
  try {
      const data = await executeRestCommand('/ip/hotspot/active', 'GET', undefined, siteId);
      return data.map((item: any) => ({
          '.id': item['.id'],
          user: item.user,
          address: item.address,
          uptime: item.uptime,
          timeLeft: item['session-time-left'],
          'mac-address': item['mac-address'],
          'bytes-in': item['bytes-in'],
          'bytes-out': item['bytes-out']
      }));
  } catch (e: any) {
      return await getLegacyActiveSessions(siteId);
  }
}

async function getMikrotikResources(siteId?: string) {
  try {
      const [resources, identity] = await Promise.all([
          executeRestCommand('/system/resource', 'GET', undefined, siteId),
          executeRestCommand('/system/identity', 'GET', undefined, siteId)
      ]);
      return { ...(Array.isArray(resources) ? resources[0] : resources), name: identity?.name || "MikroTik" };
  } catch (e: any) {
      return await getLegacyResources(siteId);
  }
}

async function terminateMikrotikSession(voucherCode: string, siteId?: string) {
  try {
      const active = await executeRestCommand('/ip/hotspot/active', 'GET', undefined, siteId);
      const session = active.find((s: any) => s.user === voucherCode);
      if (session) await executeRestCommand(`/ip/hotspot/active/${session['.id']}`, 'DELETE', undefined, siteId);
      const users = await executeRestCommand('/ip/hotspot/user', 'GET', undefined, siteId);
      const user = users.find((u: any) => u.name === voucherCode);
      if (user) await executeRestCommand(`/ip/hotspot/user/${user['.id']}`, 'DELETE', undefined, siteId);
      return { success: true };
  } catch (e: any) {
      return await terminateLegacySession(voucherCode, siteId);
  }
}

async function addVoucherTime(voucherCode: string, minutes: number, siteId?: string) {
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
    } catch (e: any) {
        return await addLegacyVoucherTime(voucherCode, minutes, siteId);
    }
}

async function getMikrotikTraffic(siteId?: string, interfaceName?: string) {
  try {
      const config = await getMikrotikConfig(siteId);
      // PRIORITY:
      // 1. Use the interface name passed to the function (from API query)
      // 2. Use the environment variable MIKROTIK_INTERFACE (Manual Override)
      // 3. Fallback to 'ether1' (Default)
      const targetInterface = interfaceName || process.env.MIKROTIK_INTERFACE || 'ether1';

      console.log(`[MikroTik Traffic] Monitoring interface: ${targetInterface}`);

      const data = await executeRestCommand('/interface/monitor-traffic', 'POST', { interface: targetInterface, once: true }, siteId);
      return Array.isArray(data) ? data[0] : data;
  } catch (e: any) {
      const fallbackInterface = interfaceName || process.env.MIKROTIK_INTERFACE || 'ether1';
      return await getLegacyTraffic(fallbackInterface, siteId);
  }
}

async function rebootMikrotik(siteId?: string) {
  try {
    const config = await getMikrotikConfig(siteId);
    if (config.port === 80 || config.port === 443) {
      await executeRestCommand('/system/reboot', 'POST', {}, siteId);
      return { success: true };
    }
    // Fallback to legacy reboot if port 80/443 not used
    await executeLegacyCommand(['/system/reboot'], siteId);
    return { success: true };
  } catch (e: any) {
    // Reboot usually kills the connection so an error is actually a "Success"
    if (e.message?.includes('socket') || e.message?.includes('aborted') || e.message?.includes('timeout')) {
      return { success: true };
    }
    throw e;
  }
}

async function getDhcpLeases(siteId?: string) {
  try {
    const data = await executeRestCommand('/ip/dhcp-server/lease', 'GET', undefined, siteId);
    return data;
  } catch (e: any) {
    // Basic fallback or empty list
    return [];
  }
}

async function activateHotspotSession(mac: string, ip: string, code: string, siteId?: string) {
  try {
      const body = { user: code, 'mac-address': mac, address: ip, server: 'hotspot1' };
      await executeRestCommand('/ip/hotspot/active', 'POST', body, siteId);
      return { success: true, message: "Session activated via REST" };
  } catch (e: any) {
      return { success: false, message: e.message };
  }
}

async function checkMikrotikUserExists(voucherCode: string, siteId?: string): Promise<boolean> {
  try {
      const users = await executeRestCommand('/ip/hotspot/user', 'GET', undefined, siteId);
      return users.some((u: any) => u.name === voucherCode);
  } catch (e) {
      return await checkLegacyUserExists(voucherCode, siteId);
  }
}

async function pingDeviceFromRouter(address: string, siteId?: string): Promise<{ alive: boolean, avgRtt?: string }> {
  try {
      const result = await executeRestCommand('/ping', 'POST', { address, count: 3 }, siteId);
      const successful = result.filter((r: any) => r.received > 0);
      if (successful.length > 0) return { alive: true, avgRtt: successful[0]['avg-rtt'] || "20ms" };
      return { alive: false };
  } catch (e) {
      try {
          const legacyResult = await executeLegacyCommand(['/ping', `=address=${address}`, '=count=3'], siteId);
          const received = legacyResult.filter((p: any) => p.received > 0 || p.status === 'received');
          if (received.length > 0) return { alive: true, avgRtt: legacyResult[0]['avg-rtt'] || legacyResult[0].time };
          return { alive: false };
      } catch (le) { return { alive: false }; }
  }
}

async function getMikrotikExport(siteId?: string) { return null; }
async function scanForRogueAPs(siteId?: string) { return []; }

async function banMikrotikDevice(macAddress: string, siteId?: string) {
    const config = await getMikrotikConfig(siteId);
    try {
        if (config.port === 80 || config.port === 443) {
            await executeRestCommand('/ip/hotspot/ip-binding', 'POST', {
                'mac-address': macAddress,
                type: 'blocked',
                comment: `BANNED_${macAddress}`
            }, siteId);
            return { success: true };
        }
    } catch (e: any) {}

    return await banLegacyDevice(macAddress, siteId);
}

async function setTetheringBlock(enabled: boolean, siteId?: string) {
    try {
        const res = await setLegacyTetheringBlock(enabled, siteId);
        return res;
    } catch (e) { return { success: false, message: "Failed to set TTL rule" }; }
}

export {
  createMikrotikVoucher,
  testMikrotikConnection,
  terminateMikrotikSession,
  getMikrotikConfig,
  getProfileName,
  getMikrotikActiveSessions,
  getMikrotikResources,
  addVoucherTime,
  getMikrotikTraffic,
  checkMikrotikUserExists,
  activateHotspotSession,
  pingDeviceFromRouter,
  getMikrotikExport,
  scanForRogueAPs,
  banMikrotikDevice,
  setTetheringBlock,
  rebootMikrotik,
  getDhcpLeases,
  executeRestCommand
};
export type { MikrotikConfig, VoucherCreationResult };
