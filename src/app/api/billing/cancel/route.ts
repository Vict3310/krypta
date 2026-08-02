/**
 * Cancel Subscription API
 *
 * POST /api/billing/cancel — Cancel subscription at end of current billing period
 *         (user keeps access until trial/subscription end date)
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { reason } = await req.json();

    // Fetch current profile
    const { data: profile } = await db
      .from("profiles")
      .select("id, plan, trial_end_date, subscription_end_date")
      .eq("id", sessionUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.plan !== "pro") {
      return NextResponse.json(
        { error: "No active subscription to cancel" },
        { status: 400 }
      );
    }

    // If in trial, end trial immediately (no payment was made)
    if (profile.trial_end_date && new Date(profile.trial_end_date) > new Date()) {
      await db
        .from("profiles")
        .update({
          plan: "free",
          trial_end_date: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || null,
        })
        .eq("id", sessionUser.id);

      return NextResponse.json({
        message: "Trial cancelled",
        plan: "free",
      });
    }

    // Set subscription to end at current period end — user keeps access
    if (profile.subscription_end_date) {
      await db
        .from("profiles")
        .update({
          subscription_end_date: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || null,
        })
        .eq("id", sessionUser.id);

      return NextResponse.json({
        message: "Subscription cancelled — access until billing period ends",
        subscription_ends_at: profile.subscription_end_date,
      });
    }

    // No subscription_end_date set — just mark as cancelled
    await db
      .from("profiles")
      .update({
        subscription_end_date: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq("id", sessionUser.id);

    return NextResponse.json({
      message: "Subscription cancelled",
      subscription_ends_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cancel] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
