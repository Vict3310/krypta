import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://api.paystack.co https://sentry.io https://*.sentry.io https://cloudflareinsights.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // CORS headers for webhook endpoints — restricted to known providers only
      {
        source: "/api/webhooks/github",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://github.com" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-hub-signature-256, x-github-event, x-github-delivery" },
        ],
      },
      {
        source: "/api/webhooks/paystack",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://api.paystack.co" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-paystack-signature" },
        ],
      },
    ];
  },
};

export default nextConfig;
