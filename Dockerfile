# --- STAGE 1: BUILD ---
FROM node:20-slim AS builder

WORKDIR /app

# Install build-time dependencies ONLY
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Generate Prisma client
RUN npx prisma@6.19.3 generate

# Build Next.js
RUN npx next build


# --- STAGE 2: RUNTIME ---
FROM node:20-slim AS runner

WORKDIR /app

# Install ONLY runtime dependencies (Chromium for WhatsApp)
RUN apt-get update && apt-get install -y \
    chromium \
    openssl \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    libxss1 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

# Copy built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

# Start system
CMD ["sh", "-c", "node scripts/whatsapp-bridge.cjs & npm start"]
