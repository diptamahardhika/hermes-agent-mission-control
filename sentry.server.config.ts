import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  // Set environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",

  // Filter out noise
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEBUG) {
      return null;
    }

    // Filter out known non-actionable errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Skip network errors that are likely transient
      if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
        return null;
      }
      // Skip React hydration errors in development
      if (error.message.includes("Hydration") && process.env.NODE_ENV === "development") {
        return null;
      }
    }

    return event;
  },

  // Custom tags
  initialScope: {
    tags: {
      component: "hermy-hq",
    },
  },
});