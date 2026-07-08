import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // eslint: { ignoreDuringBuilds: true }, // Removed as it's no longer supported in next.config.ts
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      vertx: false,
    };
    return config;
  },
  // @ts-ignore - Turbopack is the default in Next.js 16
  turbopack: {},
};

export default nextConfig;
