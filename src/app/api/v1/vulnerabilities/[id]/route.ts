/**
 * REST API - Vulnerability details + status updates
 * GET /api/v1/vulnerabilities/[id]
 * PATCH /api/v1/vulnerabilities/[id]
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServiceRoleClient();

    const { data: vulnerability, error } = await supabase
      .from("vulnerabilities")
      .select(`
        *,
        scans!inner(
          repositories!inner(full_name, user_id),
          scan_results(*)
        )
      `)
      .eq("id", id)
      .eq("scans.repositories.user_id", auth.user.id)
      .single();

    if (error || !vulnerability) {
      return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
    }

    return NextResponse.json({ data: vulnerability });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get vulnerability error:", error);
    return NextResponse.json({ error: "Failed to fetch vulnerability" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { status, snoozed_until } = body;

    if (!status || !["open", "fixed", "dismissed", "snoozed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: open, fixed, dismissed, or snoozed" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: vulnerability, error } = await supabase
      .from("vulnerabilities")
      .update({
        status,
        snoozed_until: status === "snoozed" ? snoozed_until : null,
      })
      .eq("id", id)
      .select(`
        *,
        scans!inner(repositories!inner(user_id))
      `)
      .eq("scans.repositories.user_id", auth.user.id)
      .single();

    if (error || !vulnerability) {
      return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
    }

    return NextResponse.json({ data: vulnerability });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Update vulnerability error:", error);
    return NextResponse.json({ error: "Failed to update vulnerability" }, { status: 500 });
  }
}
