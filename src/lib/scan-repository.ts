/**
 * Shared repository scan pipeline.
 *
 * Performs the actual GitHub scan (fetch tree, pattern-scan files, store
 * vulnerabilities, update scan status). Used by the v1 REST API so the
 * programmatic scan trigger actually scans instead of just creating a
 * pending record.
 *
 * The caller is responsible for authorization (API key / session).
 */
import { createServiceRoleClient } from "@/utils/supabase/service";
import { getGitHubAppToken } from "@/lib/github";
import { Octokit } from "octokit";

export interface ScanOptions {
  branch?: string | null;
  commitSha?: string | null;
}

const CODE_EXTENSIONS = [
  "js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs",
  "cpp", "c", "h", "hpp", "kt", "scala", "sh", "bash", "yml", "yaml",
  "json", "xml", "html", "md", "toml", "cfg", "ini", "env", "dockerfile",
  "gitignore",
];

const securityPatterns: Array<{
  name: string;
  severity: string;
  patterns: RegExp[];
  description: string;
}> = [
  {
    name: "SQL Injection",
    severity: "High",
    patterns: [/SELECT.*FROM.*WHERE.*\+/, /INSERT INTO.*VALUES.*\+/, /UPDATE.*SET.*WHERE.*\+/],
    description: "Potential SQL injection through string concatenation",
  },
  {
    name: "Hardcoded Secret",
    severity: "Critical",
    patterns: [/(password|secret|api_key|token)\s*=\s*["'][^"']+["']/i],
    description: "Hardcoded secret detected in source code",
  },
  {
    name: "Unsafe Eval",
    severity: "High",
    patterns: [/\beval\s*\(/, /new\s+Function\s*\(/],
    description: "Use of eval() or Function constructor",
  },
  {
    name: "XSS Vulnerability",
    severity: "High",
    patterns: [/\binnerHTML\s*=/, /\.appendChild\s*\(\s*[^)]*\$\{/],
    description: "Potential cross-site scripting via innerHTML",
  },
  {
    name: "Insecure CORS",
    severity: "Medium",
    patterns: [/\*.*Access-Control-Allow-Origin/i, /Allow-Origin.*\*/i],
    description: "Permissive CORS policy allowing all origins",
  },
  {
    name: "Debug Endpoint",
    severity: "Medium",
    patterns: [/\bdebug\b.*\bendpoint\b/i, /\/api\/test/i, /\/api\/debug/i],
    description: "Potential debug endpoint exposed in production",
  },
  {
    name: "Missing Rate Limiting",
    severity: "Low",
    patterns: [/\blogin\b.*\bendpoint\b/i, /password\s*reset/i],
    description: "Authentication endpoint may lack rate limiting",
  },
  {
    name: "Console Debug",
    severity: "Low",
    patterns: [/\bconsole\.log\s*\(\s*[a-zA-Z]/],
    description: "Debug logging left in source code",
  },
  {
    name: "YAML/JSON Config Risk",
    severity: "Medium",
    patterns: [/(ALLOW_ALL|true|enable).*security/i, /(disable|skip|bypass).*auth/i],
    description: "Potential security feature disabled in configuration",
  },
];

function scanFileContent(content: string, filePath: string): Array<Record<string, unknown>> {
  const findings: Array<Record<string, unknown>> = [];
  const lines = content.split("\n");

  for (const { name, severity, patterns, description } of securityPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        if (filePath.includes("node_modules") || filePath.includes(".next") || filePath.includes("/public/")) {
          continue;
        }
        if (name === "Hardcoded Secret" && (filePath.endsWith(".env") || filePath.endsWith(".env.local"))) {
          continue;
        }

        let lineNumber = 1;
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            lineNumber = i + 1;
            break;
          }
        }

        findings.push({
          filePath,
          vulnerabilityType: name,
          severity,
          description,
          line: lineNumber,
          code: lines[lineNumber - 1]?.trim().substring(0, 100) || "",
        });
        break;
      }
    }
  }

  return findings;
}

/**
 * Run a full repository scan and persist results.
 * Updates the scan record to "clean" or "vulnerable".
 */
export async function runRepositoryScan(
  repositoryId: string,
  scanId: string,
  options: ScanOptions = {}
): Promise<{ filesScanned: number; vulnerabilities: number }> {
  const db = createServiceRoleClient();

  const { data: repo, error: repoError } = await db
    .from("repositories")
    .select("*")
    .eq("id", repositoryId)
    .single();

  if (repoError || !repo) {
    await db.from("scans").update({ status: "failed" }).eq("id", scanId);
    return { filesScanned: 0, vulnerabilities: 0 };
  }

  const [owner, repoName] = (repo.full_name || "").split("/");
  if (!owner || !repoName) {
    await db.from("scans").update({ status: "failed" }).eq("id", scanId);
    return { filesScanned: 0, vulnerabilities: 0 };
  }

  try {
    const githubToken = await getGitHubAppToken({ owner });
    const octokit = new Octokit({ auth: githubToken });

    const branch = options.branch || repo.default_branch || "main";

    // Resolve commit SHA
    let commitSha: string | undefined = options.commitSha || undefined;
    if (!commitSha) {
      const { data: branchRef } = await octokit.rest.git.getRef({
        owner,
        repo: repoName,
        ref: `heads/${branch}`,
      });
      commitSha = (branchRef.object as any).sha as string;
    }
    if (!commitSha) {
      await db.from("scans").update({ status: "failed" }).eq("id", scanId);
      return { filesScanned: 0, vulnerabilities: 0 };
    }

    await db.from("scans").update({ commit_sha: commitSha, branch, status: "scanning" }).eq("id", scanId);

    // Fetch recursive tree
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo: repoName,
      tree_sha: commitSha,
      recursive: "true",
    });

    const files = (treeData as any)?.tree?.filter((item: any) => item.type === "blob") || [];

    let totalFindings = 0;
    const allFindings: Array<Record<string, unknown>> = [];

    for (const file of files) {
      if (!file.path) continue;
      const ext = file.path.split(".").pop()?.toLowerCase() || "";
      if (!CODE_EXTENSIONS.includes(ext)) continue;

      try {
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo: repoName,
          path: file.path,
          ref: commitSha,
        });

        if ((fileData as any)?.type !== "file") continue;
        const content = Buffer.from((fileData as any).content, "base64").toString("utf-8");
        if (content.length > 50000) continue;

        const findings = scanFileContent(content, file.path);
        if (findings.length > 0) {
          allFindings.push(...findings);
          totalFindings += findings.length;
        }
      } catch {
        // Skip files that fail to fetch
      }
    }

    // Store vulnerabilities
    if (totalFindings > 0) {
      const { error: insertError } = await db.from("vulnerabilities").insert(
        allFindings.map((f: any) => ({
          scan_id: scanId,
          file_path: f.filePath,
          vulnerability_type: f.vulnerabilityType,
          severity: f.severity,
          plain_english_explanation: f.description,
          vulnerable_code: f.code,
          line: f.line,
          status: "open",
        }))
      );
      if (insertError) {
        console.error("[ScanRepository] Vulnerability insert error:", insertError.message);
      }
    }

    const finalStatus = totalFindings > 0 ? "vulnerable" : "clean";
    await db.from("scans").update({ status: finalStatus }).eq("id", scanId);

    return { filesScanned: files.length, vulnerabilities: totalFindings };
  } catch (error) {
    console.error("[ScanRepository] Scan failed:", (error as Error).message);
    await db.from("scans").update({ status: "failed" }).eq("id", scanId);
    return { filesScanned: 0, vulnerabilities: 0 };
  }
}