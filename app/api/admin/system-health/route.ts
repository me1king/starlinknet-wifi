import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { testMikrotikConnection } from '@/lib/mikrotik';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Test Database
        const dbStart = Date.now();
        await prisma.site.findFirst({ where: { id: 'default-site' } });
        const dbStatus = Date.now() - dbStart < 2000 ? 'online' : 'degraded';

        // 2. Test Router (Default Site)
        const routerRes = await testMikrotikConnection('default-site');
        const routerStatus = routerRes.success ? 'online' : 'offline';

        // 3. Test WhatsApp Bridge
        let whatsappStatus = 'offline';
        try {
            const waRes = await fetch('http://localhost:4000/send', {
                method: 'POST',
                body: JSON.stringify({ phoneNumber: 'test', message: 'healthcheck' }),
                signal: AbortSignal.timeout(2000)
            }).catch(() => null);
            // If it returns 400 (missing params) it means the server is UP
            if (waRes && (waRes.status === 400 || waRes.status === 200)) whatsappStatus = 'online';
        } catch (e) {}

        // 4. Test Paystack (Ping API)
        let paystackStatus = 'offline';
        try {
            const payRes = await fetch('https://api.paystack.co/bank', { signal: AbortSignal.timeout(3000) });
            if (payRes.ok) paystackStatus = 'online';
        } catch (e) {}

        return NextResponse.json({
            systems: {
                database: dbStatus,
                router: routerStatus,
                whatsapp: whatsappStatus,
                paystack: paystackStatus,
                webhook: 'online' // Self-reporting
            },
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
