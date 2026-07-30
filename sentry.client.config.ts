// This file configures Sentry for client-side (browser)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only capture errors in production
  enabled: process.env.NODE_ENV === "production",

  // Performance Monitoring
  tracesSampleRate: 0.1, // Lower for client to reduce noise

  // Set the transaction trace sample rate for profiling
  profilerSampleRate: 0.1,

  // Enable Debug (set to false in production)
  debug: false,

  // Don't send PII
  stripValues: true,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,

  // Ignore specific errors
  ignoreErrors: [
    "NetworkError",
    "Failed to fetch",
    "CORS",
  ],
});
