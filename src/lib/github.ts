import { Octokit } from "octokit";
import { createSign } from "node:crypto";

const getGitHubAppToken = async (): Promise<string> => {
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
  if (!privateKey) throw new Error("GITHUB_APP_PRIVATE_KEY not configured");
  // Also handle Windows-style newlines
  privateKey = privateKey.replace(/\r\n/g, "\n");

  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("GITHUB_APP_ID not configured");

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 600; // 10 minutes

  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat, exp, iss: appId })).toString("base64url");
  const sign = createSign("SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign({ key: privateKey, padding: 1, dsa: "ecdsa", namedCurve: "prime256v1" }).toString("base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const installationsRes = await fetch(`https://api.github.com/app/installations`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
  });

  if (!installationsRes.ok) {
    const body = await installationsRes.text();
    throw new Error(`Failed to list GitHub App installations: ${installationsRes.status} ${body}`);
  }

  const { data: installations } = await installationsRes.json();

  if (!installations || installations.length === 0) {
    throw new Error("No GitHub App installations found. Install the Krypta GitHub App on your account.");
  }

  // Use the first installation (in production, match by user/org)
  const installationId = installations[0].id;

  const accessTokenRes = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
    method: "POST",
  });

  if (!accessTokenRes.ok) {
    const body = await accessTokenRes.text();
    throw new Error(`Failed to get access token: ${accessTokenRes.status} ${body}`);
  }

  const { data } = await accessTokenRes.json();
  return data.token;
};

export async function getGitHubUserRepositories(username: string): Promise<any[]> {
  // Strategy 1: Try GitHub App installation token to get repos the app has access to
  try {
    const token = await getGitHubAppToken();
    const octokit = new Octokit({ auth: token });

    // listForAuthenticatedUser works with installation tokens — lists repos the app is installed on
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      type: "owner",
      per_page: 100,
    });
    console.log(`[GitHub] Fetched ${data.length} repos via GitHub App token`);
    return data as any[];
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("GITHUB_APP_PRIVATE_KEY") || msg.includes("GITHUB_APP_ID")) {
      console.warn("[GitHub] GitHub App not configured — skipping app token fetch");
    } else if (msg.includes("No GitHub App installations")) {
      console.warn("[GitHub] No installation found for the app — falling back to public repos");
    } else {
      console.warn("[GitHub] App token fetch failed, falling back to public repos:", msg);
    }
  }

  // Strategy 2: Unauthenticated fetch for public repos by username
  const res = await fetch(`https://api.github.com/users/${username}/repos?type=owner&per_page=100&sort=updated`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const errMsg = `Failed to fetch public repos for ${username}: ${res.status} ${res.statusText} — ${body}`;
    console.warn("[GitHub]", errMsg);
    throw new Error(errMsg);
  }

  const data = await res.json();
  console.log(`[GitHub] Fetched ${data.length} public repos for ${username}`);
  return data as any[];
}

// Legacy function — kept for backward compatibility if OAuth provider_token is ever restored
export async function getGitHubUserRepositoriesWithToken(providerToken: string): Promise<any[]> {
  const octokit = new Octokit({ auth: providerToken });
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });
  return data as any[];
}

export async function createFixPullRequest(
  owner: string,
  repo: string,
  filePath: string,
  fixedContent: string,
  vulnerabilityType: string,
  baseBranch: string = "main"
) {
  // Get a fresh installation token for PR creation
  const token = await getGitHubAppToken();
  const octokit = new Octokit({ auth: token });

  const branchName = `krypta-fix-${vulnerabilityType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}-${Date.now()}`;

  try {
    // 1. Get source branch reference (the scanned commit's branch)
    const { data: sourceRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    // 2. Create new fix branch from the scanned branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: sourceRef.object.sha,
    });

    // 3. Get the file's current SHA
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branchName,
    });

    // 4. Update the file
    if (!Array.isArray(fileData) && fileData.type === "file") {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `fix: patch ${vulnerabilityType} vulnerability`,
        content: Buffer.from(fixedContent).toString("base64"),
        sha: fileData.sha,
        branch: branchName,
      });
    }

    // 5. Open Pull Request against the scanned branch
    const { data: prData } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `🔒 Fix ${vulnerabilityType} Vulnerability`,
      head: branchName,
      base: baseBranch,
      body: `Krypta AI Security Engine has detected and fixed a ${vulnerabilityType} in \`${filePath}\` on the \`${baseBranch}\` branch.\n\nPlease review this PR.`,
    });

    return prData.html_url;
  } catch (error) {
    console.error("Failed to create PR:", error);
    throw error;
  }
}

export async function createRepositoryWebhook(
  providerToken: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
) {
  const octokit = new Octokit({ auth: providerToken });
  const { data } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret: secret,
      insecure_ssl: "0",
    },
    events: ["push", "pull_request"],
    active: true,
  });
  return data;
}
