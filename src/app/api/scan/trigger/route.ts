import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { Octokit } from "octokit";
import { createSign } from "node:crypto";

// GitHub App JWT token generator
async function getGitHubAppToken(): Promise<string> {
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY || "";
  const appId = process.env.GITHUB_APP_ID;

  if (!rawKey || !appId) {
    throw new Error("GitHub App credentials not configured (GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set)");
  }

  // Reject fingerprints, stubs, or obviously wrong key formats
  if (rawKey.startsWith("SHA256:") || rawKey.startsWith("fingerprint") || rawKey === "PLACEHOLDER" || rawKey.length < 100) {
    throw new Error(
      "Invalid GITHUB_APP_PRIVATE_KEY format. The value appears to be a key fingerprint or placeholder. " +
      "You must set it to the full PEM private key obtained from GitHub App settings. " +
      "Generate it with: Generate a private key in GitHub App settings"
    );
  }

  // Replace literal \\n with actual newlines (for keys stored in env without real newlines)
  let privateKey = rawKey.replace(/\\n/g, "\n");
  // Also replace Windows-style newlines
  privateKey = privateKey.replace(/\r\n/g, "\n");

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 600;

  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat, exp, iss: appId })).toString("base64url");
  const sign = createSign("SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign({ key: privateKey, padding: 1, dsa: "ecdsa", namedCurve: "prime256v1" }).toString("base64url");

  const jwt = `${header}.${payload}.${signature}`;

  // Get installations
  const installationsRes = await fetch(`https://api.github.com/app/installations`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
  });

  if (!installationsRes.ok) {
    const body = await installationsRes.text();
    throw new Error(`Failed to get installations: ${installationsRes.status} ${body}`);
  }

  const installations = await installationsRes.json();
  if (!installations?.length) {
    throw new Error("No GitHub App installations found");
  }

  const installationId = installations[0].id;

  // Generate access token
  const tokenRes = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
    method: "POST",
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Failed to get access token: ${tokenRes.status} ${body}`);
  }

  const { token } = await tokenRes.json();
  return token;
}

// Basic security patterns to check
const securityPatterns = [
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

function scanFileContent(content: string, filePath: string): Promise<any[]> {
  const findings: any[] = [];

  securityPatterns.forEach(({ name, severity, patterns, description }) => {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        // Skip node_modules, .next, public directories
        if (filePath.includes("node_modules") || filePath.includes(".next") || filePath.includes("/public/")) {
          continue;
        }

        // For hardcoded secrets, only flag non-dotenv files
        if (name === "Hardcoded Secret" && (filePath.endsWith(".env") || filePath.endsWith(".env.local"))) {
          continue;
        }

        // Get line number
        const lines = content.split("\n");
        let lineNumber = 1;
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            lineNumber = i + 1;
            break;
          }
        }

        // Get the matched line
        const matchedLine = lines[lineNumber - 1]?.trim().substring(0, 100) || "";

        findings.push({
          filePath,
          vulnerabilityType: name,
          severity,
          description,
          line: lineNumber,
          code: matchedLine,
        });
        break; // Only one finding per pattern per file
      }
    }
  });

  return Promise.resolve(findings);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Use service role client for DB operations (bypasses RLS)
  const db = createServiceRoleClient();

  try {
    const { repositoryId } = await req.json();

    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // Get the repository
    const { data: repo, error: repoError } = await db
      .from("repositories")
      .select("*")
      .eq("id", repositoryId)
      .eq("user_id", session.user.id)
      .single();

    if (repoError || !repo) {
      return NextResponse.json({ error: "Repository not found or access denied" }, { status: 404 });
    }

    console.log("[Scan] Starting scan for:", repo.full_name);

    // Create scan record
    console.log("[Scan] Creating scan record...");
    const { data: scan, error: scanError } = await db
      .from("scans")
      .insert({
        repository_id: repo.id,
        status: "pending",
      })
      .select()
      .single();

    if (scanError || !scan) {
      console.error("[Scan] Failed to create scan record:", scanError);
      return NextResponse.json({ error: "Failed to create scan record" }, { status: 500 });
    }

    console.log("[Scan] Scan record created:", scan.id);

    // Update to scanning
    console.log("[Scan] Updating status to scanning...");
    await db.from("scans").update({ status: "scanning" }).eq("id", scan.id);

    // Get GitHub token
    console.log("[Scan] Getting GitHub App token...");
    const githubToken = await getGitHubAppToken();
    console.log("[Scan] GitHub App token received");
    const octokit = new Octokit({ auth: githubToken });

    const [owner, repoName] = repo.full_name.split("/");

    // Get HEAD commit SHA from branch ref
    const { data: branchRef } = await octokit.rest.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${repo.default_branch || "main"}`,
    });

    const commitSha = (branchRef.object as any).sha;
    await db.from("scans").update({ commit_sha: commitSha, branch: repo.default_branch }).eq("id", scan.id);

    // Get recursive tree of all files
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo: repoName,
      tree_sha: commitSha,
      recursive: "true",
    });

    const files = (treeData as any)?.tree?.filter((item: any) => item.type === "blob") || [];
    console.log("[Scan] Found", files.length, "files to scan");

    if (files.length === 0) {
      console.log("[Scan] No files to scan, marking as clean");
      await db.from("scans").update({ status: "clean" }).eq("id", scan.id);
      return NextResponse.json({ message: "Repository is empty or has no code files", scanId: scan.id, filesScanned: 0, vulnerabilities: 0 });
    }

    let totalFindings = 0;
    const findingsPerFile: Record<string, any[]> = {};
    let processedFiles = 0;
    let scannedFiles = 0;

    // Scan files in batches (1 at a time to avoid GitHub rate limiting)
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      processedFiles += batch.length;
      console.log(`[Scan] Processing batch ${Math.floor(i / batchSize) + 1}: files ${i + 1}-${Math.min(i + batchSize, files.length)}/${files.length}`);

      const batchResults: any[] = [];
      for (const file of batch) {
        if (!file.path) continue;

        // Skip binary and non-code files
        const ext = file.path.split(".").pop()?.toLowerCase() || "";
        const codeExtensions = ["js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs", "cpp", "c", "h", "hpp", "kt", "scala", "sh", "bash", "yml", "yaml", "json", "xml", "html", "md", "toml", "cfg", "ini", "env", "dockerfile", "gitignore", "env"];
        if (!codeExtensions.includes(ext)) continue;

        scannedFiles++;
        try {
          console.log(`[Scan] Fetching file: ${file.path}`);
          const { data: fileData } = await octokit.rest.repos.getContent({
            owner,
            repo: repoName,
            path: file.path,
            ref: commitSha,
          });

          if ((fileData as any)?.type !== "file") {
            console.log(`[Scan] Skipped non-file: ${file.path}`);
            continue;
          }

          const content = Buffer.from((fileData as any).content, "base64").toString("utf-8");
          console.log(`[Scan] Scanning file: ${file.path} (${content.length} bytes)`);

          if (content.length > 50000) {
            console.log(`[Scan] Skipped large file: ${file.path}`);
            continue;
          }

          const findings = await scanFileContent(content, file.path);
          console.log(`[Scan] Found ${findings.length} issues in ${file.path}`);
          batchResults.push({ file, findings });
        } catch (err: any) {
          console.error(`[Scan] Error fetching ${file.path}:`, err.message);
        }
      }

      // Accumulate findings
      batchResults.forEach(({ file, findings }: any) => {
        if (findings.length > 0) {
          findingsPerFile[file.path] = findings;
          totalFindings += findings.length;
        }
      });

      console.log(`[Scan] Batch complete. Total findings so far: ${totalFindings}`);
    }

    console.log(`[Scan] All files processed. Total findings: ${totalFindings}`);

    // Store vulnerabilities
    try {
      if (totalFindings > 0) {
        console.log(`[Scan] Storing ${Object.values(findingsPerFile).flat().length} vulnerabilities...`);
        const allFindings = Object.values(findingsPerFile).flat();
        const { data: vulnResult, error: vulnError } = await db.from("vulnerabilities").insert(
          allFindings.map((f: any) => ({
            scan_id: scan.id,
            file_path: f.filePath,
            vulnerability_type: f.vulnerabilityType,
            severity: f.severity,
            plain_english_explanation: f.description,
            vulnerable_code: f.code,
            line: f.line,
            status: "open",
          }))
        ).select();
        console.log(`[Scan] Vulnerability insert result:`, JSON.stringify({ count: vulnResult?.length, error: vulnError }));
        if (vulnError) {
          console.error(`[Scan] Vulnerability insert error:`, vulnError.message);
        } else {
          console.log(`[Scan] ${vulnResult?.length} vulnerabilities stored`);
        }
      } else {
        console.log(`[Scan] No vulnerabilities to store`);
      }
    } catch (vulnError: any) {
      console.error(`[Scan] Error storing vulnerabilities:`, vulnError.message);
      // Continue anyway — we'll update status below
    }

    // Update scan status
    const finalStatus = totalFindings > 0 ? "vulnerable" : "clean";
    console.log(`[Scan] Updating scan to ${finalStatus} status...`);
    console.log(`[Scan] Update target: id=${scan.id}, repo_id=${repo.id}`);
    try {
      const { data: updateResult, error: statusError } = await db
        .from("scans")
        .update({ status: finalStatus })
        .eq("id", scan.id)
        .select()
        .single();
      console.log(`[Scan] Status update result:`, JSON.stringify({ data: updateResult, error: statusError }));
      if (statusError) {
        console.error(`[Scan] Status update error:`, statusError.message);
      } else {
        console.log(`[Scan] Scan ${scan.id} updated to ${finalStatus} (${totalFindings} findings)`);
      }
    } catch (statusError: any) {
      console.error(`[Scan] Error updating scan status:`, statusError.message);
      console.error(`[Scan] Error details:`, JSON.stringify(statusError, null, 2));
    }

    return NextResponse.json({
      message: totalFindings > 0
        ? `${totalFindings} vulnerability(ies) found`
        : "Code is clean",
      scanId: scan.id,
      filesScanned: files.length,
      vulnerabilities: totalFindings,
    });
  } catch (error) {
    console.error("[Scan] Error at step:", error);
    console.error("[Scan] Stack:", (error as Error).stack);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
