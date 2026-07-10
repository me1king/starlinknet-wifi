# MikroTik Tailscale Migration Guide

This guide explains how to install Tailscale directly on your MikroTik router so that your hotspot system remains active even when your laptop is closed or offline.

## Current Problem
Your server is currently connecting to your **laptop** (`100.72.4.99`) instead of the router. When you close your laptop, the connection is lost.

## Prerequisites
- **RouterOS v7.11 or later**.
- **Architecture**: ARM, ARM64, or x86_64.
- **Tailscale Account**: You already have this.

---

## Step 1: Install Tailscale on MikroTik

### Option A: Official Package (Recommended)
1. Go to the [MikroTik Download Page](https://mikrotik.com/download).
2. Find your architecture (e.g., ARM64) and download the **"Extra packages"** zip file for your version (e.g., v7.15).
3. Extract the `tailscale-x.xx.x.npk` file.
4. Open **Winbox**, go to **Files**, and drag-and-drop the `.npk` file into the file list.
5. **Reboot** the router (**System -> Reboot**).

### Option B: Check if already available
On newer versions, it might already be available under **VPN -> Tailscale**.

---

## Step 2: Configure Tailscale

1. In Winbox, navigate to **IP -> Tailscale**.
2. Click **Enable**.
3. Go to the **Settings** tab.
4. Click **Log In**. A URL will appear in the router logs (**Log** button on the left).
5. Copy that URL into your browser and authorize the router to join your Tailnet.
6. Once authorized, go to the **Status** tab in Winbox to see your **new Tailscale IP** (it will start with `100.x.x.x`).

---

## Step 3: Update System Configuration

Once you have the new IP (let's say it's `100.11.22.33`):

### 1. Update Cloud Environment (Coolify)
Go to your Coolify dashboard and update the environment variables:
- `MIKROTIK_HOST`: Change from `100.72.4.99` to your **New Router Tailscale IP**.

### 2. Update Local Files
Update your `.env.local` and `.env.production` in this project:
```env
MIKROTIK_HOST=100.xx.xx.xx (New IP)
```

---

## Step 4: Verify Connection

Run the following command on your laptop to ensure the server can reach the router:

```bash
npx tsx scripts/verify-tailscale.ts
```

If it says **"Success"**, you can safely close your laptop!

---

## Troubleshooting
- **No Tailscale Menu**: Ensure you installed the "Extra packages" NPK and rebooted.
- **Can't Ping Router**: Ensure "Accept" rules in MikroTik Firewall (**IP -> Firewall**) allow traffic on the Tailscale interface.
- **Authentication Failed**: Delete the Tailscale interface in Winbox and try enabling it again.
