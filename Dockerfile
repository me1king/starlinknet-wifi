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

# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Use --legacy-peer-deps to avoid dependency conflicts that might crash the build
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Generate Prisma client with explicit logging
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3000

# Start the application using a script that handles both Next.js and the WhatsApp bridge
CMD ["npm", "start"]
