import { Connection } from 'mikrotik';
import { getMikrotikConfig } from './mikrotik';

/**
 * Executes a command on MikroTik using the legacy API (Port 8728).
 */
async function executeLegacyCommand(command: string[], siteId?: string): Promise<any> {
    const config = await getMikrotikConfig(siteId);
    const hostIp = config.host.split(':')[0];

    return new Promise((resolve, reject) => {
        const conn = new Connection(hostIp, config.username, config.password, {
            port: config.port,
            timeout: 10
        });

        conn.on('error', (err) => reject(err));

        conn.connect((err: any, conn: any) => {
            if (err) {
                const errMsg = err.message || JSON.stringify(err);
                console.error("[MikroTik Legacy] Connection Error:", errMsg);

                // Explicitly check for password failure
                if (errMsg.toLowerCase().includes('invalid user name or password')) {
                    return reject(new Error("AUTH_FAILED: Invalid Password. Run '/user set admin password=Hazy.123' in MikroTik Terminal."));
                }

                return reject(err);
            }

            const chan = conn.openChannel();

            chan.write(command, (err: any, chan: any) => {
                if (err) {
                    conn.close();
                    return reject(err);
                }

                chan.on('done', (data: any) => {
                    const parsed = Connection.parseItems(data);
                    chan.close();
                    conn.close();
                    resolve(parsed);
                });

                chan.on('trap', (data: any) => {
                    console.error("[MikroTik Legacy] Command Trap:", data);
                    chan.close();
                    conn.close();
                    reject(new Error(data[0].message || "Router API Trap"));
                });
            });
        });
    });
}

export async function createLegacyVoucher(
    voucherCode: string,
    profile: string,
    siteId?: string,
    durationMin?: number,
    rateLimit?: string,
    dataLimitMB?: number
) {
    try {
        const cmd = [
            '/ip/hotspot/user/add',
            `=name=${voucherCode}`,
            `=password=${voucherCode}`,
            `=profile=${profile}`,
            `=server=hotspot1`,
            `=comment=Starlinknet.WIFI Legacy - ${new Date().toISOString()}`
        ];

        if (rateLimit) cmd.push(`=rate-limit=${rateLimit}`);
        if (dataLimitMB) {
            const bytes = dataLimitMB * 1024 * 1024;
            cmd.push(`=limit-bytes-total=${bytes}`);
        }
        if (durationMin) {
            const h = Math.floor(durationMin / 60);
            const m = durationMin % 60;
            const limit = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
            cmd.push(`=limit-uptime=${limit}`);
        }

        await executeLegacyCommand(cmd, siteId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function terminateLegacySession(voucherCode: string, siteId?: string) {
    try {
        // 1. Remove active session
        const active = await executeLegacyCommand(['/ip/hotspot/active/print', `?user=${voucherCode}`], siteId);
        for (const session of active) {
            await executeLegacyCommand(['/ip/hotspot/active/remove', `=.id=${session['.id']}`], siteId);
        }
        // 2. Remove user
        const users = await executeLegacyCommand(['/ip/hotspot/user/print', `?name=${voucherCode}`], siteId);
        for (const user of users) {
            await executeLegacyCommand(['/ip/hotspot/user/remove', `=.id=${user['.id']}`], siteId);
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getLegacyActiveSessions(siteId?: string) {
    try {
        const data = await executeLegacyCommand(['/ip/hotspot/active/print'], siteId);
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

export async function getLegacyResources(siteId?: string) {
    try {
        const data = await executeLegacyCommand(['/system/resource/print'], siteId);
        return data[0] || null;
    } catch (e) { return null; }
}

export async function addLegacyVoucherTime(voucherCode: string, minutes: number, siteId?: string) {
    try {
        const users = await executeLegacyCommand(['/ip/hotspot/user/print', `?name=${voucherCode}`], siteId);
        if (users.length > 0) {
            const user = users[0];
            const currentLimit = user['limit-uptime'] || "00:00:00";
            const parts = currentLimit.split(':').map(Number);
            let totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            totalSeconds += (minutes * 60);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            const newLimit = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            await executeLegacyCommand(['/ip/hotspot/user/set', `=.id=${user['.id']}`, `=limit-uptime=${newLimit}`], siteId);
            return { success: true };
        }
        return { success: false, error: "User not found" };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function checkLegacyUserExists(voucherCode: string, siteId?: string) {
    try {
        const users = await executeLegacyCommand(['/ip/hotspot/user/print', `?name=${voucherCode}`], siteId);
        return users.length > 0;
    } catch (e) { return false; }
}

export async function testLegacyConnection(siteId?: string) {
    try {
        console.log("[MikroTik Legacy] Testing connection...");
        const data = await executeLegacyCommand(['/system/identity/print'], siteId);
        console.log("[MikroTik Legacy] Connection success:", data);
        return { success: true, name: data[0]?.name || "MikroTik" };
    } catch (e: any) {
        console.error("[MikroTik Legacy] Connection failed:", e.message || e);
        return { success: false, error: e.message || "Unknown Connection Error" };
    }
}
