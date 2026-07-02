/**
 * WHATSAPP CONNECTION TEST SCRIPT
 * Run: node scripts/test-whatsapp.js
 */
require('dotenv').config({ path: '.env.local' });

async function testWhatsApp() {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const apiToken = process.env.GREEN_API_TOKEN;
  const personalNumber = process.env.MY_PERSONAL_WHATSAPP_NUMBER;

  console.log("🚀 Testing WhatsApp Integration...");
  console.log(`📡 Using Instance: ${instanceId}`);

  const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
  const message = "✅ *STARLINKNET.WIFI SYSTEM LINKED!*\n\nYour WhatsApp is now officially connected to the billing portal. You will receive live payment alerts here.";

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${personalNumber}@c.us`,
        message: message
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log("✅ SUCCESS! Check your WhatsApp for the confirmation message.");
    } else {
      console.error("❌ FAILED:", data);
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
  }
}

testWhatsApp();
