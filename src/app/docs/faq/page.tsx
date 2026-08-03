"use client";

import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Shield,
  Zap,
  Users,
  CreditCard,
  Code,
} from "lucide-react";
import { useState } from "react";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  category: "general" | "security" | "getting-started" | "teams" | "billing" | "api";
}

const faqItems: FAQItem[] = [
  {
    question: "What is Krypta?",
    answer: (
      <p>
        Krypta is an AI-powered security scanning platform that helps developers
        identify and fix vulnerabilities in their codebase. It provides
        plain-English explanations of security issues and suggests fixes
        automatically.
      </p>
    ),
    category: "general",
  },
  {
    question: "How does Krypta protect my code?",
    answer: (
      <div className="space-y-3">
        <p>
          Krypta uses advanced AI models to analyze your code for common
          security vulnerabilities including:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sf-text-secondary">
          <li>SQL Injection</li>
          <li>XSS (Cross-Site Scripting)</li>
          <li>Authentication bypasses</li>
          <li>Data exposure risks</li>
          <li>Dependency vulnerabilities</li>
        </ul>
        <p>All scans are performed securely with zero code retention.</p>
      </div>
    ),
    category: "security",
  },
  {
    question: "How quickly can I get started?",
    answer: (
      <p>
        You can set up Krypta in under 5 minutes. Simply connect your GitHub
        repository, and our AI will begin scanning immediately. No complex
        configuration needed.
      </p>
    ),
    category: "getting-started",
  },
  {
    question: "How do I connect my repository?",
    answer: (
      <div className="space-y-3">
        <p>
          Navigate to the Repositories page in your dashboard and click &quot;Add
          Repository&quot;. You&apos;ll be prompted to authorize the Krypta GitHub app and
          select which repositories to scan.
        </p>
        <div className="p-4 bg-black/5 rounded-lg">
          <p className="text-sm text-sf-text-secondary">
            <strong>Tip:</strong> Krypta only needs read access to your
            repositories. It never pushes code.
          </p>
        </div>
      </div>
    ),
    category: "getting-started",
  },
  {
    question: "How do team roles work?",
    answer: (
      <div className="space-y-3">
        <p>Krypta supports four team roles with different permissions:</p>
        <ul className="space-y-2">
          <li className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-sf-accent/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-sf-accent">O</span>
            </div>
            <div>
              <p className="font-medium text-sf-text-primary">Owner</p>
              <p className="text-sm text-sf-text-secondary">
                Full access to all settings, billing, and team management
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-600">A</span>
            </div>
            <div>
              <p className="font-medium text-sf-text-primary">Admin</p>
              <p className="text-sm text-sf-text-secondary">
                Can manage repositories and view scan results
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-green-600">D</span>
            </div>
            <div>
              <p className="font-medium text-sf-text-primary">Developer</p>
              <p className="text-sm text-sf-text-secondary">
                Can view scan results and fix vulnerabilities
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-gray-500/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-gray-600">V</span>
            </div>
            <div>
              <p className="font-medium text-sf-text-primary">Viewer</p>
              <p className="text-sm text-sf-text-secondary">
                Read-only access to scan results
              </p>
            </div>
          </li>
        </ul>
      </div>
    ),
    category: "teams",
  },
  {
    question: "How do I invite team members?",
    answer: (
      <div className="space-y-3">
        <p>
          Go to Settings → Team, then click &quot;Invite Member&quot;. Enter their email
          and select a role. They&apos;ll receive an invitation link that expires
          after 7 days.
        </p>
        <p>
          You can also share the team invitation token directly with team members
          for quick onboarding.
        </p>
      </div>
    ),
    category: "teams",
  },
  {
    question: "What payment methods do you accept?",
    answer: (
      <p>
        We accept all major credit cards (Visa, Mastercard, Amex) and payments
        via Paystack. Invoices are available for annual plans.
      </p>
    ),
    category: "billing",
  },
  {
    question:
      "Can I cancel my subscription at any time?",
    answer: (
      <p>
        Yes, you can cancel your subscription at any time. You&apos;ll continue to
        have access to your plan features until the end of your current billing
        period.
      </p>
    ),
    category: "billing",
  },
  {
    question: "How do I use the Krypta API?",
    answer: (
      <div className="space-y-3">
        <p>
          Krypta provides a REST API for programmatic access. You&apos;ll need to
          generate an API key from your dashboard Settings → API Keys.
        </p>
        <div className="p-4 bg-black rounded-lg rounded-tl-none rounded-tr-none">
          <pre className="text-sm text-white overflow-x-auto">
            <code>{`curl -X POST https://api.krypta.dev/v1/scan \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"repository": "user/repo", "branch": "main"}'`}</code>
          </pre>
        </div>
        <p>
          Visit our{" "}
          <a
            href="/docs/api/endpoints"
            className="text-sf-accent hover:underline"
          >
            API Reference
          </a>{" "}
          for complete documentation.
        </p>
      </div>
    ),
    category: "api",
  },
  {
    question: "Can I scan private repositories?",
    answer: (
      <p>
        Yes, Krypta fully supports private repositories. All code is encrypted
        during transit and processing. We never store your code after scanning.
      </p>
    ),
    category: "security",
  },
];

const categories = [
  { id: "all", label: "All Questions", icon: MessageCircle },
  { id: "general", label: "General", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
  { id: "getting-started", label: "Getting Started", icon: Zap },
  { id: "teams", label: "Teams", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "api", label: "API", icon: Code },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-black/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-black/5 transition-colors"
      >
        <span className="font-medium text-sf-text-primary pr-8">
          {item.question}
        </span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-sf-text-tertiary shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-sf-text-tertiary shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sf-text-secondary border-t border-black/10 pt-4">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredItems =
    activeCategory === "all"
      ? faqItems
      : faqItems.filter((item) => item.category === activeCategory);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-sf-text-primary">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-sf-text-secondary max-w-2xl">
          Find answers to common questions about Krypta. Can&apos;t find what you&apos;re
          looking for?{" "}
          <a href="/docs/contact" className="text-sf-accent hover:underline">
            Contact our support team
          </a>
          .
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === category.id
                  ? "bg-sf-accent text-white"
                  : "bg-white text-sf-text-secondary hover:bg-black/5"
                }`}
            >
              <Icon className="h-4 w-4" />
              {category.label}
            </button>
          );
        })}
      </div>

      {/* FAQ items */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <FAQAccordion key={item.question} item={item} />
        ))}
      </div>

      {/* Still have questions */}
      <div className="p-6 bg-gradient-to-r from-sf-accent/5 to-[#F05A3C]/5 rounded-xl border border-sf-accent/20">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-sf-accent/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-sf-accent" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-sf-text-primary">
              Still have questions?
            </h2>
            <p className="text-sf-text-secondary">
              Can&apos;t find the answer you&apos;re lookinging for? Our support team is
              here to help.
            </p>
            <a
              href="/docs/contact"
              className="inline-flex items-center gap-2 text-sf-accent font-medium hover:underline"
            >
              Get in touch
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
