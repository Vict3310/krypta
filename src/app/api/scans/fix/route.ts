/**
 * Fix Vulnerability API
 * Creates a PR with the fix for a specific vulnerability
 */
import { NextResponse } from "next/server";
import { createFixPullRequest } from "@/lib/github";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { apiLimiter } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = getClientIp(req);
    const { success } = await apiLimiter(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { vulnerabilityId, filePath, vulnerabilityType, branch } = await req.json();

    if (!vulnerabilityId || !filePath || !vulnerabilityType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Authenticate the requesting user
    const authClient = await createClient();
    const { data: { user: requestingUser } } = await authClient.auth.getUser();
    if (!requestingUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the vulnerability details — fetch nested scan → repository → user_id + full_name
    const { data: vulnerability, error: vulnError } = await supabase
      .from("vulnerabilities")
      .select("*, scans(id, repository_id, branch, repositories(user_id, full_name))")
      .eq("id", vulnerabilityId)
      .single();

    if (vulnError || !vulnerability) {
      return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
    }

    // Verify ownership: the requesting user must own the repository
    const repo = (vulnerability.scans as any)?.repositories;
    if (!repo) {
      return NextResponse.json({ error: "Vulnerability has no repository" }, { status: 404 });
    }

    const repoUserId = repo.user_id;
    if (repoUserId !== requestingUser.id) {
      return NextResponse.json(
        { error: "Unauthorized — you do not own this repository" },
        { status: 403 }
      );
    }

    // The file path must match the vulnerability's recorded path (don't let
    // clients redirect fixes to arbitrary files).
    if (vulnerability.file_path && filePath !== vulnerability.file_path) {
      return NextResponse.json(
        { error: "filePath does not match the vulnerability's file" },
        { status: 400 }
      );
    }

    const [owner, repoName] = repo.full_name.split("/");

    // Use the fixed_code if already provided, otherwise just update status
    let prUrl: string | null = null;

    if (vulnerability.fixed_code) {
      try {
        prUrl = await createFixPullRequest(
          owner,
          repoName,
          filePath,
          vulnerability.fixed_code,
          vulnerabilityType
        );
      } catch (e) {
        console.error("Failed to create PR:", e);
        // Continue even if PR creation fails
      }
    }

    // Update vulnerability status
    await supabase
      .from("vulnerabilities")
      .update({ status: "fixed", pr_url: prUrl })
      .eq("id", vulnerabilityId);

    return NextResponse.json({
      message: "Fix applied",
      prUrl,
    });
  } catch (error) {
    console.error("Fix API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
