import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // Allow Tailscale and local network origins so dev server assets
  // (fonts, HMR, JS chunks) aren't blocked when accessed via 100.x.x.x
  allowedDevOrigins: [
    "100.102.9.63",
    "192.168.10.120",
    "localhost",
    "pradiptas-macbook-pro-m4.flamingo-justitia.ts.net",
  ],
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https:; style-src 'self' 'unsafe-inline' blob: https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https: ws: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:;",
          },
        ],
      },
    ];
  },
};

// ─── Sure Finance Dashboard ───
// SURE_API_TOKEN and SURE_URL are defined in .env.example but not used in config
// Removed unused sureEnv block

// Sentry configuration
const sentryConfig = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  silent: !process.env.SENTRY_DEBUG,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  // tunnelRoute removed — no corresponding route exists, causes 404 in production
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Jobs
  automaticVercelMonitors: true,
};

export default withSentryConfig(nextConfig, sentryConfig);

// Sure Finance Dashboard env vars
// These are exposed to server-side code via runtime config
