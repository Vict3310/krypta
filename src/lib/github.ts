import { Octokit } from "octokit";
import { createSign } from "node:crypto";

type InstallationAccount = {
  login?: string;
};

type Installation = {
  id: number;
  account?: InstallationAccount | null;
};

// ============================================================
// GitHub App Token Caching
// ============================================================
// GitHub installation tokens are valid for ~1 hour. We cache
// them to avoid hammering GitHub's installation API on every
// scan request.
// ============================================================

const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes

interface CachedToken {
  token: string;
  expiresAt: number;
  installationId: number;
  owner?: string;
}

const tokenCache = new Map<string, CachedToken>();
let cacheLock: Promise<void> | null = null;

function cacheKey(installationId: number, owner?: string): string {
  return owner ? `${installationId}:${owner}` : `${installationId}`;
}

async function cachedInstallationToken(
  jwt: string,
  installationId: number,
  owner?: string
): Promise<string> {
  const key = cacheKey(installationId, owner);
  const cached = tokenCache.get(key);

  // Return cached token if still valid (with 10-minute safety buffer)
  if (cached && cached.expiresAt > Date.now() + 10 * 60 * 1000) {
    return cached.token;
  }

  // Ensure only one refresh happens per key at a time
  if (cacheLock) {
    await cacheLock;
  }

  // Check again after awaiting the lock (another request may have refreshed)
  const recheck = tokenCache.get(key);
  if (recheck && recheck.expiresAt > Date.now() + 10 * 60 * 1000) {
    return recheck.token;
  }

  cacheLock = (async () => {
    try {
      const accessTokenRes = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "X-GitHub-Api-Version": "2022-11-28",
            Accept: "application/vnd.github+json",
          },
          method: "POST",
        }
      );

      if (!accessTokenRes.ok) {
        const body = await accessTokenRes.text();
        throw new Error(`Failed to get access token: ${accessTokenRes.status} ${body}`);
      }

      const data = (await accessTokenRes.json()) as { token?: string; expires_at?: string };
      if (!data.token) throw new Error("GitHub installation token missing from response");

      // Parse expiration — GitHub returns ISO-8601 or we default to NOW + 50 min
      let expiresAt: number;
      if (data.expires_at) {
        const parsed = Date.parse(data.expires_at);
        expiresAt = Number.isNaN(parsed) ? Date.now() + TOKEN_CACHE_TTL_MS : parsed;
      } else {
        expiresAt = Date.now() + TOKEN_CACHE_TTL_MS;
      }

      tokenCache.set(key, {
        token: data.token,
        expiresAt,
        installationId,
        owner,
      });
    } finally {
      cacheLock = null;
    }
  })();

  await cacheLock;

  const result = tokenCache.get(key);
  if (!result) {
    throw new Error("Token cache miss after refresh — this should not happen");
  }
  return result.token;
}

function buildGitHubAppJwt(): string {
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
  if (!privateKey) throw new Error("GITHUB_APP_PRIVATE_KEY not configured");
  privateKey = privateKey.replace(/\r\n/g, "\n");

  if (
    privateKey.startsWith("SHA256:") ||
    privateKey.startsWith("fingerprint") ||
    privateKey === "PLACEHOLDER" ||
    privateKey.length < 100
  ) {
    throw new Error(
      "Invalid GITHUB_APP_PRIVATE_KEY format. Use the full RSA PEM private key from GitHub App settings."
    );
  }

  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("GITHUB_APP_ID not configured");

  const iat = Math.floor(Date.now() / 1000) - 60;
  const exp = iat + 600;

  // GitHub Apps require RS256 (RSA) JWTs
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat, exp, iss: appId })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  sign.end();
  const signature = sign.sign(privateKey, "base64url");

  return `${header}.${payload}.${signature}`;
}

async function listInstallations(jwt: string): Promise<Installation[]> {
  const installationsRes = await fetch("https://api.github.com/app/installations", {
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

  const installations = (await installationsRes.json()) as Installation[];
  if (!Array.isArray(installations) || installations.length === 0) {
    throw new Error("No GitHub App installations found. Install the Krypta GitHub App on your account.");
  }
  return installations;
}

/**
 * Get an installation access token.
 * Prefer matching by owner login (org/user) when provided.
 * Tokens are cached (~50 min TTL) to avoid hammering GitHub's installation API.
 */
const getGitHubAppToken = async (options?: {
  owner?: string;
  installationId?: number;
}): Promise<string> => {
  const jwt = buildGitHubAppJwt();
  const installations = await listInstallations(jwt);

  let installation: Installation | undefined;

  if (options?.installationId) {
    installation = installations.find((i) => i.id === options.installationId);
  }

  if (!installation && options?.owner) {
    const owner = options.owner.toLowerCase();
    installation = installations.find(
      (i) => i.account?.login?.toLowerCase() === owner
    );
  }

  if (!installation) {
    if (options?.owner || options?.installationId) {
      throw new Error(
        `No GitHub App installation found for ${options.owner ?? `id ${options.installationId}`}`
      );
    }
    installation = installations[0];
  }

  return cachedInstallationToken(jwt, installation.id, options?.owner ?? installation?.account?.login);
};

export { getGitHubAppToken };

export async function getGitHubUserRepositories(username: string): Promise<any[]> {
  try {
    const token = await getGitHubAppToken({ owner: username });
    const octokit = new Octokit({ auth: token });

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
    } else if (msg.includes("No GitHub App installations") || msg.includes("No GitHub App installation found")) {
      console.warn("[GitHub] No installation found for the app — falling back to public repos");
    } else {
      console.warn("[GitHub] App token fetch failed, falling back to public repos:", msg);
    }
  }

  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&sort=updated`,
    {
      headers: { Accept: "application/vnd.github+json" },
    }
  );

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
  const token = await getGitHubAppToken({ owner });
  const octokit = new Octokit({ auth: token });

  const branchName = `krypta-fix-${vulnerabilityType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}-${Date.now()}`;

  try {
    const { data: sourceRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: sourceRef.object.sha,
    });

    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branchName,
    });

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
