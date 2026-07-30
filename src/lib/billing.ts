/**
 * Billing / Subscription Management
 *
 * Uses Paystack for payment processing.
 * Plans: Free (default), Pro (GH₵ 99/month or $10/month)
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "GHS",
    features: [
      "1 repository",
      "Basic vulnerability scanning",
      "Email notifications",
      "30-day scan history",
    ],
    limits: {
      repositories: 1,
      scansPerMonth: 5,
      historyDays: 30,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 99, // GHS
    priceYearly: 990, // GHS (save ~17%)
    currency: "GHS",
    features: [
      "Unlimited repositories",
      "AI-powered scanning",
      "Auto-fix PRs",
      "Exploit scanning",
      "Email + Slack notifications",
      "Full scan history",
      "Priority support",
    ],
    limits: {
      repositories: -1, // unlimited
      scansPerMonth: -1, // unlimited
      historyDays: -1, // unlimited
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

// Paystack plan IDs (to be set in Paystack dashboard)
export const PAYSTACK_PLANS = {
  pro_monthly: process.env.PAYSTACK_PRO_MONTHLY_PLAN,
  pro_yearly: process.env.PAYSTACK_PRO_YEARLY_PLAN,
} as const;

// Calculate plan access
export function hasAccess(
  currentPlan: PlanId,
  feature: "repositories" | "scansPerMonth" | "historyDays" | "aiScan" | "autoPR" | "exploitScan",
  requested: number
): boolean {
  const plan = PLANS[currentPlan];
  const limit = plan.limits[feature as keyof typeof plan.limits];

  if (limit === -1) return true; // unlimited
  return requested <= limit;
}

// Check if user can access Pro features
export function isPro(currentPlan: PlanId): boolean {
  return currentPlan === "pro";
}
