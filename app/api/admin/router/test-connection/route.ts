import { NextResponse } from 'next/server';
import { getMikrotikConfig, testMikrotikConnection } from '@/lib/mikrotik';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId') || 'default-site';

  try {
    // 1. Check for Cloud Bridge Sync first (Local-to-Cloud push)
    const heartbeats = (global as any).routerHeartbeats || {};
    const siteData = heartbeats[siteId];
    if (siteData) {
      const lastSeen = new Date(siteData.lastSeen).getTime();
      if (Date.now() - lastSeen < 45000) {
        return NextResponse.json({
          success: true,
          message: `Connected via Cloud Bridge (Last Sync: ${Math.round((Date.now() - lastSeen)/1000)}s ago)`,
          configUsed: { host: 'Cloud Push', port: 0, user: 'router-script', mode: 'CLOUD_BRIDGE' },
          tip: "Your router is pushing data perfectly! Vouchers will be created automatically."
        });
      }
    }

    const config = await getMikrotikConfig(siteId);

    // 2. If Host is set to CLOUD_BRIDGE, we don't attempt direct connection
    if (config.host.toUpperCase() === 'CLOUD_BRIDGE') {
      return NextResponse.json({
        success: false,
        message: "Waiting for Cloud Bridge heartbeat...",
        error: "NO_HEARTBEAT",
        configUsed: { host: 'CLOUD_BRIDGE', mode: 'CLOUD_SYNC' },
        tip: "Your server is in Cloud Mode. Please ensure the 'Heartbeat' script is running on your MikroTik router to link them."
      });
    }

    console.log(`[Diagnostic] Testing connection to ${config.host}:${config.port}`);

    const result = await testMikrotikConnection(siteId);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      error: result.error || 'None',
      configUsed: {
        host: config.host,
        port: config.port,
        user: config.username,
        mode: config.port === 80 || config.port === 443 ? 'REST_API' : 'LEGACY_API'
      },
      tip: result.success
        ? "Your router is communicating perfectly! Vouchers will be created instantly."
        : config.port === 80 || config.port === 443
          ? "Check if 'www' service (Port 80) is enabled in WinBox (IP > Services). If you are on an older RouterOS (<7.1), change MIKROTIK_PORT to 8728 in .env."
          : "Check if 'api' service (Port 8728) is enabled in WinBox (IP > Services). Ensure the admin password in .env matches the router."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
