# Official Cloud Setup Guide (Laptop Offline)

This guide explains how to set up Starlinknet.WIFI officially on **Railway.app** so you can turn off your laptop.

## 1. Railway.app Hosting
1.  Create an account on [Railway.app](https://railway.app).
2.  Connect your GitHub repository.
3.  Add all environment variables from your `.env.production` to the Railway "Variables" tab.
4.  Railway will automatically build and deploy your app. Your new URL will be `https://starlinknet-wifi.up.railway.app`.

## 2. WhatsApp "Free Mode" (Official Phone Link)
We are using a background bridge that uses your own phone. It has **NO LIMITS** and is 100% free.

**How to link:**
1.  Once Railway deploys, open the **Deployment Logs** in the Railway dashboard.
2.  Look for a large **QR Code** printed in the logs.
3.  Open WhatsApp on your phone -> **Linked Devices** -> **Link a Device**.
4.  Scan the QR code from the Railway logs.
5.  Your phone is now linked! It will send vouchers automatically 24/7.

## 3. MikroTik Cloud Bridge (Tailscale)
Since your laptop is off, we need a "Permanent Bridge" between Railway and your router.

1.  On your MikroTik (v7.x), go to **Terminal** and run:
    ```
    /container/config/set ram-high=128M
    /interface/tailscale/add name=ts1
    ```
2.  Follow the MikroTik Tailscale guide to link it to your Tailscale account.
3.  Tailscale will give your router a **Stable IP** (e.g., `100.64.0.5`).
4.  Update `MIKROTIK_HOST` in your Railway Variables to this Tailscale IP.

## 4. Paystack Production
1.  Log in to Paystack Dashboard.
2.  Go to **Settings -> Webhooks**.
3.  Set URL to: `https://starlinknet-wifi.up.railway.app/api/pay/webhook`.
4.  Go to **Settings -> API Keys**.
5.  Set **Live Callback URL** to: `https://starlinknet-wifi.up.railway.app`.

## 5. Captive Portal
1.  Update your `public/mikrotik_login.html` with the Railway URL.
2.  Upload it to the MikroTik `hotspot` folder.

**Your business is now fully cloud-based and professional!**
