# 🛠️ STARLINKNET.WIFI: OPERATIONAL TROUBLESHOOTING GUIDE

This guide explains how to handle the most common issues you might face in production.

---

## 1. M-Pesa Payment Issues 💰
**Problem**: Customer paid, but didn't get a voucher.

*   **Check the Dashboard**: Look at the "Recent Transactions" table.
    *   **Status "pending"**: M-Pesa hasn't sent the confirmation yet. Wait 1 minute.
    *   **Status "failed"**: The customer cancelled or has no balance.
*   **Manual Fix**: If you see the payment in your M-Pesa Till/Paybill but not on the dashboard:
    1.  Copy the **M-Pesa Transaction Reference** (e.g., QRL7123...).
    2.  Click the **"Reconcile"** button on the dashboard.
    3.  Paste the reference and hit Enter. The system will manually search and provision the session.

---

## 2. MikroTik "System Offline" 🔴
**Problem**: Dashboard says "System Offline" or "Test Connection" fails.

*   **Check the Tunnel**: In MikroTik Terminal, type `/ping 10.0.0.1`.
    *   **No Reply**: Your WireGuard/Tailscale tunnel is down. Restart the router.
*   **Check Credentials**: Ensure your `MIKROTIK_PASSWORD` in Coolify matches the one on the router (`Hazy.123`).
*   **API Port**: Ensure Port `8728` is enabled in WinBox (**IP -> Services**).

---

## 3. WhatsApp Vouchers Not Sending 📱
**Problem**: Payments are successful, but no WhatsApp message is received.

*   **Check the Bridge**: Is the terminal on your local PC running `node scripts/whatsapp-bridge.cjs`?
*   **Check Phone Connection**: Is your phone connected to the internet? Open WhatsApp on your phone and ensure it's not "logging out."
*   **Scan Again**: If the bridge logs say "Auth Failure," close the terminal, run it again, and scan the NEW QR code.

---

## 4. "Database Link Interrupted" Error 🗄️
**Problem**: The dashboard shows a message about database interruption.

*   **Supabase Sleep**: If you haven't had payments for a long time, Supabase sometimes "pauses" the pooler.
*   **Fix**: Refresh the dashboard. My new `prismaRetry` code will automatically wake it up after 2-3 retries.

---

## 5. User Connected but No Redirection 🌐
**Problem**: User joins WiFi, but the billing page doesn't pop up.

*   **DNS Issue**: Ensure the MikroTik DNS settings are correct. Run the "Fix Everything" command again.
*   **Walled Garden**: Ensure `starlinkwifinet.duckdns.org` is allowed in the Walled Garden.
*   **HTTPS Redirect**: Some Android phones struggle with HTTPS redirection. Tell the user to open `http://logout` or `http://10.5.50.1` in their browser to force the portal to open.

---

## ⚡ Emergency "Muke" (Reboot)
If everything feels slow or stuck, use the **Red "Muke (Reboot)"** button on the dashboard. It will remotely reboot your MikroTik and refresh all sessions.

**Status: You are now equipped to manage the shop like a pro!** 🟢🔥
