# 🛰️ MikroTik Physical & Software Connection Guide

This guide ensures your MikroTik router communicates perfectly with the Starlinknet.WIFI cloud system.

## 1. Physical Connectivity
- **Starlink/ISP**: Connect your Starlink Ethernet (via bypass mode or adapter) to **Port 1 (WAN)** on the MikroTik.
- **Local Network (AP)**: Connect your WiFi Access Points (Ubiquiti, TP-Link, etc.) to **Ports 2-5 (LAN)** on the MikroTik.
- **Internet Access**: The MikroTik MUST have internet access to reach the Supabase database.

## 2. MikroTik Configuration (WinBox)

### A. Enable API Access
The system needs to "talk" to the router to create vouchers.
1. Open WinBox -> **IP** -> **Services**.
2. Find `api` (Port 8728) or `www` (Port 80).
3. Ensure they are **Enabled** (not grayed out).
4. **Security Tip**: Set `Available From` to `0.0.0.0/0` only if you have a firewall. If you are using a VPN or local connection, set the specific range.

### B. Hotspot Setup
1. Go to **IP** -> **Hotspot** -> **Hotspot Setup**.
2. Run the wizard on your LAN bridge (e.g., `bridge-local` or `ether2`).
3. Set DNS Name to: `starlinknet.wifi` (Matches your login page).

### C. Password Sync
Ensure the router admin password matches your `.env` file:
- Run this in the MikroTik Terminal:
  ```
  /user set admin password=Hazy.123
  ```
- Your `.env` should have: `MIKROTIK_PASSWORD="Hazy.123"`

## 3. Remote Access (If Cloud Deployed)
If your Next.js app is on Vercel/Cloud and the router is in your shop:
- **Option 1: Port Forwarding**: Forward Port 8728 on your main ISP router to the MikroTik IP.
- **Option 2: VPN (Recommended)**: Use a MikroTik WireGuard or ZeroTier tunnel so the cloud can reach the router securely.
- **Option 3: Bridge Script**: Use the built-in "Cloud Bridge" feature in the dashboard which allows the router to "call home" to the cloud.

## 4. Verification
1. Log in to your Admin Dashboard.
2. Click **"Test Connection"**.
3. If it turns **Green**, you are 100% connected!
