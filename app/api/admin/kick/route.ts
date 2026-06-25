import { NextResponse } from 'next/server';
import { terminateMikrotikSession } from '@/lib/mikrotik';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body; // The voucher code or IP

    if (!username) {
      return NextResponse.json({ error: "Missing identity" }, { status: 400 });
    }

    const result = await terminateMikrotikSession(username);

    if (result.success) {
      return NextResponse.json({ success: true, message: "User disconnected" });
    } else {
      return NextResponse.json({ error: result.error || "Failed to disconnect" }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Kick Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
