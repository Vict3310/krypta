import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { webhookLimiter } from "@/lib/rate-limit";
import { getAmount, type TierId, type BillingCycle, type CurrencyCode } from "@/lib/billing";
import { getClientIp } from "@/lib/security";

/**
 * POST /api/billing/webhook — Handle Paystack webhook events
 *
 * Events to handle:
 * - charge.success: Update user's plan to pro (amount-validated)
 * - charge.failed: Log failure (no action needed)
 * - subscription.enable/disable: Handle subscription lifecycle
 *
 * Security: the Paystack HMAC-SHA512 signature is MANDATORY. Requests without
 * a valid signature are rejected — this endpoint never processes unverified events.
 */

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let index = 0; index < left.length; index += 1) {
    out |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return out === 0;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { success: rateLimitOk } = await webhookLimiter(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  try {
    const rawText = await req.text();

    // Verify webhook signature (Paystack sends x-paystack-signature).
    // Fail closed: a missing or invalid signature is always rejected.
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.error("[Paystack Webhook] Missing signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    const expected = crypto
      .createHmac("sha512", paystackSecret)
      .update(rawText)
      .digest("hex");

    if (!timingSafeEqual(expected, signature)) {
      console.error("[Paystack Webhook] Signature mismatch");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawText);

    // Handle different event types
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event.data);
        break;

      case "subscription.enable":
      case "subscription.confirm":
        await handleSubscriptionEnable(event.data);
        break;

      case "subscription.disable":
        await handleSubscriptionDisable(event.data);
        break;

      default:
        console.log("[Paystack Webhook] Unhandled event:", event.event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Paystack Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const VALID_TIERS: TierId[] = ["free", "pro", "team"];
const VALID_CYCLES: BillingCycle[] = ["monthly", "yearly"];
const VALID_CURRENCIES: CurrencyCode[] = ["NGN", "GHS"];

async function handleChargeSuccess(data: any) {
  const db = createServiceRoleClient();
  const userId = data?.metadata?.user_id;

  if (!userId) {
    console.error("[Paystack Webhook] No user_id in metadata");
    return;
  }

  // Validate the charged amount matches the requested tier/cycle/currency.
  // If it doesn't, refuse to grant the plan (prevents paying the minimum
  // amount and claiming an expensive tier).
  const tier = (data?.metadata?.tier as TierId) || "pro";
  const cycle = (data?.metadata?.cycle as BillingCycle) || "monthly";
  const currency = (data?.metadata?.currency as CurrencyCode) || "NGN";

  if (
    !VALID_TIERS.includes(tier) ||
    !VALID_CYCLES.includes(cycle) ||
    !VALID_CURRENCIES.includes(currency)
  ) {
    console.error("[Paystack Webhook] Invalid tier/cycle/currency in metadata");
    return;
  }

  const expectedAmount = getAmount(tier, cycle, currency);
  const chargedAmount = Number(data?.amount);

  if (Number.isNaN(chargedAmount) || chargedAmount < expectedAmount) {
    console.error(
      `[Paystack Webhook] Amount mismatch for user ${userId}: charged ${chargedAmount}, expected ${expectedAmount} (${tier}/${cycle}/${currency}). Not upgrading.`
    );
    return;
  }

  // Update user's plan to pro
  await db.from("profiles").update({
    plan: "pro",
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  console.log(`[Paystack Webhook] User ${userId} upgraded to Pro`);
}

async function handleSubscriptionEnable(data: any) {
  const customerId = data?.customer?.customer_code;
  const plan = data?.subscription?.plan;

  // In a real implementation, you'd map customerId to user_id
  // For now, log it for investigation
  console.log(`[Paystack Webhook] Subscription enabled: ${customerId}, plan: ${plan}`);
}

async function handleSubscriptionDisable(data: any) {
  const customerId = data?.customer?.customer_code;

  // Downgrade to free
  // In a real implementation, map customerId to user_id
  console.log(`[Paystack Webhook] Subscription disabled: ${customerId}`);
}
