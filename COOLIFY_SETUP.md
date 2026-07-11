# Coolify Deployment Guide (Hetzner VPS)

This project is optimized for self-hosting with **Coolify** on your Hetzner server.

## 1. Create a New Application
1. In Coolify dashboard, select **"Applications"** -> **"Add New"**.
2. Connect your GitHub repo and select the `main` branch.
3. Select **"Next.js"** as the framework.

## 2. Environment Variables
Add all variables from `.env.production` into the Coolify **"Variables"** tab.
- **CRITICAL**: Make sure `DATABASE_URL` is set correctly for the Supabase pooler.

## 3. Build & Start Commands
Coolify should auto-detect, but ensure these are set:
- **Build Command**: `npx prisma generate && npm run build`
- **Start Command**: `npm run start`

## 4. WhatsApp Bridge (Persistence)
Because Coolify runs applications in Docker, your WhatsApp session will stay alive even if the server restarts, as long as you use a persistent volume.
1. Go to your application **"Storage"** tab in Coolify.
2. Add a persistent volume for the WhatsApp session:
   - **Mount Path**: `/app/.wwebjs_auth`
   - **Name**: `whatsapp-session`

## 5. Domain Linking
1. Under **"Domains"**, enter: `https://starlinkwifinet.duckdns.org`
2. Coolify will automatically handle the SSL certificate (HTTPS).

## 6. Accessing Logs (QR Code)
Once deployed, click on **"Logs"** in Coolify. Look for the large text QR code to link your phone.
