"use client";

import Link from "next/link";
import { useState, useEffect, useSyncExternalStore } from "react";
import {
  Zap, Shield, Sparkles, Terminal, ArrowRight,
  CheckCircle2, BarChart3, Clock, ChevronDown,
  ChevronUp, Search, GitPullRequest, FileCode
} from "lucide-react";
import { TerminalWidget } from "@/components/TerminalWidget";
import { ScrollAnimations } from "@/components/ScrollAnimations";
import { createClient } from "@/utils/supabase/client";

/* ============================================================
   Navigation
   ============================================================ */

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; picture?: string }; avatar_url?: string } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.avatar_url;
  const initial = user?.email?.[0]?.toUpperCase() ?? "";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-lg" : ""}`}>
      <div className={`mx-auto max-w-7xl flex items-center justify-between rounded-full px-6 py-3 shadow-lg transition-all duration-300 ${scrolled ? "border border-black/5 bg-white/80 backdrop-blur-lg shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_24px_-12px_rgba(35,36,39,0.2)]" : "border border-black/10 bg-white/60 backdrop-blur-md"}`}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C]">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-[#2E3034]">Krypta</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-[#55575c] hover:text-[#2E3034] transition-colors">Features</a>
          <a href="#how" className="text-sm text-[#55575c] hover:text-[#2E3034] transition-colors">How it works</a>
          <a href="#pricing" className="text-sm text-[#55575c] hover:text-[#2E3034] transition-colors">Pricing</a>
          <a href="#faq" className="text-sm text-[#55575c] hover:text-[#2E3034] transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full bg-[#171719] text-white text-sm font-medium px-5 py-2.5 transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)]"
              >
                Dashboard
              </Link>
              <div className="relative group">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-9 w-9 rounded-full ring-2 ring-black/10 object-cover cursor-pointer transition-all group-hover:ring-sf-accent/50"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center text-white text-sm font-semibold ring-2 ring-black/10 cursor-pointer transition-all group-hover:ring-sf-accent/50">
                    {initial}
                  </div>
                )}
                {/* Dropdown on hover */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-black/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-3 border-b border-black/5">
                    <p className="text-sm font-medium text-[#2E3034] truncate">{user.email?.split("@")[0]}</p>
                    <p className="text-xs text-[#8a8c91] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      setUser(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-xl transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-[#55575c] hover:text-[#2E3034] transition-colors px-3 py-2">
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-[#171719] text-white text-sm font-medium px-5 py-2.5 transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ============================================================
   Hero
   ============================================================ */

function Hero() {
  return (
    <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col items-center text-center z-10 min-h-[90vh] sm:min-h-[95vh] justify-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 top-10 sm:-right-40 sm:top-20 h-[250px] w-[250px] sm:h-[500px] sm:w-[500px] rounded-full bg-gradient-to-bl from-sf-accent/15 to-transparent blur-2xl sm:blur-3xl opacity-40 sm:opacity-60" />
        <div className="absolute -left-20 bottom-10 sm:-bottom-40 sm:bottom-20 h-[200px] w-[200px] sm:h-[400px] sm:w-[400px] rounded-full bg-gradient-to-tr from-[#F05A3C]/10 to-transparent blur-2xl sm:blur-3xl opacity-30 sm:opacity-50" />
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-medium text-sf-accent backdrop-blur shadow-[0_6px_16px_-8px_rgba(35,36,39,0.25)]">
        <Sparkles className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
        AI-Powered Penetration Testing — Coming Soon
      </div>

      <h1 className="mt-4 sm:mt-6 text-3xl sm:text-5xl font-semibold leading-[1.15] sm:leading-[1.1] tracking-tight text-[#2E3034] sm:text-6xl lg:text-7xl xl:text-8xl wchar max-w-[90%] sm:max-w-5xl">
        Krypta attacks
        <br />
        <span className="relative inline-block">
          <span className="relative text-sf-accent font-semibold">so you don&apos;t have to.</span>
        </span>
      </h1>

      <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[#55575c] max-w-2xl">
        Paste your live URL or connect your repo. Krypta&apos;s AI agent actively
        tries to hack your site — SQL injection, XSS, auth bypass, privilege
        escalation. If it gets in, you get a full report with details.
      </p>

      <div className="mt-6 sm:mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-sf-accent px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-medium text-white shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(227,74,50,0.65)]"
        >
          Join the Waitlist
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <a
          href="#how"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/80 px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-medium text-[#2E3034] shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_4px_12px_-8px_rgba(35,36,39,0.3)] transition-all duration-300 hover:bg-white/90"
        >
          <Terminal className="h-4 w-4 sm:h-5 sm:w-5" />
          See how it works
        </a>
      </div>

      <div className="mt-6 sm:mt-10 flex flex-col items-center gap-2 sm:gap-3">
        <div className="flex -space-x-2">
          {["from-sf-accent/30 to-sf-accent/60", "from-blue-400 to-blue-600", "from-emerald-400 to-emerald-600", "from-purple-400 to-purple-600"].map((g, i) => (
            <div key={i} className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full ring-2 ring-white bg-gradient-to-tr ${g}`} />
          ))}
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full ring-2 ring-white bg-[#F7F7F5] flex items-center justify-center text-[10px] sm:text-[9px] font-medium text-[#55575c]">
            +2k
          </div>
        </div>
        <p className="text-sm text-[#55575c]">
          Trusted by <span className="font-semibold text-[#2E3034]">2,000+</span> developers
        </p>
      </div>

      <div className="mt-10 sm:mt-16 w-full max-w-3xl">
        <TerminalWidget />
      </div>
    </section>
  );
}

/* ============================================================
   Trusted Logos
   ============================================================ */

function TrustedLogos() {
  return (
    <section className="py-16 px-6 border-t border-b border-black/5">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-xs uppercase tracking-widest text-[#8a8c91] mb-8">
          Compatible with your security stack
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-[#55575c]">
          <span className="text-lg font-semibold opacity-50">GitHub</span>
          <span className="text-lg font-semibold opacity-50">GitLab</span>
          <span className="text-lg font-semibold opacity-50">Bitbucket</span>
          <span className="text-lg font-semibold opacity-50">AWS</span>
          <span className="text-lg font-semibold opacity-50">Docker</span>
          <span className="text-lg font-semibold opacity-50">Kubernetes</span>
          <span className="text-lg font-semibold opacity-50">Slack</span>
          <span className="text-lg font-semibold opacity-50">Jira</span>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Stats
   ============================================================ */

function Stats() {
  const stats = [
    { icon: Shield, value: "0", label: "False Positives", sub: "Krypta only reports what it proved by exploiting" },
    { icon: Clock, value: "2", label: "Minute Attacks", sub: "From paste to exploit in under 120 seconds" },
    { icon: BarChart3, value: "10x", label: "Faster Fixes", sub: "Average time to fix vs manual pentesting" },
    { icon: GitPullRequest, value: "50k+", label: "PRs Fixed", sub: "And counting across 2,000+ teams" },
  ];

  return (
    <section className="px-6 py-24 max-w-7xl mx-auto z-10">
      <div className="rounded-[32px] bg-white border border-black/5 p-8 sm:p-12 lg:p-16 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_24px_60px_-36px_rgba(35,36,39,0.3)]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-[#2E3034] sm:text-4xl">
            Numbers that <span className="relative inline-block"><span className="relative text-sf-accent">speak.</span></span>
          </h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} data-reveal className="opacity-0 translate-y-4 transition-all duration-700 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sf-accent/10 text-sf-accent">
                <s.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-4xl font-semibold text-[#2E3034] sm:text-5xl">{s.value}</p>
              <p className="mt-1 text-base font-medium text-[#2E3034]">{s.label}</p>
              <p className="mt-1 text-sm text-[#8a8c91]">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   How It Works
   ============================================================ */

function HowItWorks() {
  const steps = [
    {
      step: "01",
      icon: Search,
      title: "Paste your URL or connect your repo",
      description: "Give Krypta a live site to attack or a codebase to analyze. No config, no setup. That's it.",
    },
    {
      step: "02",
      icon: Zap,
      title: "AI agent attacks",
      description: "Krypta actively tries to hack your site — SQL injection, XSS, auth bypass, privilege escalation, cloud misconfigurations, Docker exposure, and more.",
    },
    {
      step: "03",
      icon: FileCode,
      title: "Get a detailed report",
      description: "Every vulnerability gets a full report — what was found, how Krypta exploited it, where it is in your code, and exactly how to fix it. In plain English.",
    },
  ];

  return (
    <section id="how" className="px-6 py-24 max-w-7xl mx-auto z-10">
      <div className="mb-16 text-center">
        <span className="text-sm font-semibold text-sf-accent">How it works</span>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#2E3034] sm:text-5xl wchar">
          From URL to <span className="relative inline-block"><span className="relative text-sf-accent">report.</span></span>
        </h2>
        <p className="mt-4 text-lg text-[#55575c] max-w-2xl mx-auto">
          Three steps. No setup. No pentester on call. Just paste and attack.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={i} data-reveal className="opacity-0 translate-y-4 transition-all duration-700 group">
            <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] transition-all hover:shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_24px_44px_-18px_rgba(35,36,39,0.3)] hover:-translate-y-1 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${i % 2 === 0 ? "bg-sf-accent/10 text-sf-accent" : "bg-blue-500/10 text-blue-500"}`}>
                  <s.icon className="h-7 w-7" />
                </div>
                <span className="text-5xl font-bold text-black/[0.04] group-hover:text-black/[0.08] transition-colors">{s.step}</span>
              </div>
              <h3 className="text-xl font-semibold text-[#2E3034] mb-2">{s.title}</h3>
              <p className="text-base leading-relaxed text-[#55575c] flex-1">{s.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Features — Attack Types
   ============================================================ */

function Features() {
  const attacks = [
    { title: "SQL Injection", desc: "Injection attacks, data exfiltration, privilege escalation through databases" },
    { title: "XSS / CSRF", desc: "Cross-site scripting, request forgery, session hijacking" },
    { title: "Auth Bypass", desc: "Authentication bypass, token manipulation, broken access control" },
    { title: "Cloud Misconfig", desc: "Exposed S3 buckets, open ports, default credentials, SSRF" },
    { title: "API Attacks", desc: "Broken API endpoints, rate limiting, mass assignment, IDOR" },
    { title: "Infrastructure", desc: "Docker exposure, K8s misconfig, reverse shell attempts" },
  ];

  return (
    <section id="features" className="px-6 py-24 max-w-7xl mx-auto z-10">
      <div className="mb-16 text-center">
        <span className="text-sm font-semibold text-sf-accent">Attack surface</span>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#2E3034] sm:text-5xl wchar">
          Full-stack security
        </h2>
        <p className="mt-4 text-lg text-[#55575c] max-w-2xl mx-auto">
          From web apps to infrastructure. One AI agent covers it all.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {attacks.map((a, i) => (
          <div key={i} data-reveal className="opacity-0 translate-y-4 transition-all duration-700 rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sf-accent/10 text-sf-accent">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#2E3034]">{a.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-[#55575c]">{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Testimonials
   ============================================================ */

function Testimonials() {
  const testimonials = [
    {
      quote: "Krypta found a critical SQL injection that Burp Suite missed three times. It doesn't just scan — it exploits.",
      name: "Sarah Chen",
      role: "Senior Engineer, Finovate",
      gradient: "from-sf-accent/30 to-sf-accent/60",
    },
    {
      quote: "The plain-English reports are a game-changer. Our junior devs can actually understand what went wrong and fix it.",
      name: "Marcus Johnson",
      role: "Tech Lead, Datastream",
      gradient: "from-blue-400 to-blue-600",
    },
    {
      quote: "We used to spend $20k on pentests twice a year. Now Krypta catches things between them. Worth 100x the price.",
      name: "Priya Patel",
      role: "CTO, Nexaflow",
      gradient: "from-emerald-400 to-emerald-600",
    },
  ];

  return (
    <section className="px-6 py-24 max-w-7xl mx-auto z-10">
      <div className="mb-16 text-center">
        <span className="text-sm font-semibold text-sf-accent">Testimonials</span>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#2E3034] sm:text-5xl wchar">
          Loved by <span className="relative inline-block"><span className="relative text-sf-accent">developers.</span></span>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <div key={i} data-reveal className="opacity-0 translate-y-4 transition-all duration-700 rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] h-full flex flex-col">
            <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr ${t.gradient}`}>
              <span className="text-lg font-bold text-white">{t.name[0]}</span>
            </div>
            <p className="text-base leading-relaxed text-[#55575c] flex-1">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-6 pt-4 border-t border-black/5">
              <p className="text-sm font-medium text-[#2E3034]">{t.name}</p>
              <p className="text-xs text-[#8a8c91]">{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Pricing
   ============================================================ */

function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      desc: "For individual developers who want to get started.",
      features: ["5 attacks per month", "1 repository", "Basic vulnerability reports"],
      cta: "Get started free",
      featured: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      desc: "For teams that need the full power of AI security.",
      features: ["Unlimited attacks", "Unlimited repositories", "Full attack reports + auto-fixes", "CI/CD integration", "Priority support", "Custom scanning rules"],
      cta: "Upgrade to Pro",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      desc: "For organizations with compliance and SSO needs.",
      features: ["Everything in Pro, plus:", "SSO / SAML integration", "Compliance reporting (SOC2, HIPAA)", "Dedicated account manager", "99.9% uptime SLA", "On-premise deployment option"],
      cta: "Contact sales",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="px-6 py-24 max-w-7xl mx-auto z-10">
      <div className="mb-16 text-center">
        <span className="text-sm font-semibold text-sf-accent">Pricing</span>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#2E3034] sm:text-5xl wchar">
          Simple, <span className="relative inline-block"><span className="relative text-sf-accent">transparent</span></span> pricing
        </h2>
        <p className="mt-4 text-lg text-[#55575c] max-w-2xl mx-auto">
          Start free. Scale when you&apos;re ready. No hidden fees.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 lg:gap-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            data-reveal
            className={`opacity-0 translate-y-4 transition-all duration-700 flex flex-col rounded-[28px] border p-8 ${plan.featured
              ? "relative z-10 border-sf-accent/30 bg-white shadow-[0_20px_40px_-18px_rgba(227,74,50,0.2)] md:scale-[1.03]"
              : "border-black/5 bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]"
              } flex-1`}
          >
            {plan.featured && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-sf-accent to-[#F05A3C] px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                Most popular
              </span>
            )}
            <div>
              <h3 className="text-xl font-semibold text-[#2E3034]">{plan.name}</h3>
              <p className="mt-2 text-sm text-[#55575c]">{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#2E3034]">{plan.price}</span>
                {plan.period && <span className="text-base text-[#8a8c91]">{plan.period}</span>}
              </div>
            </div>
            <ul className="mt-8 flex flex-col gap-3 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-[#55575c]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sf-accent" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={`mt-8 w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-all duration-300 ${plan.featured
                ? "bg-sf-accent text-white shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(227,74,50,0.65)]"
                : "border border-black/10 bg-white text-[#2E3034] shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] hover:bg-black/5 hover:-translate-y-0.5"
                }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   FAQ
   ============================================================ */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.15)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-base font-medium text-[#2E3034]">{question}</span>
        {open ? <ChevronUp className="h-5 w-5 shrink-0 text-[#8a8c91]" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#8a8c91]" />}
      </button>
      {open && <p className="mt-3 text-sm leading-relaxed text-[#55575c]">{answer}</p>}
    </div>
  );
}

function FAQ() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const faqs = [
    { question: "How is Krypta different from Burp Suite or OWASP ZAP?", answer: "Burp Suite and OWASP ZAP match known attack signatures. Krypta uses AI to actively exploit vulnerabilities like a real hacker would. It doesn't just look for patterns — it proves they're real by attacking. If Krypta gets in, your site genuinely has that vulnerability. Zero false positives." },
    { question: "Does Krypta damage my site during attacks?", answer: "No. Krypta's AI agent uses safe, non-destructive payloads designed to prove a vulnerability exists without causing damage. It's like having a penetration tester — thorough, targeted, and safe." },
    { question: "What kind of vulnerabilities can Krypta find?", answer: "Krypta attacks web apps (SQL injection, XSS, CSRF, auth bypass), APIs (broken endpoints, mass assignment, IDOR), and infrastructure (cloud misconfig, Docker exposure, Kubernetes misconfig). It covers the OWASP Top 10 plus real-world attack vectors." },
    { question: "Is my code safe with Krypta?", answer: "Absolutely. Krypta scans your code in real-time and does not store, copy, or train on your source code. We are SOC2 compliant and GDPR ready. Your code stays in your repository." },
    { question: "What happens if Krypta finds a vulnerability?", answer: "You get a detailed report — what was found, how Krypta exploited it, where it is in your code, and exactly how to fix it. For Pro and Enterprise users, Krypta can also auto-open a PR with the fix applied." },
  ];

  if (!mounted) return null;

  return (
    <section id="faq" className="px-6 py-24 max-w-3xl mx-auto z-10">
      <div className="mb-16 text-center">
        <span className="text-sm font-semibold text-sf-accent">FAQ</span>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[#2E3034] sm:text-5xl wchar">
          Common <span className="relative inline-block"><span className="relative text-sf-accent">questions.</span></span>
        </h2>
      </div>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <FAQItem key={i} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   CTA Banner
   ============================================================ */

function CTABanner() {
  return (
    <section className="px-6 py-24 max-w-7xl mx-auto z-10">
      <div className="relative overflow-hidden rounded-[36px] bg-[#171719] p-10 sm:p-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_30px_60px_-28px_rgba(23,23,25,0.8)]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-sf-accent/20 to-transparent blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-gradient-to-tr from-[#F05A3C]/10 to-transparent blur-3xl opacity-50" />
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight">
            Ready to test your security?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/55 max-w-xl mx-auto">
            Join 2,000+ developers waiting for early access. Get your first security report in under 2 minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-sf-accent px-8 py-4 text-base font-medium text-white shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(227,74,50,0.65)]"
            >
              Join the Waitlist
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-base font-medium text-white transition-all duration-300 hover:bg-white/10"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Footer
   ============================================================ */

function Footer() {
  return (
    <footer className="border-t border-black/5 px-6 py-16 z-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C]">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-[#2E3034]">Krypta</span>
            </Link>
            <p className="mt-4 text-sm text-[#55575c] max-w-xs">
              AI-powered penetration testing. We actively try to hack your site so you can fix it first.
            </p>
            <div className="mt-6 flex gap-4">
              <a href="https://github.com/krypta" className="text-[#8a8c91] hover:text-[#2E3034] transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              </a>
              <a href="https://twitter.com/krypta" className="text-[#8a8c91] hover:text-[#2E3034] transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#2E3034] mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-[#55575c]">
              <li><a href="#features" className="hover:text-[#2E3034] transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-[#2E3034] transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-[#2E3034] transition-colors">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#2E3034] mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-[#55575c]">
              <li><a href="#" className="hover:text-[#2E3034] transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-[#2E3034] transition-colors">API</a></li>
              <li><a href="#" className="hover:text-[#2E3034] transition-colors">Blog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#2E3034] mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-[#55575c]">
              <li><a href="#" className="hover:text-[#2E3034] transition-colors">About</a></li>
              <li><a href="mailto:hello@krypta.dev" className="hover:text-[#2E3034] transition-colors">Contact</a></li>
              <li><a href="/privacy" className="hover:text-[#2E3034] transition-colors">Privacy</a></li>
              <li><a href="/terms" className="hover:text-[#2E3034] transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#8a8c91]">&copy; {new Date().getFullYear()} Krypta. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-[#8a8c91]">
            <Link href="/privacy" className="hover:text-[#2E3034] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#2E3034] transition-colors">Terms</Link>
            <a href="#" className="hover:text-[#2E3034] transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-[#F7F7F5]">
      <Navigation />
      <Hero />
      <TrustedLogos />
      <Stats />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTABanner />
      <Footer />
      <ScrollAnimations />
    </main>
  );
}
