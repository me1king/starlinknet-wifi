#!/bin/bash

# 1. Run database migrations (Supabase)
echo "🚀 Running database migrations..."
npx prisma migrate deploy

# 2. Start the WhatsApp Bridge in the background
echo "📡 Starting WhatsApp Bridge..."
node scripts/whatsapp-bridge.cjs &

# 3. Start the Next.js Web Server
echo "▲ Starting Next.js Web Server..."
next start -p ${PORT:-3000}
