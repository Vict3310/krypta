import { createServiceRoleClient } from "@/utils/supabase/service";
import { scanCodeSnippet } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

/**
 * CI/CD Scan Trigger API (AI-based)
 * Called by GitHub Actions or other CI systems to trigger an AI-powered scan.
 * Uses scanCodeSnippet from ai.ts which generates fixed_code.
 */
import { NextResponse } from "next/server";
import { createFixPullRequest, getGitHubAppToken } from "@/lib/github";
import { requireUser } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import { Octokit } from "octokit";

// Rate limiting for CI/CD triggers
const triggerCooldowns = new Map<string, number>();

// File size limit (50KB)
const MAX_FILE_SIZE = 50 * 1024;

export async function POST(req: Request) {
  try {
    const { repositoryId, branch } = await req.json();

    if (!repositoryId || !branch) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, branch" },
        { status: 400 }
      );
    }

    // Authenticate: accept an API key (CI/CD) or a session cookie (dashboard).
    let authUserId: string;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const apiAuth = await validateApiKey(req);
      if ("error" in apiAuth) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
      authUserId = apiAuth.user.id;
    } else {
      const sessionAuth = await requireUser();
      if ("error" in sessionAuth) return sessionAuth.error;
      authUserId = sessionAuth.user.id;
    }

    // Rate limit: 1 trigger per repo per 60 seconds
    const now = Date.now();
    const lastTrigger = triggerCooldowns.get(repositoryId) ?? 0;
    if (now - lastTrigger < 60000) {
      return NextResponse.json(
        { error: "Please wait 60 seconds between triggers" },
        { status: 429 }
      );
    }
    triggerCooldowns.set(repositoryId, now);

    const supabase = createServiceRoleClient();

    // Fetch repository — must belong to the authenticated user
    const { data: repo, error: repoError } = await supabase
      .from("repositories")
      .select("*")
      .eq("id", repositoryId)
      .eq("user_id", authUserId)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const owner = repo.full_name.split("/")[0];
    const repoName = repo.full_name.split("/")[1];

    // Get GitHub App Installation Access Token
    const githubToken = await getGitHubAppToken();
    const octokit = new Octokit({ auth: githubToken });

    try {
      // Get latest commit SHA
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${branch}`,
      });

      const commitSha = (refData.object as any)?.sha;

      // Create scan record
      const { data: scan } = await supabase
        .from("scans")
        .insert({
          repository_id: repo.id,
          commit_sha: commitSha,
          branch,
          status: "scanning",
        })
        .select()
        .single();

      if (!scan) throw new Error("Failed to create scan record");

      // Fetch and scan files using AI
      const { data: commitData } = await octokit.rest.repos.getCommit({
        owner,
        repo: repoName,
        ref: commitSha,
      });

      const files = (commitData as any)?.files || [];
      let filesScanned = 0;
      const vulnerabilitiesFound: Array<{
        filePath: string;
        vulnerabilityType: string;
        severity: string;
        explanation: string;
        fixedCode: string;
        vulnerableCode: string;
      }> = [];

      for (const file of files) {
        const filePath = file.filename;
        if (!isCodeFile(filePath)) continue;

        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo: repoName,
          path: filePath,
          ref: commitSha,
        });

        if ((fileData as any)?.type !== "file") continue;

        const content = Buffer.from((fileData as any)?.content, "base64").toString("utf-8");

        // Skip large files
        if (content.length > MAX_FILE_SIZE) continue;

        try {
          const scanResult = await scanCodeSnippet(content, filePath, {
            minConfidence: 0.75,
          });
          filesScanned++;

          if (scanResult.hasVulnerability && scanResult.fixedCode) {
            vulnerabilitiesFound.push({
              filePath,
              vulnerabilityType: scanResult.type || "Unknown Vulnerability",
              severity: scanResult.severity || "Medium",
              explanation: scanResult.plainEnglishExplanation || "A vulnerability was detected.",
              fixedCode: scanResult.fixedCode,
              vulnerableCode: content,
            });
          }
        } catch (scanError) {
          console.error(`[AI Scan] Error scanning ${filePath}:`, scanError);
          // Continue with other files
        }
      }

      if (vulnerabilitiesFound.length > 0) {
        for (const finding of vulnerabilitiesFound) {
          let prUrl: string | null = null;
          try {
            // Only create PRs for high-severity findings
            if (finding.severity === "High" || finding.severity === "Critical") {
              prUrl = await createFixPullRequest(
                owner,
                repoName,
                finding.filePath,
                finding.fixedCode,
                finding.vulnerabilityType,
                branch
              );
            }
          } catch (e) {
            console.error(`[AI Scan] Failed to create PR for ${finding.filePath}:`, e);
          }

          await supabase.from("vulnerabilities").insert({
            scan_id: scan.id,
            file_path: finding.filePath,
            vulnerability_type: finding.vulnerabilityType,
            severity: finding.severity,
            plain_english_explanation: finding.explanation,
            vulnerable_code: finding.vulnerableCode,
            fixed_code: finding.fixedCode,
            pr_url: prUrl,
            status: "open",
          });
        }

        await supabase.from("scans").update({
          status: "vulnerable",
          completed_at: new Date().toISOString(),
        }).eq("id", scan.id);

        return NextResponse.json({
          message: `${vulnerabilitiesFound.length} vulnerability(ies) found`,
          scanId: scan.id,
          vulnerabilities: vulnerabilitiesFound.length,
        });
      }

      await supabase.from("scans").update({
        status: "clean",
        completed_at: new Date().toISOString(),
      }).eq("id", scan.id);

      return NextResponse.json({
        message: "Code is clean",
        scanId: scan.id,
        filesScanned,
      });
    } catch (error) {
      console.error("[CI/CD] GitHub API error:", error);
      return NextResponse.json({ error: "Failed to fetch or scan repository" }, { status: 500 });
    }
  } catch (error) {
    console.error("[CI/CD] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rs", ".rb",
    ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".kt", ".scala",
    ".sh", ".bash", ".yml", ".yaml", ".json", ".xml", ".html",
  ];
  const ext = "." + filePath.split(".").pop()?.toLowerCase();
  return codeExtensions.includes(ext);
}
