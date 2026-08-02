"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Shield,
  Zap,
  Users,
  Loader2,
  CreditCard,
  AlertTriangle,
  XCircle,
  FileText,
  RotateCcw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  TIERS,
  formatPrice,
  type TierId,
  type BillingCycle,
} from "@/lib/billing";

type SubscriptionInfo = {
  tier: TierId;
  plan: string;
  billing_cycle: BillingCycle;
  in_trial: boolean;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  cancelled: boolean;
};

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    async function loadSubscription() {
      try {
        const res = await fetch("/api/billing/subscription");
        const data = await res.json();
        setSubscription(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadSubscription();
  }, []);

  const handleUpgrade = async (tier: TierId) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, billingCycle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { authorizationUrl } = await response.json();
      window.location.href = authorizationUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout", {
        description: error instanceof Error ? error.message : "Please try again or contact support.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User cancelled from dashboard" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }

      // Reload
      const res = await fetch("/api/billing/subscription");
      const data = await res.json();
      setSubscription(data);
      setShowCancelConfirm(false);
      toast.success("Subscription cancelled");
      toast.info("You'll keep access until your billing period ends");
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel subscription");
    }
  };

  const handleRestore = async () => {
    try {
      const response = await fetch("/api/billing/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to restore subscription");
      }

      const res = await fetch("/api/billing/subscription");
      const data = await res.json();
      setSubscription(data);
      toast.success("Subscription restored");
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("Failed to restore subscription");
    }
  };

  const handleSwitchCycle = async (cycle: BillingCycle) => {
    setBillingCycle(cycle);
    // Could add API to update billing_cycle in profile
    toast.info(`Billing cycle updated to ${cycle} (checkout at ${cycle === "monthly" ? "₦5,000/mo" : "₦48,000/yr"})`);
  };

  if (loading) {
    return (
      <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-sf-accent" />
        </div>
      </main>
    );
  }

  const currentTier = subscription?.tier || "free";
  const currentCycle = subscription?.billing_cycle || "monthly";
  const inTrial = subscription?.in_trial;

  return (
    <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <header className="mb-8 sm:mb-12 text-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-sf-text-primary tracking-tight">
          Pricing &{" "}
          <span className="relative inline-block">
            <span className="relative text-sf-accent">Billing</span>
          </span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-sf-text-secondary">
          Manage your subscription and billing.
        </p>
      </header>

      {/* Subscription Status Card */}
      {currentTier !== "free" && (
        <div className="rounded-2xl border border-sf-accent/20 bg-sf-accent/5 p-4 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sf-accent/10 text-sf-accent shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-sf-text-primary">
                  {inTrial ? "14-day Free Trial" : "Pro Subscription"}
                </h4>
                <p className="text-xs text-sf-text-secondary">
                  {inTrial ? `Trial ends ${new Date(subscription?.trial_ends_at || "").toLocaleDateString()}` : `Billed ${currentCycle === "yearly" ? "yearly" : "monthly"}`}
                </p>
                {subscription?.subscription_ends_at && (
                  <p className="text-xs text-sf-text-tertiary mt-0.5">
                    Access ends {new Date(subscription.subscription_ends_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {subscription?.cancelled && !inTrial ? (
                <button
                  onClick={handleRestore}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-sf-accent hover:text-sf-accent/80 px-3 py-2 rounded-lg bg-white border border-sf-accent/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore Subscription
                </button>
              ) : inTrial ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 px-3 py-2 rounded-lg bg-white border border-red-200"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel Trial
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${currentCycle === "monthly" ? "text-sf-text-primary" : "text-sf-text-tertiary"}`}>
          Monthly
        </span>
        <button
          onClick={() => handleSwitchCycle(currentCycle === "monthly" ? "yearly" : "monthly")}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            currentCycle === "yearly" ? "bg-sf-accent" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              currentCycle === "yearly" ? "translate-x-7" : ""
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${currentCycle === "yearly" ? "text-sf-text-primary" : "text-sf-text-tertiary"}`}>
          Yearly
        </span>
      </div>

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
        {/* Free Tier */}
        <div className="rounded-[28px] border border-black/5 bg-white p-5 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-sf-text-primary">Developer</h2>
            <p className="text-xs sm:text-sm text-sf-text-secondary mt-1">
              {TIERS.free.description}
            </p>
          </div>
          <div className="mb-6 sm:mb-8 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-sf-text-primary">₦0</span>
            <span className="text-xs sm:text-sm text-sf-text-tertiary">/forever</span>
          </div>
          <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 flex-1">
            {TIERS.free.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2.5 sm:gap-3 text-sm text-sf-text-secondary">
                <Check className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-sf-accent shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            className="w-full rounded-full border border-black/10 bg-white text-sf-text-primary py-2.5 sm:py-3 text-sm font-medium transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)]"
            disabled={currentTier === "free"}
          >
            {currentTier === "free" ? "Current Plan" : "Stay Free"}
          </button>
        </div>

        {/* Pro Tier */}
        <div className={`relative rounded-[28px] p-5 sm:p-8 shadow-[0_20px_40px_-18px_rgba(227,74,50,0.25)] ${
          currentTier === "pro" ? "border-2 border-sf-accent/30 bg-white ring-2 ring-sf-accent/10" : "border-2 border-black/5 bg-white"
        }`}>
          {currentTier === "pro" && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sf-accent px-3 sm:px-4 py-1 text-[10px] sm:text-xs font-semibold text-white shadow-lg">
              Current Plan
            </span>
          )}
          {inTrial && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 sm:px-4 py-1 text-[10px] sm:text-xs font-semibold text-white shadow-lg">
              Free Trial
            </span>
          )}
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-sf-text-primary flex items-center gap-1.5 sm:gap-2">
              Pro <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sf-accent" />
            </h2>
            <p className="text-xs sm:text-sm text-sf-text-secondary mt-1">
              {TIERS.pro.description}
            </p>
          </div>
          <div className="mb-6 sm:mb-8 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-sf-text-primary">
              {formatPrice("pro", currentCycle, "NGN")}
            </span>
            {currentCycle !== "monthly" && (
              <span className="text-xs sm:text-sm text-sf-text-tertiary">/{currentCycle === "yearly" ? "yr" : "mo"}</span>
            )}
          </div>
          <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 flex-1">
            {[...TIERS.pro.features, ...TIERS.pro.featuresPro].map((feature, i) => (
              <li key={i} className="flex items-center gap-2.5 sm:gap-3 text-sm text-sf-text-primary font-medium">
                <Check className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-sf-accent shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          {currentTier === "free" ? (
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={isProcessing}
              className="w-full rounded-full bg-sf-accent py-2.5 sm:py-3 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)] transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-1.5" />
                  Start 14-day free trial
                </>
              )}
            </button>
          ) : currentTier === "pro" ? (
            <button
              disabled
              className="w-full rounded-full bg-emerald-500 py-2.5 sm:py-3 text-sm font-semibold text-white cursor-not-allowed"
            >
              Active
            </button>
          ) : (
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={isProcessing}
              className="w-full rounded-full bg-sf-accent py-2.5 sm:py-3 text-sm font-semibold text-white shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              Downgrade to Pro
            </button>
          )}
        </div>

        {/* Team Tier */}
        <div className="rounded-[28px] border border-black/5 bg-white p-5 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-sf-text-primary flex items-center gap-1.5 sm:gap-2">
              Team <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sf-accent" />
            </h2>
            <p className="text-xs sm:text-sm text-sf-text-secondary mt-1">
              {TIERS.team.description}
            </p>
          </div>
          <div className="mb-6 sm:mb-8 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-sf-text-primary">
              {formatPrice("team", currentCycle, "NGN")}
            </span>
            {currentCycle !== "monthly" && (
              <span className="text-xs sm:text-sm text-sf-text-tertiary">/{currentCycle === "yearly" ? "yr" : "mo"}</span>
            )}
          </div>
          <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 flex-1">
            {[...TIERS.team.features, ...TIERS.team.featuresTeam].map((feature, i) => (
              <li key={i} className="flex items-center gap-2.5 sm:gap-3 text-sm text-sf-text-secondary">
                <Check className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-sf-accent shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("team")}
            disabled={isProcessing}
            className="w-full rounded-full border border-black/10 bg-white text-sf-text-primary py-2.5 sm:py-3 text-sm font-medium transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)]"
          >
            Contact Sales
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="rounded-2xl border border-black/5 bg-white p-4 sm:p-6 mb-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_10px_22px_-12px_rgba(35,36,39,0.25)]">
        <h4 className="text-sm font-semibold text-sf-text-primary mb-4">Payment Methods</h4>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
            <CreditCard className="h-4 w-4 text-gray-600" />
            <span className="text-xs text-gray-700">Visa / Mastercard / Verve</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
            <Shield className="h-4 w-4 text-gray-600" />
            <span className="text-xs text-gray-700">Paystack Secured</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
            <FileText className="h-4 w-4 text-gray-600" />
            <span className="text-xs text-gray-700">Invoice Available</span>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-sf-text-primary">Cancel Subscription?</h3>
            </div>
            <p className="text-sm text-sf-text-secondary mb-6">
              You'll lose access to Pro features when your trial ends. You can restore your subscription anytime.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-sf-text-secondary"
              >
                Keep Trial
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
