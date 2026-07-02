# 🚀 Starlinknet.WIFI Operational Guide

This guide contains everything you need to keep the system running 24/7. **Do not delete any files.**

## 🛠 1. Emergency Router Rebuild
If the MikroTik is ever reset or flashed, paste this into the terminal:
```bash
/ip dhcp-client add interface=ether1 disabled=no; /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade; /ip address add address=10.0.0.1/24 interface=ether3; /ip pool add name=hs-pool ranges=10.0.0.10-10.0.0.250; /ip dhcp-server add name=hs-dhcp interface=ether3 address-pool=hs-pool disabled=no; /ip dhcp-server network add address=10.0.0.0/24 gateway=10.0.0.1 dns-server=10.0.0.1; /ip dns set allow-remote-requests=yes servers=8.8.8.8; /ip service enable www; /ip service set www port=80; /user set admin password=Hazy.123; /ip hotspot profile set default hotspot-address=10.0.0.1 html-directory=hotspot login-by=http-pap; /ip hotspot add name=Starlinknet interface=ether3 address-pool=hs-pool profile=default disabled=no; /file add name=hotspot/login.html contents="<!DOCTYPE html><html><head><script>var d='https://oil-cinnamon-starfish.ngrok-free.dev?mac='+encodeURIComponent('$(mac)')+'&ip='+encodeURIComponent('$(ip)')+'&link-login='+encodeURIComponent('$(link-login-only)')+'&link-orig='+encodeURIComponent('$(link-orig)');window.location.replace(d);</script></head><body><div style='text-align:center;margin-top:100px;'><h2>Starlinknet.WIFI</h2><p>Redirecting to portal...</p></div></body></html>"
```

## 🌐 2. Tunnel Maintenance (Ngrok)
The system depends on your laptop stay connected. If you restart your laptop:
1. Open Terminal.
2. Run: `.\ngrok.exe tcp 10.0.0.1:80`
3. Copy the **Forwarding Port** (e.g., 29988).
4. Update `MIKROTIK_PORT` in your `.env.local` AND in **Vercel Settings**.

## 📊 3. Admin Dashboard
- **URL**: `https://fulifi.vercel.app/admin/dashboard`
- **Actions**:
  - **Kick User**: Disconnects a user immediately.
  - **Extend Time**: Adds minutes to an active voucher.
  - **WhatsApp List**: View and copy customer numbers for marketing.

## 💾 4. Database Backups
Your local database is stored in `prisma/dev.db`. 
- **Backup**: Copy this file to a USB drive once a week.
- **Restore**: If you lose data, replace the file with your backup.

## 📱 5. WhatsApp Notifications
Notifications are sent via Green API. If they stop working, check your `GREEN_API_TOKEN` in `.env.local`.

## ☁️ 6. Cloud Migration (Scaling Up)
When you are ready to move your database to the cloud (so it stays on even if your laptop is off):
1.  **Supabase**: Create a free project at [supabase.com](https://supabase.com).
2.  **Environment**: Replace `DATABASE_URL` in `.env.local` with the one from Supabase.
3.  **Sync**: Run `npx prisma db push` in your terminal.

## 🔄 7. Router Maintenance
To keep your MikroTik fast, set it to reboot automatically every week. Paste this in the terminal:
```bash
/system scheduler add name=AutoReboot interval=7d start-time=04:00:00 on-event="/system reboot"
```
