export const metadata = {
  title: "Documentation - Krypta",
  description: "Learn how to use Krypta to secure your codebase",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 hidden w-64 h-full overflow-y-auto border-r border-black/10 lg:block">
          <div className="sticky top-0 p-6 bg-white">
            <a href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <span className="font-semibold text-sf-text-primary">Krypta</span>
            </a>
          </div>
          <nav className="p-3 sm:p-4">
            <div className="mb-6">
              <h3 className="px-3 mb-2 text-xs font-semibold text-sf-text-tertiary uppercase tracking-wider">
                Getting Started
              </h3>
              <ul className="space-y-1">
                <li>
                  <a
                    href="/docs/introduction"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Introduction
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/quick-start"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Quick Start
                  </a>
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="px-3 mb-2 text-xs font-semibold text-sf-text-tertiary uppercase tracking-wider">
                API Reference
              </h3>
              <ul className="space-y-1">
                <li>
                  <a
                    href="/docs/api/introduction"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    API Overview
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/api/authentication"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Authentication
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/api/endpoints"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Endpoints
                  </a>
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="px-3 mb-2 text-xs font-semibold text-sf-text-tertiary uppercase tracking-wider">
                Integrations
              </h3>
              <ul className="space-y-1">
                <li>
                  <a
                    href="/docs/guides/github"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    GitHub Integration
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/guides/slack"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Slack Notifications
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/guides/cicd"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    CI/CD Pipeline
                  </a>
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="px-3 mb-2 text-xs font-semibold text-sf-text-tertiary uppercase tracking-wider">
                Guides
              </h3>
              <ul className="space-y-1">
                <li>
                  <a
                    href="/docs/guides/teams"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Team Setup
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/guides/scanning"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Scanning Best Practices
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="px-3 mb-2 text-xs font-semibold text-sf-text-tertiary uppercase tracking-wider">
                Support
              </h3>
              <ul className="space-y-1">
                <li>
                  <a
                    href="/docs/faq"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/contact"
                    className="block px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-64">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
