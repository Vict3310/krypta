/**
 * REST API - Check codebase for a known vulnerability
 * POST /api/v1/vulns/database/[id]/check
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { repository, branch = "main" } = body;

    if (!repository) {
      return NextResponse.json(
        { error: "Missing required field: repository" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: vuln } = await supabase
      .from("vulnerability_database")
      .select("*")
      .eq("id", id)
      .single();

    if (!vuln) {
      return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
    }

    const { data: existingChecks } = await supabase
      .from("vulnerability_checks")
      .select("*")
      .eq("vulnerability_id", id)
      .eq("repository", repository);

    const isPresent = vuln.affected_files?.some((file: string) =>
      existingChecks?.some((check: any) =>
        check.file?.includes(file) && check.status === "present"
      )
    );

    const { data: check, error: checkError } = await supabase
      .from("vulnerability_checks")
      .insert({
        vulnerability_id: id,
        repository,
        branch,
        status: isPresent ? "present" : "not_found",
        checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (checkError) throw checkError;

    return NextResponse.json({
      message: "Vulnerability check completed",
      result: { found: isPresent, check },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Check vulnerability error:", error);
    return NextResponse.json({ error: "Failed to check vulnerability" }, { status: 500 });
  }
}
