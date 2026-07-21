import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  environment: process.env.NODE_ENV,
});

Sentry.addIntegration({
  name: "custom-error-boundary",
  setupOnce() {
    // Custom error handling if needed
  },
});
