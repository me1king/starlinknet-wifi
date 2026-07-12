import { NextRequest, NextResponse } from 'next/server';
import { getMikrotikActiveSessions, terminateMikrotikSession } from '@/lib/mikrotik';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// In-memory traffic tracker
// In production, this persists across requests but resets on server restart
const trafficTracker: Record<string, { bytes: number, lastChecked: number }> = {};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';
    const authHeader = req.headers.get('authorization');

    // Simple security check
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Ghost Buster] Starting Idle Cleanup for ${siteId}...`);

    // 1. Fetch all active sessions
    const activeSessions = await getMikrotikActiveSessions(siteId);
    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({ success: true, message: "No active sessions to check." });
    }

    const now = Date.now();
    let kickedCount = 0;

    // 2. Analyze each session
    for (const session of activeSessions) {
      const voucherCode = session.user;
      const macAddress = session['mac-address'];
      const totalBytes = parseInt(session['bytes-in'] || '0') + parseInt(session['bytes-out'] || '0');

      const trackingKey = `${siteId}_${macAddress}_${voucherCode}`;
      const lastData = trafficTracker[trackingKey];

      if (lastData) {
        const timeDiffMin = (now - lastData.lastChecked) / (1000 * 60);
        const bytesDiff = totalBytes - lastData.bytes;

        // IDLE LOGIC: Less than 50KB in 30 minutes
        if (timeDiffMin >= 30 && bytesDiff < 50000) {
          console.log(`[Ghost Buster] Kicking IDLE user ${voucherCode} (${macAddress}). Traffic delta: ${bytesDiff} bytes over ${timeDiffMin.toFixed(1)} mins.`);

          await terminateMikrotikSession(voucherCode, siteId).catch(err => {
            console.error(`[Ghost Buster] Failed to kick ${voucherCode}:`, err.message);
          });

          delete trafficTracker[trackingKey];
          kickedCount++;
          continue;
        }

        // If data moved, update the baseline but keep the original timestamp to check over a full 30m window
        if (bytesDiff > 50000) {
            trafficTracker[trackingKey] = { bytes: totalBytes, lastChecked: now };
        }
      } else {
        // First time seeing this session, start tracking
        trafficTracker[trackingKey] = { bytes: totalBytes, lastChecked: now };
      }
    }

    // 3. Cleanup tracker (remove entries for users who are no longer connected)
    const activeKeys = new Set(activeSessions.map((s: any) => `${siteId}_${s['mac-address']}_${s.user}`));
    Object.keys(trafficTracker).forEach(key => {
        if (!activeKeys.has(key)) delete trafficTracker[key];
    });

    console.log(`[Ghost Buster] Cleanup complete. Kicked ${kickedCount} idle users.`);

    return NextResponse.json({
      success: true,
      kickedCount,
      totalChecked: activeSessions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[Ghost Buster] Critical Failure:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
