/**
 * REST API - Scans
 * Programmatic access to scanning functionality
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";

// GET /api/v1/scans - List all scans
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
    const status = searchParams.get("status");

    const supabase = createServiceRoleClient();

    let query = supabase
      .from("scans")
      .select(`
        *,
        repositories(full_name, default_branch),
        scan_results(count)
      `, { count: "exact" })
      .eq("repository_id", "owner")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: scans, error, count } = await query;

    if (error) throw error;

    const response = NextResponse.json({
      data: scans,
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
    console.error("List scans error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scans" },
      { status: 500 }
    );
  }
}

// POST /api/v1/scans - Trigger a new scan
export async function POST(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { repository, branch = "main", commit_sha } = body;

    if (!repository) {
      return NextResponse.json(
        { error: "Missing required field: repository" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Find repository
    const { data: repo } = await supabase
      .from("repositories")
      .select("id")
      .eq("full_name", repository)
      .eq("user_id", auth.user.id)
      .single();

    if (!repo) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Create scan
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .insert({
        repository_id: repo.id,
        branch,
        commit_sha: commit_sha || undefined,
        status: "pending",
      })
      .select()
      .single();

    if (scanError) throw scanError;

    // Trigger async scan (in production, use a worker queue)
    triggerScan(repo.id, branch, commit_sha);

    return NextResponse.json(
      {
        message: "Scan initiated",
        scan: {
          id: scan.id,
          status: scan.status,
          branch: scan.branch,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Trigger scan error:", error);
    return NextResponse.json(
      { error: "Failed to trigger scan" },
      { status: 500 }
    );
  }
}

// GET /api/v1/scans/:id - Get scan details
export async function GET_STATIC(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: scan, error } = await supabase
      .from("scans")
      .select(`
        *,
        repositories(full_name, default_branch),
        scan_results(*)
      `)
      .eq("id", params.id)
      .single();

    if (error || !scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: scan });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get scan error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scan" },
      { status: 500 }
    );
  }
}

// Helper function to trigger scan (should be moved to a worker in production)
async function triggerScan(
  repositoryId: string,
  branch: string,
  commitSha?: string | null
) {
  // In production, this should use a job queue (e.g., Bull, Upstash Q)
  // For now, we'll just update the status
  const supabase = createServiceRoleClient();

  await supabase
    .from("scans")
    .update({ status: "scanning" })
    .eq("repository_id", repositoryId)
    .eq("branch", branch);

  // Simulate scan completion (in production, use actual scanning logic)
  setTimeout(async () => {
    await supabase
      .from("scans")
      .update({ status: "clean", completed_at: new Date().toISOString() })
      .eq("repository_id", repositoryId)
      .eq("branch", branch);
  }, 5000);
}
