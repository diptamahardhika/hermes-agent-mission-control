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
  // Fix Turbopack CSP issue: Turbopack uses eval() internally,
  // but Next.js default CSP blocks it in production.
  // Adding unsafe-eval allows Turbopack runtime to function.
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
