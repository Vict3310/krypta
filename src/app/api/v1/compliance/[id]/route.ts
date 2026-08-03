/**
 * REST API - Compliance report details
 * GET /api/v1/compliance/[id]
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

    const { data: report, error } = await supabase
      .from("compliance_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get compliance report error:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}