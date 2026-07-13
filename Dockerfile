FROM node:20-slim

# Install Chromium and necessary dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    openssl \
    python3 \
    make \
    g++ \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
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

# Set environment variables for Puppeteer and Next.js
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Use --legacy-peer-deps and exclude devDependencies for a lighter build
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Generate Prisma client using exact version to avoid v7 breaking changes
RUN npx prisma@6.19.3 generate

# Build the Next.js application (Skip lint to save memory/time)
RUN npx next build

# Expose the port Next.js runs on
EXPOSE 3000

# Start the application using the bridge server as the entry point
# This runs the WhatsApp worker in the background and the web server in the foreground
CMD ["sh", "-c", "node scripts/whatsapp-bridge.cjs & npm start"]
