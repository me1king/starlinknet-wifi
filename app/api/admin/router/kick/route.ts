import { NextResponse } from 'next/server';
import { terminateMikrotikSession } from '@/lib/mikrotik';

export async function POST(request: Request) {
  try {
    const { username, siteId } = await request.json();
    if (!username) {
      return NextResponse.json({ error: "Missing identity" }, { status: 400 });
    }

    const result = await terminateMikrotikSession(username, siteId);

    if (result.success) {
      return NextResponse.json({ success: true, message: "User disconnected" });
    } else {
      return NextResponse.json({ success: false, error: result.error || "Failed to disconnect" }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Kick User Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
