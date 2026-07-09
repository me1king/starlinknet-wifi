import { sendVoucherWhatsApp as sendViaBridge } from './whatsapp-cloud';
export { sendPersonalAdminAlert } from './whatsappPersonal';

/**
 * GENERIC WHATSAPP SENDER
 * -----------------------
 * Sends a raw message via the bridge or fallback.
 */
export async function sendGenericWhatsApp(phoneNumber: string, message: string) {
    // 1. Try Bridge
    try {
        const res = await fetch('http://localhost:4000/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, message })
        });
        if (res.ok) return { success: true };
    } catch (e) {}

    // 2. Fallback to Green API
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const apiToken = process.env.GREEN_API_TOKEN;

    if (instanceId && apiToken) {
        try {
            let normalized = phoneNumber.replace(/\D/g, '');
            const chatId = (normalized.startsWith('0') ? '254' + normalized.substring(1) : normalized) + '@c.us';
            const res = await fetch(`https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, message })
            });
            if (res.ok) return { success: true };
        } catch (e) {}
    }

    return { success: false, error: "All senders failed" };
}

/**
 * MASTER WHATSAPP SENDER
 * -----------------------
 * Automatically chooses the best way to send a message.
 * 1. Tries the Local/Cloud Bridge (Free)
 * 2. Falls back to Green API (if configured)
 */
export async function sendVoucherToCustomer(phoneNumber: string, voucherCode: string, planName: string, amount: number) {
    const message = `🎫 *YOUR WIFI VOUCHER* 🎫\n\n` +
                    `Plan: ${planName}\n` +
                    `Amount: KES ${amount}\n` +
                    `Code: *${voucherCode}*\n\n` +
                    `Thank you for choosing Starlinknet.WIFI!`;

    return await sendGenericWhatsApp(phoneNumber, message);
}
