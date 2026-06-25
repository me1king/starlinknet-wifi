import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/device-profiling
 * Update or create device profile
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      macAddress,
      ipAddress,
      deviceType,
      deviceName,
      browserType,
      osVersion,
      siteId = 'default-site',
    } = body;

    if (!macAddress) {
      return NextResponse.json({ error: 'macAddress required' }, { status: 400 });
    }

    // Check if exists
    const existing = await prisma.deviceProfile.findUnique({
      where: { id: macAddress },
    });

    let profile;
    if (existing) {
      profile = await prisma.deviceProfile.update({
        where: { id: macAddress },
        data: {
          ipAddress,
          deviceType,
          deviceName,
          browserType,
          osVersion,
          lastSeen: new Date(),
        },
      });
    } else {
      profile = await prisma.deviceProfile.create({
        data: {
          id: macAddress,
          macAddress,
          ipAddress,
          deviceType,
          deviceName,
          browserType,
          osVersion,
          siteId,
        },
      });
    }

    console.log(`[Profile] Updated ${macAddress}: ${deviceType}`);
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

/**
 * GET /api/device-profiling
 * Get device profiles and statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';
    const sortBy = searchParams.get('sortBy') || 'lastSeen'; // lastSeen, totalSpent, totalSessions
    const limit = parseInt(searchParams.get('limit') || '100');

    const profiles = await prisma.deviceProfile.findMany({
      where: { siteId },
      orderBy: sortBy === 'totalSpent' ? { totalSpent: 'desc' } : { lastSeen: 'desc' },
      take: limit,
    });

    // Group by device type
    const byType = profiles.reduce((acc: Record<string, number>, p) => {
      const type = p.deviceType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      count: profiles.length,
      byDeviceType: byType,
      profiles,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
