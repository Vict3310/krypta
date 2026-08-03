/**
 * REST API - Compliance report download
 * GET /api/v1/compliance/[id]/download
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

    if (report.status !== "completed") {
      return NextResponse.json({ error: "Report not ready for download" }, { status: 400 });
    }

    const response = NextResponse.json(report.data);
    response.headers.set(
      "Content-Type",
      report.format === "json"
        ? "application/json"
        : report.format === "csv"
          ? "text/csv"
          : "application/pdf"
    );
    response.headers.set(
      "Content-Disposition",
      `attachment; filename=compliance-report-${report.id}.${report.format}`
    );
    return response;
  } catch (error) {
    Sentry.captureException(error);
    console.error("Download report error:", error);
    return NextResponse.json({ error: "Failed to download report" }, { status: 500 });
  }
}