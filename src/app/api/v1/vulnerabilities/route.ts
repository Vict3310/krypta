/**
 * REST API - Vulnerabilities
 * Programmatic access to vulnerability data
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";

// GET /api/v1/vulnerabilities - List vulnerabilities
export async function GET(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const repository = searchParams.get("repository");

    const supabase = createServiceRoleClient();

    let query = supabase
      .from("vulnerabilities")
      .select(`
        *,
        scans!inner(
          repositories!inner(full_name, user_id)
        )
      `, { count: "exact" })
      .eq("scans.repositories.user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (severity) {
      query = query.eq("severity", severity);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (repository) {
      query = query.eq("scans.repositories.full_name", repository);
    }

    const { data: vulnerabilities, error, count } = await query;

    if (error) throw error;

    const response = NextResponse.json({
      data: vulnerabilities,
      pagination: {
        limit,
        offset,
        total: count,
        has_more: offset + limit < (count || 0),
      },
    });

    response.headers.set("X-Total-Count", String(count));
    return response;
  } catch (error) {
    Sentry.captureException(error);
    console.error("List vulnerabilities error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vulnerabilities" },
      { status: 500 }
    );
  }
}

// GET /api/v1/vulnerabilities/[id] - Get vulnerability details
export async function GET_STATIC(request: Request, context: any) {
  try {
    const { id } = context.params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
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
      return NextResponse.json(
        { error: "Vulnerability not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: vulnerability });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get vulnerability error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vulnerability" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/vulnerabilities/[id] - Update vulnerability status
export async function PATCH(request: Request, context: any) {
  try {
    const { id } = context.params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
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
      return NextResponse.json(
        { error: "Vulnerability not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: vulnerability });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Update vulnerability error:", error);
    return NextResponse.json(
      { error: "Failed to update vulnerability" },
      { status: 500 }
    );
  }
}
