import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel-compatible settings
  output: undefined, // default — Vercel handles this automatically
  images: {
    unoptimized: false,
  },
  // Allow Tailscale and local network origins so dev server assets
  // (fonts, HMR, JS chunks) aren't blocked when accessed via 100.x.x.x
  allowedDevOrigins: [
    "100.102.9.63",
    "192.168.10.120",
    "localhost",
    "pradiptas-macbook-pro-m4.flamingo-justitia.ts.net",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
