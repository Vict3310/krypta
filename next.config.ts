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
          // Content-Security-Policy is set per-request in src/proxy.ts
          // (nonce-based — see proxy for the full policy).
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
