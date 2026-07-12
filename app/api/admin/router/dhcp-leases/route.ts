import { NextRequest, NextResponse } from 'next/server';
import { getDhcpLeases } from '@/lib/mikrotik';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId') || 'default-site';
    const leases = await getDhcpLeases(siteId);
    return NextResponse.json(leases);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
