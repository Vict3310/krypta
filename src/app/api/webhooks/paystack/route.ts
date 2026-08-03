/**
 * Paystack Webhook Handler
 *
 * Handles:
 * - charge.success: Payment completed — activate trial or subscription
 * - subscription.create: Recurring subscription created (not commonly used)
 * - subscription.disable: Subscription cancelled by user/Paystack
 * - transaction.complete: Fallback for one-time payments
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { z } from "zod";
import { webhookLimiter } from "@/lib/rate-limit";
import { getAmount, type TierId, type BillingCycle, type CurrencyCode } from "@/lib/billing";
import { getClientIp } from "@/lib/security";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const PaystackWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    customer: z.object({ email: z.string().email() }).optional(),
    amount: z.number().optional(),
    metadata: z.any().optional(),
    status: z.string().optional(),
    reference: z.string().optional(),
  }),
});

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let index = 0; index < left.length; index += 1) {
    out |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return out === 0;
}

export async function POST(req: Request) {
  // Rate limiting
  const ip = getClientIp(req);
  const result = await webhookLimiter(ip);
  if (!result.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const text = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!PAYSTACK_SECRET) {
      console.error("[Paystack] PAYSTACK_SECRET_KEY not configured");
      Sentry.captureException(new Error("PAYSTACK_SECRET_KEY not configured"));
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify Paystack Webhook Signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(text)
      .digest("hex");

    if (!timingSafeEqual(hash, signature)) {
      Sentry.captureEvent({
        level: "warning",
        message: "Invalid Paystack signature",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Validate payload structure
    let parsed;
    try {
      parsed = PaystackWebhookSchema.parse(JSON.parse(text));
    } catch {
      return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 });
    }

    const event = parsed.event;
    const supabase = createServiceRoleClient();
    const customer = parsed.data.customer?.email;

    // ──────────────────────────────────────────────────────
    // charge.success — One-time payment completed
    // ──────────────────────────────────────────────────────
    if (event === "charge.success") {
      if (!customer) return NextResponse.json({ status: "success" });

      const { data: userData } = await supabase.rpc('get_user_by_email', { p_email: customer });
      if (!userData || !(userData as any).id) {
        console.warn("[Paystack] charge.success: user not found by email");
        return NextResponse.json({ status: "success" });
      }

      const userId = (userData as any).id;
      const metadata = (parsed.data.metadata ?? {}) as Record<string, unknown>;
      const tier = ["free", "pro", "team"].includes(metadata.tier as string) ? (metadata.tier as TierId) : "pro";
      const cycle = metadata.cycle === "yearly" ? "yearly" : "monthly";
      const currency = metadata.currency === "GHS" ? "GHS" : "NGN";
      const isTrial = (metadata.is_trial as boolean) === true;
      const trialDays = Math.min(Math.max(Number(metadata.trial_days) || (tier === "pro" ? 14 : 0), 0), 365);

      // Refuse to grant the plan if the charged amount doesn't match the tier.
      const expectedAmount = getAmount(tier, cycle, currency);
      if (Number(parsed.data.amount) < expectedAmount) {
        console.error(
          `[Paystack] charge.success amount mismatch for user ${userId}: charged ${parsed.data.amount}, expected ${expectedAmount} (${tier}/${cycle}/${currency}). Not upgrading.`
        );
        Sentry.captureMessage("Paystack charge.success amount mismatch — user not upgraded", {
          level: "warning",
          extra: { userId, charged: parsed.data.amount, expected: expectedAmount, tier, cycle, currency },
        });
        return NextResponse.json({ status: "success" });
      }

      // Calculate billing period end (30 days for monthly, 365 for yearly)
      const periodDays = cycle === "yearly" ? 365 : 30;
      const subscriptionEnd = new Date();
      subscriptionEnd.setDate(subscriptionEnd.getDate() + periodDays);

      if (isTrial) {
        // Start trial — user gets access for trialDays, auto-converts to paid after
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        await supabase
          .from("profiles")
          .update({
            plan: tier === "team" ? "pro" : tier,
            trial_end_date: trialEnd.toISOString(),
            trial_started_at: new Date().toISOString(),
            billing_cycle: cycle,
            subscription_end_date: null, // Will be set when trial converts or is cancelled
          })
          .eq("id", userId);

        console.log(`✅ Paystack: Trial started for ${userId} (tier=${tier}, trial_ends=${trialEnd.toISOString()})`);
      } else {
        // Direct subscription — no trial
        await supabase
          .from("profiles")
          .update({
            plan: tier === "team" ? "pro" : tier,
            trial_end_date: null, // Clear any existing trial
            trial_started_at: null,
            billing_cycle: cycle,
            subscription_end_date: subscriptionEnd.toISOString(),
            cancelled_at: null, // Clear any cancellation
            cancellation_reason: null,
          })
          .eq("id", userId);

        console.log(`✅ Paystack: Subscription activated for ${userId} (tier=${tier}, ends=${subscriptionEnd.toISOString()})`);
      }
    }

    // ──────────────────────────────────────────────────────
    // subscription.create — Recurring subscription (rare for Paystack)
    // ──────────────────────────────────────────────────────
    if (event === "subscription.create") {
      if (!customer) return NextResponse.json({ status: "success" });

      const { data: userData } = await supabase.rpc('get_user_by_email', { p_email: customer });
      if (userData && (userData as any).id) {
        await supabase
          .from("profiles")
          .update({ plan: "pro" })
          .eq("id", (userData as any).id);
        console.log("✅ Paystack: Recurring subscription created");
      }
    }

    // ──────────────────────────────────────────────────────
    // subscription.disable — User/Paystack cancelled recurring
    // ──────────────────────────────────────────────────────
    if (event === "subscription.disable") {
      if (!customer) return NextResponse.json({ status: "success" });

      const { data: userData } = await supabase.rpc('get_user_by_email', { p_email: customer });
      if (userData && (userData as any).id) {
        // Don't immediately downgrade — user may still be in trial/subscription period
        await supabase
          .from("profiles")
          .update({
            subscription_end_date: new Date().toISOString(),
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", (userData as any).id);
        console.log("ℹ️ Paystack: Subscription disabled for user");
      }
    }

    // ──────────────────────────────────────────────────────
    // transaction.complete — Fallback for successful payments
    // ──────────────────────────────────────────────────────
    if (event === "transaction.complete") {
      // Same logic as charge.success — but only upgrade when the charged
      // amount matches the Pro tier price (prevents minimum-payment upgrades).
      if (!customer) return NextResponse.json({ status: "success" });

      const expectedAmount = getAmount("pro", "monthly", "NGN");
      if (Number(parsed.data.amount) < expectedAmount) {
        console.error(
          `[Paystack] transaction.complete amount mismatch: charged ${parsed.data.amount}, expected ${expectedAmount}. Not upgrading.`
        );
        Sentry.captureMessage("Paystack transaction.complete amount mismatch — user not upgraded", {
          level: "warning",
          extra: { charged: parsed.data.amount, expected: expectedAmount },
        });
        return NextResponse.json({ status: "success" });
      }

      const { data: userData } = await supabase.rpc('get_user_by_email', { p_email: customer });
      if (userData && (userData as any).id) {
        await supabase
          .from("profiles")
          .update({ plan: "pro" })
          .eq("id", (userData as any).id);
        console.log("✅ Paystack: Transaction completed");
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("[Paystack] Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
