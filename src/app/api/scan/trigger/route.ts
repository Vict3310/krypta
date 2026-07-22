import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Octokit } from "octokit";
import { createSign } from "node:crypto";

// GitHub App JWT token generator
async function getGitHubAppToken(): Promise<string> {
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
  const appId = process.env.GITHUB_APP_ID;

  if (!privateKey || !appId) {
    throw new Error("GitHub App credentials not configured");
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 600;

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat, exp, iss: appId })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign({ key: privateKey, padding: 1 }).toString("base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const { data: installations } = await fetch(`https://api.github.com/app/installations`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
  }).then((r) => r.json());

  if (!installations?.length) {
    throw new Error("No GitHub App installations found");
  }

  const installationId = installations[0].id;

  const { data } = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
    method: "POST",
  }).then((r) => r.json());

  return data.token;
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

  try {
    const { repositoryId } = await req.json();

    if (!repositoryId) {
      return NextResponse.json({ error: "Missing repositoryId" }, { status: 400 });
    }

    // Get the repository
    const { data: repo, error: repoError } = await supabase
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
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .insert({
        repository_id: repo.id,
        status: "pending",
      })
      .select()
      .single();

    if (scanError || !scan) {
      return NextResponse.json({ error: "Failed to create scan record" }, { status: 500 });
    }

    // Update to scanning
    await supabase.from("scans").update({ status: "scanning" }).eq("id", scan.id);

    // Get GitHub token
    const githubToken = await getGitHubAppToken();
    const octokit = new Octokit({ auth: githubToken });

    const [owner, repoName] = repo.full_name.split("/");

    // Get repo contents (tree endpoint)
    const { data: tree } = await octokit.rest.repos.getCommitTree({
      owner,
      repo: repoName,
      tree_sha: "", // Will use HEAD
    });

    // Alternative: get contents from HEAD
    const { data: branchRef } = await octokit.rest.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${repo.default_branch || "main"}`,
    });

    const commitSha = (branchRef.object as any).sha;
    await supabase.from("scans").update({ commit_sha: commitSha, branch: repo.default_branch }).eq("id", scan.id);

    // Get tree
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo: repoName,
      tree_sha: commitSha,
      recursive: "true",
    });

    const files = (treeData as any)?.tree?.filter((item: any) => item.type === "blob") || [];
    console.log("[Scan] Found", files.length, "files to scan");

    let totalFindings = 0;
    const findingsPerFile: Record<string, any[]> = {};

    // Scan files in batches (concurrent, but not too many at once)
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const promises = batch.map(async (file: any) => {
        if (!file.path) return [];

        // Skip binary and non-code files
        const ext = file.path.split(".").pop()?.toLowerCase() || "";
        const codeExtensions = ["js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs", "cpp", "c", "h", "hpp", "kt", "scala", "sh", "bash", "yml", "yaml", "json", "xml", "html", "md", "toml", "cfg", "ini", "env", "dockerfile", "gitignore", "env"];
        if (!codeExtensions.includes(ext)) return [];

        try {
          const { data: fileData } = await octokit.rest.repos.getContent({
            owner,
            repo: repoName,
            path: file.path,
            ref: commitSha,
          });

          if ((fileData as any)?.type !== "file") return [];

          const content = Buffer.from((fileData as any).content, "base64").toString("utf-8");

          if (content.length > 50000) return []; // Skip large files

          const findings = await scanFileContent(content, file.path);
          return findings;
        } catch {
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach((batchFindings, idx) => {
        if (batchFindings.length > 0) {
          const file = batch[idx];
          findingsPerFile[file.path] = batchFindings;
          totalFindings += batchFindings.length;
        }
      });
    }

    // Store vulnerabilities
    if (totalFindings > 0) {
      const allFindings = Object.values(findingsPerFile).flat();
      await supabase.from("vulnerabilities").insert(
        allFindings.map((f: any) => ({
          scan_id: scan.id,
          file_path: f.filePath,
          vulnerability_type: f.vulnerabilityType,
          severity: f.severity,
          plain_english_explanation: f.description,
          vulnerable_code: f.code,
          status: "open",
        }))
      );
    }

    // Update scan status
    await supabase.from("scans").update({
      status: totalFindings > 0 ? "vulnerable" : "clean",
      completed_at: new Date().toISOString(),
    }).eq("id", scan.id);

    return NextResponse.json({
      message: totalFindings > 0
        ? `${totalFindings} vulnerability(ies) found`
        : "Code is clean",
      scanId: scan.id,
      filesScanned: files.length,
      vulnerabilities: totalFindings,
    });
  } catch (error) {
    console.error("[Scan] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
