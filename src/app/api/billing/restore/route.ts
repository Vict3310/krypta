/**
 * Restore Subscription API
 *
 * POST /api/billing/restore — Re-enable subscription after cancellation
 *         (only works while subscription_end_date is still in the future)
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function POST() {
  const supabase = await createClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    // Fetch current profile
    const { data: profile } = await db
      .from("profiles")
      .select("id, plan, subscription_end_date, cancelled_at")
      .eq("id", sessionUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.plan !== "pro" || !profile.cancelled_at) {
      return NextResponse.json(
        { error: "No cancelled subscription to restore" },
        { status: 400 }
      );
    }

    // Check if subscription period is still active
    if (profile.subscription_end_date && new Date(profile.subscription_end_date) < new Date()) {
      return NextResponse.json(
        { error: "Subscription period has expired. Please subscribe again." },
        { status: 400 }
      );
    }

    // Restore: clear cancellation, reset subscription_end_date to ~1 month from now
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    await db
      .from("profiles")
      .update({
        cancelled_at: null,
        cancellation_reason: null,
        subscription_end_date: oneMonthFromNow.toISOString(),
      })
      .eq("id", sessionUser.id);

    return NextResponse.json({
      message: "Subscription restored",
      subscription_ends_at: oneMonthFromNow.toISOString(),
    });
  } catch (error) {
    console.error("[Restore] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
