import {
  CheckCircle2,
  Code,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function GitHubIntegrationPage() {
  const steps = [
    {
      number: 1,
      title: "Install Krypta GitHub App",
      description:
        "Add Krypta to your GitHub organization or account from the GitHub Marketplace.",
      icon: CheckCircle2,
    },
    {
      number: 2,
      title: "Select Repositories",
      description:
        "Choose which repositories Krypta should scan. You can select all or specific repos.",
      icon: CheckCircle2,
    },
    {
      number: 3,
      title: "Configure Webhook",
      description:
        "Krypta will automatically set up a webhook to receive push events and trigger scans.",
      icon: CheckCircle2,
    },
    {
      number: 4,
      title: "Start Scanning",
      description:
        "Scans run automatically on every push and pull request. View results in your dashboard.",
      icon: CheckCircle2,
    },
  ];

  const features = [
    {
      title: "Push Event Scanning",
      description:
        "Automatically trigger scans on every push to your connected repositories.",
    },
    {
      title: "Pull Request Analysis",
      description:
        "Get security feedback on your pull requests before merging.",
    },
    {
      title: "Commit History Scanning",
      description:
        "Scan historical commits to find previously introduced vulnerabilities.",
    },
    {
      title: "Branch Protection",
      description:
        "Configure branch protection rules to block merges with critical vulnerabilities.",
    },
    {
      title: "Webhook Integration",
      description:
        "Receive real-time notifications about scan results and security events.",
    },
    {
      title: "Repository Settings",
      description:
        "Customize scan behavior per repository with include/exclude paths and severity thresholds.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center">
            <Code className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-sf-text-primary">
            GitHub Integration
          </h1>
        </div>
        <p className="text-lg text-sf-text-secondary max-w-2xl">
          Connect your GitHub repositories to Krypta for automated security
          scanning on every push and pull request.
        </p>
        <div className="flex gap-4">
          <a
            href="https://github.com/apps/krypta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors"
          >
            Install GitHub App
            <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-sf-text-primary rounded-lg font-medium hover:bg-black/5 transition-colors"
          >
            Back to Docs
          </Link>
        </div>
      </div>

      {/* Setup Steps */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-sf-text-primary">Setup Guide</h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex gap-4 p-6 bg-white rounded-xl border border-black/10"
            >
              <div className="shrink-0">
                <div className="h-10 w-10 rounded-full bg-sf-accent/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-sf-accent">
                    {step.number}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-sf-text-primary">
                    {step.title}
                  </h3>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sf-text-secondary">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-sf-text-primary">
          Integration Features
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-5 bg-white rounded-xl border border-black/10 hover:border-black/20 transition-colors"
            >
              <h3 className="font-semibold text-sf-text-primary mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-sf-text-secondary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="p-6 bg-gradient-to-r from-sf-accent/5 to-[#F05A3C]/5 rounded-xl border border-sf-accent/20">
        <h2 className="text-lg font-semibold text-sf-text-primary mb-4">
          Configuration Options
        </h2>
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg border border-black/10">
            <h3 className="font-medium text-sf-text-primary mb-2">
              Repository Settings
            </h3>
            <ul className="space-y-2 text-sm text-sf-text-secondary">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                Min severity level (Low, Medium, High, Critical)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                Include/exclude file paths
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                Enable/disable AI-powered scanning
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                Auto-create pull requests for fixes
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                Scan only changed files (diff scanning)
              </li>
            </ul>
          </div>

          <div className="p-4 bg-white rounded-lg border border-black/10">
            <h3 className="font-medium text-sf-text-primary mb-2">
              Webhook Events
            </h3>
            <ul className="space-y-2 text-sm text-sf-text-secondary">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                push - Trigger scan on push events
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                pull_request - Scan on PR creation/update
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-sf-accent" />
                check_run - Custom check run for detailed results
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-amber-900">
              Troubleshooting
            </h2>
            <div className="space-y-2 text-sm text-amber-800">
              <p>
                <strong>Scans not triggering?</strong> Check that the webhook is
                properly configured in your repository settings.
              </p>
              <p>
                <strong>Permission denied?</strong> Ensure Krypta has read access
                to your repositories.
              </p>
              <p>
                <strong>Scan failures?</strong> Review the scan logs in your
                dashboard for specific error details.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div className="flex items-center justify-between p-6 bg-white rounded-xl border border-black/10">
        <div className="space-y-1">
          <h3 className="font-semibold text-sf-text-primary">
            Next Steps
          </h3>
          <p className="text-sm text-sf-text-secondary">
            Learn how to integrate Krypta with Slack or set up CI/CD
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/docs/guides/slack"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-sf-text-primary border border-black/20 rounded-lg hover:bg-black/5 transition-colors"
          >
            Slack Guide
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/guides/cicd"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            CI/CD Guide
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
