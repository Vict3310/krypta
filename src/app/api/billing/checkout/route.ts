import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { PAYSTACK_PLANS, PlanId } from "@/lib/billing";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
if (!PAYSTACK_SECRET) {
  console.error("[Paystack] PAYSTACK_SECRET_KEY not configured");
}

// POST /api/billing/checkout — Initiate a Paystack checkout
export async function POST(req: Request) {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { planId, email } = await req.json();

    if (!planId || !["pro_monthly", "pro_yearly"].includes(planId)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    // Get user's email from Supabase
    const targetEmail = email || session.user.email;
    if (!targetEmail) {
      return NextResponse.json(
        { error: "No email found" },
        { status: 400 }
      );
    }

    // Verify user owns this account (check against profiles table)
    const { data: profile } = await db
      .from("profiles")
      .select("id, plan")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // If already pro, prevent duplicate checkout
    if (profile.plan === "pro") {
      return NextResponse.json(
        { error: "You are already a Pro subscriber" },
        { status: 400 }
      );
    }

    // Get Paystack plan reference
    const paystackPlan = PAYSTACK_PLANS[planId as keyof typeof PAYSTACK_PLANS];
    if (!paystackPlan) {
      return NextResponse.json(
        { error: "Plan not configured in Paystack" },
        { status: 500 }
      );
    }

    // Create checkout session via Paystack API
    const amountMap: Record<string, number> = {
      pro_monthly: 9900, // 99 GHS in kobo
      pro_yearly: 99000, // 990 GHS in kobo
    };

    const amount = amountMap[planId];
    const reference = `krypta_${session.user.id}_${Date.now()}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: targetEmail,
        amount,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/callback`,
        metadata: {
          user_id: session.user.id,
          plan: planId,
        },
      }),
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
    });
  } catch (error) {
    console.error("[Paystack] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/billing/subscription — Get current subscription status
export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { data: profile } = await db
      .from("profiles")
      .select("plan")
      .eq("id", session.user.id)
      .single();

    return NextResponse.json({
      plan: profile?.plan || "free",
    });
  } catch (error) {
    console.error("[Billing] Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
