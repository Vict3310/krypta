import Link from "next/link";
import { ArrowRight, Book, Code, Zap, Shield, Users, FileText, MessageCircle } from "lucide-react";

export default function DocsPage() {
  const sections = [
    {
      title: "Getting Started",
      description: "Learn the basics of Krypta and set up your first scan",
      icon: Zap,
      items: [
        { title: "Introduction", href: "/docs/introduction" },
        { title: "Quick Start Guide", href: "/docs/quick-start" },
        { title: "Installation", href: "/docs/installation" },
      ],
    },
    {
      title: "API Reference",
      description: "Complete API documentation for programmatic access",
      icon: Code,
      items: [
        { title: "API Overview", href: "/docs/api/introduction" },
        { title: "Authentication", href: "/docs/api/authentication" },
        { title: "Endpoints", href: "/docs/api/endpoints" },
      ],
    },
    {
      title: "Integrations",
      description: "Connect Krypta with your favorite tools",
      icon: Shield,
      items: [
        { title: "GitHub Integration", href: "/docs/guides/github" },
        { title: "Slack Notifications", href: "/docs/guides/slack" },
        { title: "CI/CD Pipeline", href: "/docs/guides/cicd" },
      ],
    },
    {
      title: "Team Management",
      description: "Set up and manage your team workspace",
      icon: Users,
      items: [
        { title: "Team Setup", href: "/docs/guides/teams" },
        { title: "Roles & Permissions", href: "/docs/guides/roles" },
        { title: "Invitations", href: "/docs/guides/invitations" },
      ],
    },
    {
      title: "Guides",
      description: "Best practices and advanced configuration",
      icon: Book,
      items: [
        { title: "Scanning Best Practices", href: "/docs/guides/scanning" },
        { title: "Customizing Scans", href: "/docs/guides/customizing" },
        { title: "Security Policies", href: "/docs/guides/policies" },
      ],
    },
    {
      title: "Support",
      description: "Get help and find answers",
      icon: MessageCircle,
      items: [
        { title: "FAQ", href: "/docs/faq" },
        { title: "Contact Us", href: "/docs/contact" },
        { title: "Changelog", href: "/docs/changelog" },
      ],
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-sf-text-primary">
          Documentation
        </h1>
        <p className="text-lg text-sf-text-secondary max-w-2xl">
          Everything you need to secure your codebase with Krypta. From quick setup to advanced configurations.
        </p>
        <div className="flex gap-4">
          <a
            href="/docs/quick-start"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/docs/api/endpoints"
            className="inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-sf-text-primary rounded-lg font-medium hover:bg-black/5 transition-colors"
          >
            API Reference
          </a>
        </div>
      </div>

      {/* Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="p-6 bg-white rounded-xl border border-black/10 hover:border-black/20 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-sf-accent/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-sf-accent" />
              </div>
              <h2 className="text-lg font-semibold text-sf-text-primary mb-2">
                {section.title}
              </h2>
              <p className="text-sm text-sf-text-secondary mb-4">
                {section.description}
              </p>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-sf-text-secondary hover:text-sf-accent transition-colors flex items-center gap-2"
                    >
                      <FileText className="h-3 w-3" />
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="p-6 bg-gradient-to-r from-sf-accent/5 to-[#F05A3C]/5 rounded-xl border border-sf-accent/20">
        <h2 className="text-lg font-semibold text-sf-text-primary mb-4">
          Quick Links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/docs/quick-start"
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-black/10 hover:border-sf-accent/50 transition-colors"
          >
            <Zap className="h-5 w-5 text-sf-accent" />
            <div>
              <p className="font-medium text-sf-text-primary">Quick Start</p>
              <p className="text-sm text-sf-text-secondary">Set up in 5 minutes</p>
            </div>
          </a>
          <a
            href="/docs/api/endpoints"
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-black/10 hover:border-sf-accent/50 transition-colors"
          >
            <Code className="h-5 w-5 text-sf-accent" />
            <div>
              <p className="font-medium text-sf-text-primary">API Docs</p>
              <p className="text-sm text-sf-text-secondary">Programmatic access</p>
            </div>
          </a>
          <a
            href="/docs/guides/github"
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-black/10 hover:border-sf-accent/50 transition-colors"
          >
            <Shield className="h-5 w-5 text-sf-accent" />
            <div>
              <p className="font-medium text-sf-text-primary">GitHub</p>
              <p className="text-sm text-sf-text-secondary">Integrate your repo</p>
            </div>
          </a>
          <a
            href="/docs/faq"
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-black/10 hover:border-sf-accent/50 transition-colors"
          >
            <MessageCircle className="h-5 w-5 text-sf-accent" />
            <div>
              <p className="font-medium text-sf-text-primary">FAQ</p>
              <p className="text-sm text-sf-text-secondary">Common questions</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
