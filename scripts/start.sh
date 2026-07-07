#!/bin/bash

# Ensure output is not buffered
export PYTHONUNBUFFERED=1
export NODE_OPTIONS="--no-warnings"

echo "---------------------------------------------------------"
echo "🚀 CLOUD STARTUP INITIATED"
echo "---------------------------------------------------------"

# 1. Run database migrations (Supabase)
echo "📦 Step 1: Database Sync..."
npx prisma migrate deploy

# 2. Start the WhatsApp Bridge in the background
echo "📡 Step 2: Starting WhatsApp Bridge..."
node scripts/whatsapp-bridge.cjs 2>&1 &

# Give it a moment to output the QR
sleep 5

# 3. Start the Next.js Web Server using npx to ensure it's found
echo "▲ Step 3: Starting Web Server..."
exec npx next start -p ${PORT:-3000}
