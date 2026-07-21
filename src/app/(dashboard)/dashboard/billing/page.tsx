"use client";

import { useState } from "react";
import { Check, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function BillingPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "pro">("free");
  const supabase = createClient();

  useState(() => {
    async function loadPlan() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setCurrentPlan(profile.plan || "free");
        }
      } catch {
        // ignore
      }
    }
    loadPlan();
  });

  const handleUpgrade = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        setIsProcessing(false);
        return;
      }

      // Create a Paystack checkout session on the server
      // We'll use a server action for this
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          plan: "pro",
          amount: 29000, // ₦29,000/month in Naira base unit
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { authorizationUrl } = await response.json();

      // Redirect to Paystack checkout
      window.location.href = authorizationUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-12 text-center">
        <h1 className="text-3xl font-semibold text-sf-text-primary tracking-tight">
          Pricing &{" "}
          <span className="relative inline-block">
            <span className="relative text-sf-accent">Billing</span>
          </span>
        </h1>
        <p className="mt-2 text-base text-sf-text-secondary">
          Simple, transparent pricing for AI security scanning.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Free Tier */}
        <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-sf-text-primary">Developer</h2>
            <p className="text-sm text-sf-text-secondary mt-1">
              Perfect for individual developers and open-source maintainers.
            </p>
          </div>
          <div className="mb-8 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-sf-text-primary">$0</span>
            <span className="text-sm text-sf-text-tertiary">/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-center gap-3 text-sm text-sf-text-secondary">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              1 Repository
            </li>
            <li className="flex items-center gap-3 text-sm text-sf-text-secondary">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              Up to 50 scans per month
            </li>
            <li className="flex items-center gap-3 text-sm text-sf-text-secondary">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              Standard severity alerts
            </li>
          </ul>
          <button
            className="w-full rounded-full border border-black/10 bg-white text-sf-text-primary py-3 text-sm font-medium transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)]"
            disabled
          >
            Current Plan
          </button>
        </div>

        {/* Pro Tier */}
        <div className="relative rounded-[28px] border-2 border-sf-accent/30 bg-white p-8 shadow-[0_20px_40px_-18px_rgba(227,74,50,0.25)] md:scale-[1.02]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-sf-accent to-[#F05A3C] px-4 py-1 text-xs font-semibold text-white shadow-lg">
            Most Popular
          </span>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-sf-text-primary flex items-center gap-2">
              Pro <Zap className="h-4 w-4 text-sf-accent" />
            </h2>
            <p className="text-sm text-sf-text-secondary mt-1">
              For professional teams that need unlimited scans and one-click fixes.
            </p>
          </div>
          <div className="mb-8 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-sf-text-primary">$29</span>
            <span className="text-sm text-sf-text-tertiary">/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            <li className="flex items-center gap-3 text-sm text-sf-text-primary font-medium">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              Unlimited Repositories
            </li>
            <li className="flex items-center gap-3 text-sm text-sf-text-primary font-medium">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              Unlimited scans
            </li>
            <li className="flex items-center gap-3 text-sm text-sf-text-primary font-medium">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              One-click automated PR fixes
            </li>
            <li className="flex items-center gap-3 text-sm text-sf-text-primary font-medium">
              <Check className="h-4.5 w-4.5 text-sf-accent shrink-0" />
              Priority email support
            </li>
          </ul>
          <button
            onClick={handleUpgrade}
            disabled={isProcessing || currentPlan === "pro"}
            className="w-full rounded-full bg-sf-accent py-3 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)] transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center"
          >
            {isProcessing ? (
              <span className="animate-pulse">Redirecting...</span>
            ) : currentPlan === "pro" ? (
              "Active"
            ) : (
              "Upgrade to Pro"
            )}
          </button>
        </div>
      </div>

      {/* Secure payments */}
      <div className="rounded-2xl border border-black/5 bg-white p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_10px_22px_-12px_rgba(35,36,39,0.25)]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-sf-text-primary">Secure Payments</h4>
            <p className="text-xs text-sf-text-secondary">
              All transactions are securely processed via Paystack.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
