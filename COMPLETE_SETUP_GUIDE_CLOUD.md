# Professional Cloud Setup Guide (Hetzner VPS + Coolify)

This guide explains how to set up Starlinknet.WIFI on a **$4 Hetzner VPS** using **Coolify**. This replaces Vercel, Railway, and Ngrok, allowing you to turn off your laptop forever.

## 1. Get your Server
1.  Sign up at [Hetzner Cloud](https://www.hetzner.com/cloud).
2.  Create a new "Project" and click **Add Server**.
3.  **Location:** Choose the one closest to you.
4.  **Image:** Ubuntu 24.04.
5.  **Type:** Arm64 -> **CAX11** (Costs ~$4/month, has 4GB RAM which is perfect).
6.  **SSH Keys:** Add your SSH key (or use a password if you must).
7.  Click **Create & Buy Now**. Note your **Server IP**.

## 2. Install Coolify
1.  Open your terminal (PowerShell or Command Prompt) and log into your server:
    ```bash
    ssh root@YOUR_SERVER_IP
    ```
2.  Run this "One-Click" installer:
    ```bash
    curl -fsSL https://get.coollabs.io/coolify/install.sh | bash
    ```
3.  Once finished, go to `http://YOUR_SERVER_IP:8000` in your browser.
4.  Create your admin account.

## 3. Connect your GitHub & Deploy
1.  In Coolify, go to **Sources** -> **Add New Source** -> **GitHub App**. Follow the prompts to link your repo.
2.  Go to **Projects** -> **Add New Project**.
3.  Click **Add New Resource** -> **Public Repository** or **Private Repository**.
4.  Select your `mynet` repository and the `main` branch.
5.  Coolify will detect the `Dockerfile`.
6.  **Important:** Under **Domains**, set your domain (e.g., `https://wifi.yourdomain.com`).

## 4. WhatsApp Persistence (CRITICAL)
To stay logged into WhatsApp even after server restarts:
1.  In Coolify, go to your **Application Settings** -> **Storage**.
2.  Click **Add Storage**.
3.  **Name:** `whatsapp-session`
4.  **Destination Path:** `/app/.wwebjs_auth`
5.  This saves your login to the server's hard drive.

## 5. Environment Variables
In the **Variables** tab of your Coolify application, add all variables from your `.env.production`.
*   Make sure `NEXT_PUBLIC_BASE_URL` is set to your new domain (e.g., `https://wifi.yourdomain.com`).
*   Ensure `DATABASE_URL` (Supabase) is correct.

## 6. Linking WhatsApp
1.  Deploy the app.
2.  Once deployed, go to the **Logs** tab in Coolify.
3.  Look for the **QR Code**.
4.  Open WhatsApp on your phone -> **Linked Devices** -> **Link a Device**.
5.  Scan the QR code from the logs.
6.  **You are now linked 24/7!**

## 7. Update MikroTik & Paystack
1.  **Paystack:** Update your Webhook and Callback URLs to `https://wifi.yourdomain.com/api/pay/webhook`.
2.  **MikroTik:** In your Hotspot `login.html`, update the URL to `https://wifi.yourdomain.com`.

**Your business is now 100% automated on your own private cloud!**
