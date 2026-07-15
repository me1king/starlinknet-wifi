import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const OUI_MAP: Record<string, string> = {
    'AC:37:43': 'Apple', 'F0:18:98': 'Apple', 'D0:EA:11': 'MikroTik',
    'BC:D1:D3': 'Samsung', '00:15:99': 'Samsung', '8C:FD:F4': 'Huawei',
    '38:D2:69': 'TECNO', '00:08:22': 'Infinix', '70:2E:D9': 'Xiaomi'
};

export async function GET() {
    try {
        const sessions = await prisma.activeSession.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' }
        });

        const stats: Record<string, number> = {};
        sessions.forEach(s => {
            const oui = s.macAddress?.substring(0, 8).toUpperCase();
            const brand = OUI_MAP[oui || ''] || 'Others';
            stats[brand] = (stats[brand] || 0) + 1;
        });

        const formatted = Object.entries(stats).map(([name, count]) => ({
            name,
            value: Math.round((count / sessions.length) * 100)
        })).sort((a, b) => b.value - a.value);

        return NextResponse.json(formatted);
    } catch (error: any) {
        return NextResponse.json([]);
    }
}
