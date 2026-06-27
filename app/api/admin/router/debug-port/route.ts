import { NextResponse } from 'next/server';
import net from 'net';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host') || process.env.MIKROTIK_HOST || '192.168.150.1';
  const port = parseInt(searchParams.get('port') || '80');

  return new Promise<NextResponse>((resolve) => {
    const socket = new net.Socket();
    const start = Date.now();

    socket.setTimeout(5000);

    socket.on('connect', () => {
      const elapsed = Date.now() - start;
      socket.destroy();
      resolve(NextResponse.json({
        success: true,
        message: `Port ${port} on ${host} is OPEN! Handshake took ${elapsed}ms.`
      }));
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(NextResponse.json({
        success: false,
        message: `Port ${port} on ${host} is CLOSED (Timeout). The router is blocking the laptop.`
      }));
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve(NextResponse.json({
        success: false,
        message: `Error connecting to ${host}:${port} -> ${err.message}`
      }));
    });

    socket.connect(port, host);
  });
}
