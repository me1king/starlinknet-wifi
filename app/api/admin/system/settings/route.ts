import { NextResponse } from 'next/server';
import { setTetheringBlock } from '@/lib/mikrotik';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { blockTethering, siteId } = await request.json();

    if (blockTethering === undefined) {
      return NextResponse.json({ error: "Missing setting" }, { status: 400 });
    }

    const currentSiteId = siteId || 'default-site';

    // 1. Update Database
    await prisma.systemSetting.upsert({
        where: { id: 'global' },
        update: { blockTethering },
        create: { id: 'global', blockTethering }
    });

    // 2. Update Router Hardware
    const result = await setTetheringBlock(blockTethering, currentSiteId);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
