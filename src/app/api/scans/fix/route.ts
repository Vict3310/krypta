/**
 * Fix Vulnerability API
 * Creates a PR with the fix for a specific vulnerability
 */
import { NextResponse } from "next/server";
import { createFixPullRequest } from "@/lib/github";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { apiLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
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

    // Get the vulnerability details
    const { data: vulnerability, error: vulnError } = await supabase
      .from("vulnerabilities")
      .select("*, scan_id, scans(repository_id, scans(branch))")
      .eq("id", vulnerabilityId)
      .single();

    if (vulnError || !vulnerability) {
      return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
    }

    // Get the repository info
    const { data: repo } = await supabase
      .from("repositories")
      .select("full_name")
      .eq("id", vulnerability.repository_id)
      .single();

    if (!repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
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
