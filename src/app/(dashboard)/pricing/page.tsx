"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  CheckCircle2,
  XCircle,
  Star,
  Shield,
  Zap,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "GH₵ 0",
    period: "forever",
    description: "Perfect for getting started with security scanning",
    features: [
      { text: "1 repository", included: true },
      { text: "Basic vulnerability scanning", included: true },
      { text: "Email notifications", included: true },
      { text: "30-day scan history", included: true },
      { text: "AI-powered scanning", included: false },
      { text: "Auto-fix PRs", included: false },
      { text: "Exploit scanning", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Current Plan",
    ctaVariant: "default" as const,
  },
  {
    id: "pro",
    name: "Pro",
    price: "GH₵ 99",
    period: "/month",
    description: "For teams that need advanced security features",
    features: [
      { text: "Unlimited repositories", included: true },
      { text: "AI-powered scanning", included: true },
      { text: "Auto-fix PRs", included: true },
      { text: "Exploit scanning", included: true },
      { text: "Email + Slack notifications", included: true },
      { text: "Full scan history", included: true },
      { text: "Priority support", included: true },
      { text: "SSO/SAML (coming soon)", included: false },
    ],
    cta: "Upgrade to Pro",
    ctaVariant: "primary" as const,
    popular: true,
  },
];

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<"free" | "pro" | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await fetch("/api/billing/subscription");
        const data = await res.json();
        setCurrentPlan(data.plan || "free");
      } catch (error) {
        console.error("Failed to load plan:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, []);

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to start checkout");
        return;
      }

      // Redirect to Paystack checkout
      window.location.href = data.authorizationUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-sf-accent mx-auto" />
          <p className="text-sf-text-secondary">Loading pricing...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-sf-text-primary">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-sf-text-secondary max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border bg-white p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] ${
                plan.popular ? "border-sf-accent/30 ring-2 ring-sf-accent/10" : "border-black/5"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-sf-accent text-white text-xs font-medium px-3 py-1 rounded-full">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-sf-text-primary">{plan.name}</h3>
                  <p className="text-sm text-sf-text-secondary mt-1">{plan.description}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-sf-text-primary">{plan.price}</span>
                    {plan.period !== "forever" && (
                      <span className="text-sm text-sf-text-tertiary">{plan.period}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {feature.included ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-300 shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          feature.included ? "text-sf-text-primary" : "text-sf-text-tertiary"
                        }`}
                      >
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleCheckout(plan.id === "pro" ? "pro_monthly" : "")}
                  disabled={plan.id === currentPlan || checkoutLoading !== null}
                  className={`w-full mt-6 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                    plan.id === currentPlan
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : plan.ctaVariant === "primary"
                        ? "bg-sf-accent text-white shadow-sm hover:bg-sf-accent/90"
                        : "bg-black text-white hover:bg-black/90"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-2xl font-bold text-center text-sf-text-primary">
            Frequently asked questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: "Can I switch plans anytime?",
                a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit/debit cards through Paystack. Bank transfers and mobile money coming soon.",
              },
              {
                q: "Is there a free trial for Pro?",
                a: "We offer a 14-day free trial for Pro. No credit card required to start.",
              },
              {
                q: "What happens when I exceed my plan limits?",
                a: "You'll be notified when you're approaching your limits. You can upgrade your plan or delete unused repositories.",
              },
            ].map((faq, i) => (
              <div key={i} className="space-y-2">
                <h3 className="font-semibold text-sf-text-primary">{faq.q}</h3>
                <p className="text-sm text-sf-text-secondary">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
