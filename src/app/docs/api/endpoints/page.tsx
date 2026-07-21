import Link from "next/link";
import {
  Code,
  ExternalLink,
  Shield,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function APIEndpointsPage() {
  const endpoints = [
    {
      category: "Authentication",
      icon: Shield,
      color: "from-purple-500 to-violet-500",
      items: [
        {
          method: "POST",
          path: "/api/auth/login",
          description: "Authenticate user and get session",
        },
        {
          method: "POST",
          path: "/api/auth/register",
          description: "Create new user account",
        },
        {
          method: "POST",
          path: "/api/auth/callback",
          description: "Handle OAuth callback",
        },
      ],
    },
    {
      category: "Scans",
      icon: Zap,
      color: "from-amber-500 to-orange-500",
      items: [
        {
          method: "POST",
          path: "/api/scans/trigger",
          description: "Trigger a new scan on repository",
        },
        {
          method: "GET",
          path: "/api/scans/[id]",
          description: "Get scan details and results",
        },
        {
          method: "GET",
          path: "/api/scans/[id]/export",
          description: "Export scan results (JSON/PDF)",
        },
        {
          method: "POST",
          path: "/api/scans/fix",
          description: "Auto-generate fix for vulnerability",
        },
      ],
    },
    {
      category: "Teams",
      icon: Code,
      color: "from-blue-500 to-cyan-500",
      items: [
        {
          method: "POST",
          path: "/api/teams",
          description: "Create a new team",
        },
        {
          method: "GET",
          path: "/api/teams/list",
          description: "List user's teams",
        },
        {
          method: "POST",
          path: "/api/teams/members",
          description: "Invite team member",
        },
        {
          method: "DELETE",
          path: "/api/teams/members",
          description: "Remove team member",
        },
        {
          method: "POST",
          path: "/api/teams/accept-invitation",
          description: "Accept team invitation",
        },
      ],
    },
    {
      category: "Billing",
      icon: Shield,
      color: "from-green-500 to-emerald-500",
      items: [
        {
          method: "POST",
          path: "/api/billing/create-checkout",
          description: "Create Stripe checkout session",
        },
        {
          method: "POST",
          path: "/api/webhooks/paystack",
          description: "Handle payment webhook",
        },
      ],
    },
    {
      category: "System",
      icon: CheckCircle2,
      color: "from-gray-500 to-slate-500",
      items: [
        {
          method: "GET",
          path: "/api/health",
          description: "Health check endpoint",
        },
        {
          method: "GET",
          path: "/api/analytics",
          description: "Get usage analytics",
        },
      ],
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center">
            <Code className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-sf-text-primary">
            API Endpoints
          </h1>
        </div>
        <p className="text-lg text-sf-text-secondary max-w-2xl">
          Krypta provides a comprehensive REST API for programmatic access to
          scanning, reporting, and team management features.
        </p>
        <div className="flex gap-4">
          <a
            href="/docs/api/authentication"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Authentication Guide
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-sf-text-primary rounded-lg font-medium hover:bg-black/5 transition-colors"
          >
            Back to Docs
          </a>
        </div>
      </div>

      {/* Base URL */}
      <div className="p-6 bg-black rounded-xl">
        <h2 className="text-sm font-medium text-sf-text-tertiary mb-2">
          Base URL
        </h2>
        <code className="text-lg text-white font-mono">
          https://api.krypta.dev
        </code>
      </div>

      {/* Endpoints */}
      <div className="space-y-8">
        {endpoints.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.category}>
              <h2 className="flex items-center gap-3 text-xl font-semibold text-sf-text-primary mb-4">
                <div
                  className={`h-8 w-8 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center`}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                {category.category}
              </h2>
              <div className="space-y-3">
                {category.items.map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className="p-4 bg-white rounded-lg border border-black/10 hover:border-black/20 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                          endpoint.method === "GET"
                            ? "bg-green-100 text-green-700"
                            : endpoint.method === "POST"
                            ? "bg-blue-100 text-blue-700"
                            : endpoint.method === "DELETE"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <code className="text-sm font-mono text-sf-text-primary">
                          {endpoint.path}
                        </code>
                        <p className="text-sm text-sf-text-secondary">
                          {endpoint.description}
                        </p>
                      </div>
                      <Link
                        href={`/docs/api/endpoints#${endpoint.path
                          .replace("/", "")
                          .replace(/\[/g, "-")
                          .replace(/\]/g, "")}`}
                        className="shrink-0 text-sf-text-tertiary hover:text-sf-accent transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* SDKs */}
      <div className="p-6 bg-gradient-to-r from-sf-accent/5 to-[#F05A3C]/5 rounded-xl border border-sf-accent/20">
        <h2 className="text-lg font-semibold text-sf-text-primary mb-4">
          SDKs & Libraries
        </h2>
        <p className="text-sf-text-secondary mb-4">
          Official SDKs are available for popular languages:
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "JavaScript/Node.js", status: "Available" },
            { name: "Python", status: "Coming Soon" },
            { name: "Go", status: "Coming Soon" },
            { name: "Ruby", status: "Coming Soon" },
            { name: "Java", status: "Coming Soon" },
            { name: "PHP", status: "Coming Soon" },
          ].map((sdk) => (
            <div
              key={sdk.name}
              className="p-4 bg-white rounded-lg border border-black/10"
            >
              <p className="font-medium text-sf-text-primary">{sdk.name}</p>
              <p
                className={`text-sm ${
                  sdk.status === "Available"
                    ? "text-green-600"
                    : "text-sf-text-tertiary"
                }`}
              >
                {sdk.status}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
