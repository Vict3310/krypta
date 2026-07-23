import { NextResponse } from "next/server";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { rateLimit, webhookLimiter } from "@/lib/rate-limit";
import { scanCodeSnippet, type ScanRules } from "@/lib/ai";
import { createFixPullRequest, getGitHubAppToken } from "@/lib/github";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendCriticalVulnerabilityEmail } from "@/lib/emails";
import { sendSlackNotification } from "@/lib/slack";
import { Octokit } from "octokit";
import { z } from "zod";

const GitHubPushSchema = z.object({
  ref: z.string(),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    owner: z.object({ login: z.string() }).or(z.object({ login: z.string() })),
  }),
  commits: z.array(z.object({ id: z.string() })).optional(),
});

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || "webhook";
  const result = await webhookLimiter(ip);
  if (!result.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const payloadText = await req.text();
    const headers = req.headers;
    const event = headers.get("x-github-event");
    const signature = headers.get("x-hub-signature-256");

    if (event !== "push") {
      return NextResponse.json({ message: "Event ignored" });
    }

    const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      console.error("GITHUB_WEBHOOK_SECRET not configured");
      Sentry.captureException(new Error("GITHUB_WEBHOOK_SECRET not configured"));
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Verify webhook signature
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    const digest = "sha256=" + hmac.update(payloadText).digest("hex");

    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      Sentry.captureEvent({
        level: "warning",
        message: "Invalid webhook signature",
        extra: { ip },
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Validate payload
    let parsed;
    try {
      parsed = GitHubPushSchema.parse(JSON.parse(payloadText));
    } catch {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const { ref, repository, commits } = parsed;
    const githubRepoId = repository.id;
    const branch = ref.replace("refs/heads/", "");
    const commitSha = commits?.[0]?.id || "unknown";
    const owner = repository.owner.login;
    const repoName = repository.name;

    const supabase = createServiceRoleClient();

    const { data: dbRepo } = await supabase
      .from("repositories")
      .select("id, full_name, profiles(id, full_name)")
      .eq("github_repo_id", githubRepoId)
      .single();

    if (!dbRepo) {
      return NextResponse.json({ message: "Repository not connected to Krypta" });
    }

    // Fetch repository scanning rules
    const { data: repoSettings } = await supabase
      .from("repository_settings")
      .select("*")
      .eq("repository_id", dbRepo.id)
      .single();

    const scanRules: ScanRules = {
      minSeverity: repoSettings?.min_severity ?? "Low",
      excludePaths: repoSettings?.exclude_paths ?? [],
      includePaths: repoSettings?.include_paths ?? [],
      ignoredTypes: repoSettings?.ignored_types ?? [],
    };

    const shouldAutoPR = repoSettings?.enable_auto_pr ?? true;

    const { data: scan } = await supabase
      .from("scans")
      .insert({
        repository_id: dbRepo.id,
        commit_sha: commitSha,
        branch,
        status: "scanning",
      })
      .select()
      .single();

    if (!scan) throw new Error("Failed to create scan record");

    const githubToken = await getGitHubAppToken();
    const octokit = new Octokit({ auth: githubToken });
    let filesScanned = 0;
    let vulnerabilitiesFound: Array<{
      filePath: string;
      vulnerabilityType: string;
      severity: string;
      explanation: string;
      fixedCode: string;
      vulnerableCode: string;
    }> = [];

    try {
      const { data: commitData } = await octokit.rest.repos.getCommit({
        owner,
        repo: repoName,
        ref: commitSha,
      });

      const files = (commitData as any)?.files || [];

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
          const scanResult = await scanCodeSnippet(content, filePath, scanRules);
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
    } catch (fetchError) {
      Sentry.captureException(fetchError, {
        tags: { owner, repoName, commitSha },
      });
      await supabase.from("scans").update({
        status: "vulnerable",
        completed_at: new Date().toISOString(),
      }).eq("id", scan.id);
      return NextResponse.json({ error: "Failed to fetch commit content" }, { status: 500 });
    }

    if (vulnerabilitiesFound.length > 0) {
      const highestSeverity = vulnerabilitiesFound[0].severity;

      for (const finding of vulnerabilitiesFound) {
        let prUrl: string | null = null;
        if (shouldAutoPR) {
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
            Sentry.captureException(e, {
              tags: { filePath: finding.filePath },
            });
          }
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

      if (highestSeverity === "Critical" || highestSeverity === "High") {
        const { data: userData } = await supabase.auth.admin.getUserById(
          (dbRepo.profiles as any[])[0]?.id
        );
        if (userData?.user?.email) {
          try {
            await sendCriticalVulnerabilityEmail(
              userData.user.email,
              dbRepo.full_name,
              vulnerabilitiesFound.map(f => f.vulnerabilityType).join(", ")
            );
          } catch (emailErr) {
            Sentry.captureException(emailErr, {
              tags: { userEmail: userData.user.email },
            });
          }
        }

        // Send Slack notification if configured
        const profileData = (dbRepo.profiles as any[])[0];
        if (profileData?.slack_webhook_url) {
          try {
            await sendSlackNotification({
              webhookUrl: profileData.slack_webhook_url,
              title: "Critical Vulnerability Detected",
              description: vulnerabilitiesFound.map(f => `- **${f.vulnerabilityType}** in \`${f.filePath}\``).join("\n"),
              severity: highestSeverity === "Critical" ? "critical" : "high",
              repoName: dbRepo.full_name,
              vulnerabilityType: vulnerabilitiesFound.map(f => f.vulnerabilityType).join(", "),
            });
          } catch (slackErr) {
            Sentry.captureException(slackErr, {
              tags: { repoName: dbRepo.full_name },
            });
          }
        }
      }

      return NextResponse.json({
        message: `${vulnerabilitiesFound.length} vulnerability(ies) found`,
        vulnerabilities: vulnerabilitiesFound.length,
      });
    }

    await supabase.from("scans").update({
      status: "clean",
      completed_at: new Date().toISOString(),
    }).eq("id", scan.id);

    return NextResponse.json({
      message: filesScanned > 0 ? "Code is clean" : "No scannable code files",
      filesScanned,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Webhook error:", error);
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
