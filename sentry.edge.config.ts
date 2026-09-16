import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  // Set environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",

  // Filter out noise
  beforeSend(event, hint) {
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DEBUG) {
      return null;
    }

    const error = hint.originalException;
    if (error instanceof Error) {
      if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
        return null;
      }
    }

    return event;
  },

  initialScope: {
    tags: {
      component: "hermy-hq",
    },
  },
});