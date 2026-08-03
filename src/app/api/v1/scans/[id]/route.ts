/**
 * REST API - Scan details
 * GET /api/v1/scans/[id]
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

    const { data: scan, error } = await supabase
      .from("scans")
      .select(`
        *,
        repositories!inner(full_name, default_branch, user_id),
        scan_results(*)
      `)
      .eq("id", id)
      .eq("repositories.user_id", auth.user.id)
      .single();

    if (error || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json({ data: scan });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get scan error:", error);
    return NextResponse.json({ error: "Failed to fetch scan" }, { status: 500 });
  }
}
