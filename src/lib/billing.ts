/**
 * Billing / Subscription Management
 *
 * Uses Paystack for payment processing.
 * Tiers: Free (unlimited scanning), Pro (AI features), Team (collaboration)
 * Currencies: NGN (Nigeria, default), GHS (Ghana)
 * Trials: 14-day free trial on first upgrade to Pro/Team
 */

// ============================================================
// Currency Configuration
// ============================================================

export type CurrencyCode = "NGN" | "GHS";

export const CURRENCIES: Record<CurrencyCode, {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  koboMultiplier: number;
}> = {
  NGN: {
    code: "NGN",
    symbol: "₦",
    locale: "en-NG",
    koboMultiplier: 100, // 1 Naira = 100 kobo
  },
  GHS: {
    code: "GHS",
    symbol: "GH₵",
    locale: "en-GH",
    koboMultiplier: 100, // 1 GHS = 100 pesewas
  },
};

// ============================================================
// Currency Detection
// ============================================================

/**
 * Detect the user's currency based on locale or fallback.
 * For now, defaults to NGN (Nigeria) — update with geo-IP later.
 */
export function detectCurrencyFromLocale(locale?: string): CurrencyCode {
  if (locale?.includes("gh")) return "GHS";
  return "NGN"; // default to Naira
}

// ============================================================
// Tier Definitions
// ============================================================

export type TierId = "free" | "pro" | "team";
export type BillingCycle = "monthly" | "yearly";

export const TIERS: Record<TierId, {
  id: TierId;
  name: string;
  description: string;
  trialDays: number;
  features: string[];
  featuresPro: string[]; // features unlocked by Pro+
  featuresTeam: string[]; // features unlocked by Team
  limits: {
    repositories: number; // -1 = unlimited
    scansPerMonth: number; // -1 = unlimited
    historyDays: number; // -1 = unlimited
    teamMembers: number; // -1 = unlimited
    aiFixReviewsPerMonth: number; // -1 = unlimited
  };
}> = {
  free: {
    id: "free",
    name: "Developer",
    description: "For individual developers and open-source maintainers.",
    trialDays: 0,
    features: [
      "Unlimited repositories",
      "Unlimited vulnerability scanning",
      "30-day scan history",
      "Email notifications",
    ],
    featuresPro: [],
    featuresTeam: [],
    limits: {
      repositories: -1,
      scansPerMonth: -1,
      historyDays: 30,
      teamMembers: 1,
      aiFixReviewsPerMonth: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For professional developers who need AI-powered fixes.",
    trialDays: 14,
    features: [
      "Unlimited repositories",
      "Unlimited vulnerability scanning",
      "AI-powered one-click fix PRs",
      "Exploit scanning",
      "Full scan history",
      "Email + Slack notifications",
      "Priority support",
      "AI fix review (50/month)",
    ],
    featuresPro: [
      "Unlimited AI fix reviews",
    ],
    featuresTeam: [
      "Team collaboration (3 members)",
      "Audit logs",
    ],
    limits: {
      repositories: -1,
      scansPerMonth: -1,
      historyDays: -1,
      teamMembers: 3,
      aiFixReviewsPerMonth: 50,
    },
  },
  team: {
    id: "team",
    name: "Team",
    description: "For teams that need collaboration and compliance tools.",
    trialDays: 14,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Audit logs",
      "Dedicated support",
    ],
    featuresPro: [],
    featuresTeam: [
      "Unlimited AI fix reviews",
      "Custom seat count",
    ],
    limits: {
      repositories: -1,
      scansPerMonth: -1,
      historyDays: -1,
      teamMembers: -1,
      aiFixReviewsPerMonth: -1,
    },
  },
};

// ============================================================
// Pricing Configuration (in kobo — Paystack requires integer kobo amounts)
// ============================================================

export const PRICING: Record<TierId, Record<BillingCycle, number>> = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  pro: {
    monthly: 500000, // ₦5,000/month in kobo
    yearly: 4800000, // ₦48,000/yr (18% off → ~₦4,000/mo)
  },
  team: {
    monthly: 1500000, // ₦15,000/mo base
    yearly: 14400000, // ₦144,000/yr (20% off → ₦12,000/mo)
  },
};

// GHS pricing (for Ghana users)
export const PRICING_GHS: Record<TierId, Record<BillingCycle, number>> = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  pro: {
    monthly: 9900, // GH₵99.00 in pesewas
    yearly: 99000, // GH₵990.00 (same ~17% discount)
  },
  team: {
    monthly: 29900, // GH₵299.00
    yearly: 287000, // GH₵2,870.00 (17% off)
  },
};

// ============================================================
// Paystack Plan IDs (set in Paystack dashboard)
// ============================================================

export const PAYSTACK_PLANS: Record<string, string | undefined> = {
  pro_monthly_ngn: process.env.PAYSTACK_PRO_MONTHLY_NGN,
  pro_yearly_ngn: process.env.PAYSTACK_PRO_YEARLY_NGN,
  team_monthly_ngn: process.env.PAYSTACK_TEAM_MONTHLY_NGN,
  team_yearly_ngn: process.env.PAYSTACK_TEAM_YEARLY_NGN,
  pro_monthly_ghs: process.env.PAYSTACK_PRO_MONTHLY_GHS,
  pro_yearly_ghs: process.env.PAYSTACK_PRO_YEARLY_GHS,
  team_monthly_ghs: process.env.PAYSTACK_TEAM_MONTHLY_GHS,
  team_yearly_ghs: process.env.PAYSTACK_TEAM_YEARLY_GHS,
};

// ============================================================
// Plan Access Functions
// ============================================================

/**
 * Get the plan ID for a tier name (for backward compat with DB).
 */
export function tierToPlanId(tier: TierId): string {
  return tier === "team" ? "pro" : tier;
}

/**
 * Check if a user on the given tier has access to a feature.
 */
export function hasAccess(
  tier: TierId,
  feature: keyof (typeof TIERS)["pro"]["limits"],
  requested: number
): boolean {
  const tierDef = TIERS[tier];
  const limit = tierDef.limits[feature];

  if (limit === -1) return true; // unlimited
  return requested <= limit;
}

/**
 * Check if a tier is above free (has premium features).
 */
export function isPremium(tier: TierId): boolean {
  return tier === "pro" || tier === "team";
}

/**
 * Check if a tier is team-level (has collaboration features).
 */
export function isTeam(tier: TierId): boolean {
  return tier === "team";
}

/**
 * Get pricing in kobo for a tier + billing cycle + currency.
 */
export function getAmount(
  tier: TierId,
  cycle: BillingCycle,
  currency: CurrencyCode = "NGN"
): number {
  if (tier === "free") return 0;

  const amounts = currency === "GHS" ? PRICING_GHS : PRICING;
  return amounts[tier]?.[cycle] ?? 0;
}

/**
 * Get the formatted price string for a tier + billing cycle + currency.
 */
export function formatPrice(
  tier: TierId,
  cycle: BillingCycle,
  currency: CurrencyCode = "NGN"
): string {
  if (tier === "free") return `${CURRENCIES[currency].symbol}0`;

  const amounts = currency === "GHS" ? PRICING_GHS : PRICING;
  const amount = amounts[tier]?.[cycle] ?? 0;
  const { symbol } = CURRENCIES[currency];
  const naira = amount / CURRENCIES[currency].koboMultiplier;

  return `${symbol}${naira.toLocaleString()}`;
}
