/**
 * CI/CD Scan Trigger API
 * Called by GitHub Actions or other CI systems to trigger a scan
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { scanCodeSnippet } from "@/lib/ai";
import { createFixPullRequest, getGitHubAppToken } from "@/lib/github";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { Octokit } from "octokit";

// Rate limiting for CI/CD triggers
const triggerCooldowns = new Map<string, number>();

export async function POST(req: Request) {
  try {
    const { repositoryId, branch } = await req.json();

    if (!repositoryId || !branch) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, branch" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

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

    // Fetch repository
    const { data: repo, error: repoError } = await supabase
      .from("repositories")
      .select("*, repositories(full_name, github_repo_id), profiles(id, full_name)")
      .eq("id", repositoryId)
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
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${branch}`,
      });

      const commitSha = (refData.object as any).sha;

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

      // Fetch and scan files from the latest commit
      const { data: commitData } = await octokit.rest.repos.getCommit({
        owner,
        repo: repoName,
        ref: commitSha,
      });

      const files = (commitData as any)?.files || [];
      let filesScanned = 0;
      let vulnerabilitiesFound: Array<{
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

        try {
          const scanResult = await scanCodeSnippet(content, filePath);
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
          Sentry.captureException(scanError, {
            tags: { filePath, commitSha },
          });
        }
      }

      if (vulnerabilitiesFound.length > 0) {
        const highestSeverity = vulnerabilitiesFound[0].severity;

        for (const finding of vulnerabilitiesFound) {
          let prUrl: string | null = null;
          try {
            prUrl = await createFixPullRequest(
              owner,
              repoName,
              finding.filePath,
              finding.fixedCode,
              finding.vulnerabilityType,
              branch
            );
          } catch (e) {
            Sentry.captureException(e, { tags: { filePath: finding.filePath } });
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
      Sentry.captureException(error, { tags: { owner, repoName, branch } });
      return NextResponse.json({ error: "Failed to fetch or scan repository" }, { status: 500 });
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error("CI/CD trigger error:", error);
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
