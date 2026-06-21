import { NextRequest, NextResponse } from 'next/server';
import { testMikrotikConnection, getMikrotikConfig } from '@/lib/mikrotik';

export async function GET(req: NextRequest) {
  try {
    const config = await getMikrotikConfig();

    console.log('[Test] MikroTik Configuration:');
    console.log(`  Host: ${config.host}`);
    console.log(`  Username: ${config.username}`);
    console.log(`  Timeout: ${config.timeout}ms`);

    const testResult = await testMikrotikConnection();

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      config: {
        host: config.host,
        username: config.username,
        timeout: config.timeout,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}
