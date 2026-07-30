import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";

/**
 * POST /api/billing/webhook — Handle Paystack webhook events
 *
 * Events to handle:
 * - charge.success: Update user's plan to pro
 * - charge.failed: Log failure (no action needed)
 * - subscription.enable/disable: Handle subscription lifecycle
 */

export async function POST(req: Request) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  try {
    const event = await req.json();

    // Verify webhook signature (Paystack sends x-paystack-signature)
    const signature = req.headers.get("x-paystack-signature");
    if (signature) {
      const expected = crypto
        .createHmac("sha512", paystackSecret)
        .update(JSON.stringify(event))
        .digest("hex");

      if (signature !== expected) {
        console.error("[Paystack Webhook] Signature mismatch");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

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

async function handleChargeSuccess(data: any) {
  const db = createServiceRoleClient();
  const userId = data?.metadata?.user_id;

  if (!userId) {
    console.error("[Paystack Webhook] No user_id in metadata");
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
  const db = createServiceRoleClient();
  const customerId = data?.customer?.customer_code;
  const plan = data?.subscription?.plan;

  // In a real implementation, you'd map customerId to user_id
  // For now, log it for investigation
  console.log(`[Paystack Webhook] Subscription enabled: ${customerId}, plan: ${plan}`);
}

async function handleSubscriptionDisable(data: any) {
  const db = createServiceRoleClient();
  const customerId = data?.customer?.customer_code;

  // Downgrade to free
  // In a real implementation, map customerId to user_id
  console.log(`[Paystack Webhook] Subscription disabled: ${customerId}`);
}
