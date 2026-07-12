import { NextRequest, NextResponse } from 'next/server';
import { rebootMikrotik } from '@/lib/mikrotik';

export async function POST(req: NextRequest) {
  try {
    const { siteId } = await req.json();
    const result = await rebootMikrotik(siteId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
