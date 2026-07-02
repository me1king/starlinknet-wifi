/**
 * Sends a WhatsApp notification to the admin's personal number using Green API.
 */
export async function sendPersonalAdminAlert(amount: number, customerPhone: string, voucherCode: string) {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const apiToken = process.env.GREEN_API_TOKEN;
  const personalNumber = process.env.MY_PERSONAL_WHATSAPP_NUMBER;

  if (!instanceId || !apiToken || !personalNumber) {
    console.warn("[WhatsApp] Missing Green API credentials or personal number. Skipping alert.");
    return;
  }

  // Format the target destination.
  // For Kenya numbers, replace the leading 0 or + with 254 (e.g., 254712345678@c.us)
  const chatId = `${personalNumber}@c.us`;

  // Construct the URL. Green API usually uses a token that isn't a full URL.
  // If the user provided a full URL in the token env var, we should be careful.
  let url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

  // If apiToken is actually a full URL (which seems to be the case in .env),
  // we adjust to prevent malformed URL
  if (apiToken.startsWith('http')) {
      // It's possible the user meant the API Token is something else
      // or they put the wrong value in .env.
      // Most Green API tokens are hex strings.
      console.warn("[WhatsApp] GREEN_API_TOKEN in .env looks like a URL. This might be incorrect.");
  }

  // Design a clean text layout using template literals
  const messageText = `⚡ *STARLINKNET.WIFI INCOMING PAYMENT* ⚡\n\n` +
                      `💰 *Amount:* KSh ${amount}\n` +
                      `📱 *From:* ${customerPhone}\n` +
                      `🔑 *Voucher Pin:* ${voucherCode}\n\n` +
                      `🟢 _System operating normally. Session pushed to router._`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chatId,
        message: messageText
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("[WhatsApp] Gateway rejection log:", errData);
    } else {
      console.log("[WhatsApp] Admin alert sent successfully.");
    }
  } catch (error) {
    console.error("[WhatsApp] Failed to connect to the external WhatsApp server:", error);
  }
}

/**
 * Sends a daily revenue summary to the admin.
 */
export async function sendDailyRevenueSummary(amount: number, userCount: number, topPackage: string) {
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const apiToken = process.env.GREEN_API_TOKEN;
    const personalNumber = process.env.MY_PERSONAL_WHATSAPP_NUMBER;

    if (!instanceId || !apiToken || !personalNumber) {
        console.warn("[WhatsApp Summary] Missing credentials. Skipping.");
        return;
    }

    const chatId = `${personalNumber}@c.us`;
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

    const messageText = `📊 *STARLINKNET DAILY SUMMARY* 📊\n\n` +
                        `💰 *Total Revenue:* KSh ${amount}\n` +
                        `👥 *Active Users:* ${userCount}\n` +
                        `🏆 *Top Seller:* ${topPackage}\n\n` +
                        `💡 _Revenue is automatically settled to your Paystack balance._`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: chatId,
                message: messageText
            })
        });

        if (response.ok) {
            console.log("[WhatsApp Summary] Daily report sent.");
        }
    } catch (e) {
        console.error("[WhatsApp Summary] Failed to send:", e);
    }
}
