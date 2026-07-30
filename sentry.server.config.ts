// This file configures Sentry for server-side (SSR, API routes, edge)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // DSN — get yours from Sentry project settings > Client Keys
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Set the transaction trace sample rate for profiling
  profilerSampleRate: 1.0,

  // Enable Debug (set to false in production)
  debug: false,

  // Ignore specific errors (noise reduction)
  ignoreErrors: [
    // Common browser noise
    "NetworkError",
    "Failed to fetch",
    "CORS",
    // Next.js specific
    "Loading failed for the <module> with",
  ],

  // Filter transactions by route group
  allowUrls: ["https://pxxl.vercel.app"],
});
