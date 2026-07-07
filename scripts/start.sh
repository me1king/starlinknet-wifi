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

# 2. Start the WhatsApp Bridge (Foreground temporarily to force QR code visibility)
echo "📡 Step 2: Starting WhatsApp Bridge..."
echo "Wait for the QR Code below..."

# We run the bridge in the background but redirect its output to the main log
node scripts/whatsapp-bridge.cjs 2>&1 &

# Give the bridge a moment to generate the QR code
sleep 5

# 3. Start the Next.js Web Server
echo "▲ Step 3: Starting Web Server..."
next start -p ${PORT:-3000}
