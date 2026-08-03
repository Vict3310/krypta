"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Star,
  Shield,
  Zap,
  Users,
  FileText,
  Loader2,
  CreditCard,
  Building2,
  Smartphone,
} from "lucide-react";
import {
  TIERS,
  formatPrice,
  type TierId,
  type BillingCycle,
} from "@/lib/billing";

type PaymentMethod = "card" | "transfer" | "ussd" | "bank_transfer";

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "card",
    label: "Debit / Credit Card",
    icon: <CreditCard className="h-5 w-5" />,
    description: "Visa, Mastercard, Verve",
  },
  {
    id: "transfer",
    label: "Bank Transfer",
    icon: <Building2 className="h-5 w-5" />,
    description: "Direct bank transfer",
  },
  {
    id: "ussd",
    label: "USSD",
    icon: <Smartphone className="h-5 w-5" />,
    description: "Quick USSD payment",
  },
];

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<TierId | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await fetch("/api/billing/subscription");
        const data = await res.json();
        setCurrentPlan(data.tier || data.plan || "free");
      } catch (error) {
        console.error("Failed to load plan:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, []);

  const handleUpgrade = async (tier: TierId) => {
    if (currentPlan === tier) return;

    setCheckoutLoading(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, billingCycle }),
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

  const handleInvoice = async () => {
    setCheckoutLoading("invoice");
    try {
      const res = await fetch("/api/billing/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "team", seats: 3 }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to create invoice");
        return;
      }

      window.location.href = data.paymentLink;
    } catch (error) {
      console.error("Invoice error:", error);
      alert("Failed to create invoice");
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
            Start free and scale as you grow. AI-powered security scanning for Nigerian developers and teams.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-sf-text-primary" : "text-sf-text-tertiary"}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                billingCycle === "yearly" ? "bg-sf-accent" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  billingCycle === "yearly" ? "translate-x-7" : ""
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === "yearly" ? "text-sf-text-primary" : "text-sf-text-tertiary"}`}>
              Yearly
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-full">
              <Zap className="h-3 w-3" />
              Save {billingCycle === "monthly" ? "18%" : "20%"}
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Free Tier */}
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] border-black/5">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-sf-text-primary">Developer</h3>
                <p className="text-sm text-sf-text-secondary mt-1">
                  For individual developers and open-source maintainers.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-sf-text-primary">₦0</span>
                  <span className="text-sm text-sf-text-tertiary">/forever</span>
                </div>
              </div>

              <div className="space-y-3">
                {TIERS.free.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-sf-text-primary">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                disabled={currentPlan === "free" || checkoutLoading !== null}
                className={`w-full mt-6 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  currentPlan === "free"
                    ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {currentPlan === "free" ? "Current Plan" : "Stay Free"}
              </button>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="relative rounded-2xl border-2 border-sf-accent/30 bg-white p-6 sm:p-8 shadow-[0_20px_40px_-18px_rgba(227,74,50,0.25)] ring-2 ring-sf-accent/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 bg-sf-accent text-white text-xs font-medium px-3 py-1 rounded-full">
                <Star className="h-3 w-3" />
                Most Popular
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-sf-text-primary flex items-center gap-1.5">
                  Pro <Zap className="h-4 w-4 text-sf-accent" />
                </h3>
                <p className="text-sm text-sf-text-secondary mt-1">
                  For professional developers who need AI-powered fixes.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-sf-text-primary">{formatPrice("pro", billingCycle, "NGN")}</span>
                  {billingCycle !== "monthly" && (
                    <span className="text-sm text-sf-text-tertiary">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                  )}
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-xs text-emerald-600 font-medium">
                    {formatPrice("pro", "monthly", "NGN")}/mo billed yearly
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {[
                  ...TIERS.pro.features,
                  ...TIERS.pro.featuresPro,
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-sf-text-primary">{feature}</span>
                  </div>
                ))}
              </div>

              {currentPlan === "free" ? (
                <button
                  onClick={() => handleUpgrade("pro")}
                  disabled={checkoutLoading !== null}
                  className="w-full mt-6 rounded-lg px-4 py-3 text-sm font-medium transition-all bg-sf-accent text-white shadow-sm hover:bg-sf-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {checkoutLoading === "pro" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Start 14-day free trial
                    </>
                  )}
                </button>
              ) : currentPlan === "pro" ? (
                <button
                  disabled
                  className="w-full mt-6 rounded-lg px-4 py-3 text-sm font-medium transition-all bg-emerald-500 text-white cursor-not-allowed"
                >
                  Active
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade("pro")}
                  disabled={checkoutLoading !== null}
                  className="w-full mt-6 rounded-lg px-4 py-3 text-sm font-medium transition-all bg-sf-accent text-white shadow-sm hover:bg-sf-accent/90 disabled:opacity-50"
                >
                  Downgrade
                </button>
              )}
            </div>
          </div>

          {/* Team Tier */}
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] border-black/5">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-sf-text-primary flex items-center gap-1.5">
                  Team <Users className="h-4 w-4 text-sf-accent" />
                </h3>
                <p className="text-sm text-sf-text-secondary mt-1">
                  For teams that need collaboration and compliance tools.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-sf-text-primary">{formatPrice("team", billingCycle, "NGN")}</span>
                  {billingCycle !== "monthly" && (
                    <span className="text-sm text-sf-text-tertiary">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                  )}
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-xs text-emerald-600 font-medium">
                    {formatPrice("team", "monthly", "NGN")}/mo billed yearly
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {[
                  ...TIERS.team.features,
                  ...TIERS.team.featuresTeam,
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-sf-text-primary">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleUpgrade("team")}
                disabled={checkoutLoading !== null}
                className="w-full mt-6 rounded-lg px-4 py-3 text-sm font-medium transition-all bg-black text-white hover:bg-black/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkoutLoading === "team" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Contact Sales"
                )}
              </button>

              <button
                onClick={handleInvoice}
                disabled={checkoutLoading !== null}
                className="w-full mt-2 rounded-lg px-4 py-2 text-xs font-medium transition-all border border-black/10 bg-white text-sf-text-secondary hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Request Bank Transfer Invoice
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center text-sf-text-primary">
            Pay with your preferred method
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAYMENT_METHODS.map((method) => (
              <div
                key={method.id}
                className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-all ${
                  paymentMethod === method.id
                    ? "border-sf-accent/30 bg-sf-accent/5"
                    : "border-black/5 bg-white"
                }`}
                onClick={() => setPaymentMethod(method.id)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 shrink-0">
                  {method.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-sf-text-primary">{method.label}</h4>
                  <p className="text-xs text-sf-text-secondary">{method.description}</p>
                </div>
              </div>
            ))}
          </div>
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
                a: "We accept Visa, Mastercard, Verve debit/credit cards, bank transfer, and USSD through Paystack. For teams, we also offer invoicing with bank transfer payment.",
              },
              {
                q: "Is there a free trial?",
                a: "Yes! Both Pro and Team plans come with a 14-day free trial. No credit card required to start.",
              },
              {
                q: "What happens when my trial ends?",
                a: "At the end of your trial, you'll be charged based on your selected billing cycle. You can cancel anytime before the trial ends and won't be charged.",
              },
              {
                q: "Can I get an invoice?",
                a: "Yes. Pro users can request an invoice from the billing dashboard. Team users can request a custom invoice with company details and TIN.",
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

      {/* Trust Bar */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-black/5 bg-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_10px_22px_-12px_rgba(35,36,39,0.25)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-sf-text-primary">Secured by Paystack</h4>
                <p className="text-xs text-sf-text-secondary">
                  All payments processed securely via Paystack — Nigeria&apos;s trusted payment platform.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-sf-text-tertiary bg-gray-100 px-2 py-1 rounded">
                <CreditCard className="h-3 w-3" /> Visa
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-sf-text-tertiary bg-gray-100 px-2 py-1 rounded">
                <CreditCard className="h-3 w-3" /> Mastercard
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-sf-text-tertiary bg-orange-100 px-2 py-1 rounded">
                <CreditCard className="h-3 w-3" /> Verve
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-sf-text-tertiary bg-gray-100 px-2 py-1 rounded">
                <Building2 className="h-3 w-3" /> Bank Transfer
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
