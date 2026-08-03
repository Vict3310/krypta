/**
 * Billing Checkout API
 *
 * POST /api/billing/checkout — Initiate a Paystack checkout for any tier/cycle/currency
 * GET  /api/billing/subscription — Get current subscription status + trial info
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import {
  CURRENCIES,
  getAmount,
  detectCurrencyFromLocale,
  type TierId,
  type BillingCycle,
  type CurrencyCode,
} from "@/lib/billing";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
if (!PAYSTACK_SECRET) {
  console.error("[Paystack] PAYSTACK_SECRET_KEY not configured");
}

// ──────────────────────────────────────────────────────────
// POST /api/billing/checkout
// ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { planId, tier, billingCycle, currency, email } = await req.json();

    // Determine tier — support both legacy planId and new tier param
    let resolvedTier: TierId = "free";
    let resolvedCycle: BillingCycle = "monthly";

    if (planId) {
      // Legacy planId format: "pro_monthly", "team_yearly_ghs", etc.
      const parts = planId.split("_");
      resolvedTier = parts[0] as TierId;
      const lastPart = parts[parts.length - 1];
      resolvedCycle = lastPart === "yearly" ? "yearly" : "monthly";
    } else if (tier) {
      resolvedTier = tier as TierId;
      resolvedCycle = (billingCycle ?? "monthly") as BillingCycle;
    } else {
      return NextResponse.json({ error: "Missing planId or tier parameter" }, { status: 400 });
    }

    // Validate tier
    if (!["free", "pro", "team"].includes(resolvedTier)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Determine currency
    const resolvedCurrency = (currency ?? "NGN") as CurrencyCode;
    if (!["NGN", "GHS"].includes(resolvedCurrency)) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }

    const targetEmail = email || sessionUser.email;
    if (!targetEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Fetch profile — need to check plan, billing_cycle, trial_end_date
    const { data: profile } = await db
      .from("profiles")
      .select("id, plan, billing_cycle, trial_end_date, subscription_end_date")
      .eq("id", sessionUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // If already on this tier or higher, prevent duplicate checkout
    if (profile.plan === "pro" && (resolvedTier === "pro" || resolvedTier === "team")) {
      return NextResponse.json(
        { error: "You are already a subscriber" },
        { status: 400 }
      );
    }

    // Free users can't checkout — they're already on free
    if (resolvedTier === "free") {
      return NextResponse.json(
        { error: "No checkout needed for free plan" },
        { status: 400 }
      );
    }

    // Get amount in kobo
    const amount = getAmount(resolvedTier, resolvedCycle, resolvedCurrency);
    if (amount === 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 500 });
    }

    // Determine if this is a trial checkout
    const isTrial = !profile.trial_end_date && resolvedTier === "pro";

    // Create reference
    const reference = `krypta_${sessionUser.id}_${Date.now()}`;

    // Build metadata. IMPORTANT: never merge client-supplied metadata into the
    // Paystack payload — the webhook trusts this to grant plans/trials, so it
    // must only ever contain values computed server-side.
    const paystackMetadata: Record<string, unknown> = {
      user_id: sessionUser.id,
      tier: resolvedTier,
      cycle: resolvedCycle,
      currency: resolvedCurrency,
      is_trial: isTrial,
    };

    // Call Paystack API
    const paystackUrl = "https://api.paystack.co/transaction/initialize";
    const paystackBody: Record<string, unknown> = {
      email: targetEmail,
      amount,
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/callback`,
      metadata: paystackMetadata,
    };

    // For trial checkouts, set duration_in_months to 1
    // (Paystack doesn't have a trial_days param, so we handle trial logic server-side after charge.success)
    if (isTrial) {
      (paystackBody.metadata as Record<string, unknown>).trial_days = 14;
    }

    const response = await fetch(paystackUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackBody),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error("[Paystack] Checkout failed:", data);
      return NextResponse.json(
        { error: data.message || "Failed to initialize checkout" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorizationUrl: data.authorization_url,
      reference: data.reference,
      isTrial,
    });
  } catch (error) {
    console.error("[Paystack] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────
// GET /api/billing/subscription
// ──────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { data: profile } = await db
      .from("profiles")
      .select("plan, billing_cycle, trial_end_date, subscription_end_date, cancelled_at")
      .eq("id", sessionUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Determine the actual active tier
    let currentTier: TierId = "free";
    let inTrial = false;
    let trialEnds = null as string | null;
    let subscriptionEnds = null as string | null;
    let cancelled = false;

    if (profile.plan === "pro") {
      // Check if still in trial period
      if (profile.trial_end_date && new Date(profile.trial_end_date) > new Date()) {
        currentTier = "pro";
        inTrial = true;
        trialEnds = profile.trial_end_date;
      } else if (profile.subscription_end_date && new Date(profile.subscription_end_date) > new Date()) {
        // Subscription still active (past trial but not yet expired)
        currentTier = "pro";
        subscriptionEnds = profile.subscription_end_date;
      }
      if (profile.cancelled_at) cancelled = true;
    }

    return NextResponse.json({
      tier: currentTier,
      plan: profile.plan,
      billing_cycle: profile.billing_cycle,
      in_trial: inTrial,
      trial_ends_at: trialEnds,
      subscription_ends_at: subscriptionEnds,
      cancelled,
    });
  } catch (error) {
    console.error("[Billing] Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
