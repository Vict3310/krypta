/**
 * Ownership Verification Utilities
 *
 * Provides functions for verifying target ownership before
 * allowing exploit scanning. Supports three verification methods:
 * 1. GitHub App install (automatic)
 * 2. DNS TXT record (for live URLs)
 * 3. File upload via well-known path (fallback)
 */

import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveTxt } from "node:dns/promises";
import crypto from "crypto";

// ============================================================
// Token Generation
// ============================================================

/**
 * Generate a random verification token for DNS/file challenges.
 * Format: krypta-verify-{random32hex}
 */
export function generateVerificationToken(): string {
  return `krypta-verify-${crypto.randomBytes(20).toString("hex")}`;
}

// ============================================================
// Verification Status Enums
// ============================================================

export type VerificationStatus = "unverified" | "pending" | "verified" | "failed";
export type VerificationMethod = "github_app" | "dns_txt" | "file_upload";

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "failed",
];

export const VERIFICATION_METHODS: VerificationMethod[] = [
  "github_app",
  "dns_txt",
  "file_upload",
];

// ============================================================
// Database Operations
// ============================================================

/**
 * Verify a repository via GitHub App (automatic — no user action needed).
 * Called when a repo is connected through the existing GitHub App flow.
 */
export async function verifyViaGitHubApp(repositoryId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = createServiceRoleClient();

  try {
    const { error } = await db
      .from("repositories")
      .update({
        verification_status: "verified",
        verification_method: "github_app",
        verified_at: new Date().toISOString(),
      })
      .eq("id", repositoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Start verification via DNS TXT or file upload.
 * Generates a token, updates the repo to pending status.
 */
export async function startVerification(
  repositoryId: string,
  method: "dns_txt" | "file_upload"
): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const db = createServiceRoleClient();
  const token = generateVerificationToken();

  try {
    const { error } = await db
      .from("repositories")
      .update({
        verification_status: "pending",
        verification_method: method,
        verification_token: token,
        verified_at: null,
      })
      .eq("id", repositoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, token };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Verify a repository via DNS TXT record.
 * Checks _krypta-verify.{domain} for the expected token.
 */
export async function verifyViaDnsTxt(
  repositoryId: string,
  targetUrl: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = createServiceRoleClient();

  // Get the pending verification record
  const { data: repo, error: repoError } = await db
    .from("repositories")
    .select("verification_token")
    .eq("id", repositoryId)
    .single();

  if (repoError || !repo || !repo.verification_token) {
    return {
      success: false,
      error: "No pending verification found for this repository",
    };
  }

  const token = repo.verification_token;

  // Extract domain from URL
  let domain: string;
  try {
    const url = new URL(targetUrl);
    domain = url.hostname.replace(/^www\./, "");
  } catch {
    return { success: false, error: "Invalid URL format" };
  }

  // DNS TXT query: _krypta-verify.{domain}
  const queryName = `_krypta-verify.${domain}`;

  try {
    const txtRecords = await resolveTxt(queryName);

    // Flatten all TXT record strings and check if any contain our token
    const allTxtValues = txtRecords.flat().join(" ");

    if (!allTxtValues.includes(token)) {
      return {
        success: false,
        error: `DNS TXT record not found. Expected a TXT record at _krypta-verify.${domain} containing "${token}". DNS changes can take up to 30 minutes to propagate.`,
      };
    }
  } catch (dnsError) {
    const message = (dnsError as Error).message;
    return {
      success: false,
      error: message.includes("ENODATA") || message.includes("NXDOMAIN")
        ? `No TXT record found at _krypta-verify.${domain}. Add a TXT record with value "${token}" and try again. DNS changes can take up to 30 minutes to propagate.`
        : `DNS lookup failed: ${message}`,
    };
  }

  // Mark as verified
  try {
    const { error } = await db
      .from("repositories")
      .update({
        verification_status: "verified",
        verification_method: "dns_txt",
        verified_at: new Date().toISOString(),
        verification_token: null, // Token no longer needed
      })
      .eq("id", repositoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (dbError) {
    return { success: false, error: (dbError as Error).message };
  }
}

/**
 * Verify a repository via file upload.
 * Fetches https://{domain}/.well-known/krypta-verification.txt and checks content.
 */
export async function verifyViaFileUpload(
  repositoryId: string,
  targetUrl: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = createServiceRoleClient();

  // Get the pending verification record
  const { data: repo, error: repoError } = await db
    .from("repositories")
    .select("verification_token")
    .eq("id", repositoryId)
    .single();

  if (repoError || !repo || !repo.verification_token) {
    return {
      success: false,
      error: "No pending verification found for this repository",
    };
  }

  const token = repo.verification_token;

  // Extract domain from URL
  let domain: string;
  try {
    const url = new URL(targetUrl);
    domain = url.hostname.replace(/^www\./, "");
  } catch {
    return { success: false, error: "Invalid URL format" };
  }

  const verificationUrl = `https://${domain}/.well-known/krypta-verification.txt`;

  try {
    const response = await fetch(verificationUrl, {
      method: "GET",
      headers: { "User-Agent": "Krypta-Verification/1.0" },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Could not fetch ${verificationUrl} (HTTP ${response.status}). Make sure the file is publicly accessible.`,
      };
    }

    const content = await response.text().then((t) => t.trim());

    if (!content.includes(token)) {
      return {
        success: false,
        error: `File content does not contain the expected token. Expected a file at ${verificationUrl} containing "${token}".`,
      };
    }
  } catch (fetchError) {
    const message = (fetchError as Error).message;
    return {
      success: false,
      error: message.includes("Timeout")
        ? `Connection timed out. Make sure ${verificationUrl} is reachable from the internet.`
        : `Could not verify file: ${message}`,
    };
  }

  // Mark as verified
  try {
    const { error } = await db
      .from("repositories")
      .update({
        verification_status: "verified",
        verification_method: "file_upload",
        verified_at: new Date().toISOString(),
        verification_token: null,
      })
      .eq("id", repositoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (dbError) {
    return { success: false, error: (dbError as Error).message };
  }
}

/**
 * Check if a repository is verified for exploit scanning.
 */
export async function isRepositoryVerified(
  repositoryId: string
): Promise<{
  isVerified: boolean;
  method: VerificationMethod | null;
  verifiedAt: string | null;
  error?: string;
}> {
  const db = createServiceRoleClient();

  try {
    const { data: repo, error } = await db
      .from("repositories")
      .select("verification_status, verification_method, verified_at")
      .eq("id", repositoryId)
      .single();

    if (error || !repo) {
      return {
        isVerified: false,
        method: null,
        verifiedAt: null,
        error: "Repository not found",
      };
    }

    return {
      isVerified: repo.verification_status === "verified",
      method: repo.verification_method as VerificationMethod | null,
      verifiedAt: repo.verified_at,
    };
  } catch (err) {
    return {
      isVerified: false,
      method: null,
      verifiedAt: null,
      error: (err as Error).message,
    };
  }
}

/**
 * Get verification status for any URL (for arbitrary target URLs not linked to repos).
 */
export async function getTargetVerificationStatus(targetUrl: string): Promise<{
  isVerified: boolean;
  method: VerificationMethod | null;
  verifiedAt: string | null;
  error?: string;
}> {
  const db = createServiceRoleClient();

  try {
    let hostname: string;
    try {
      hostname = new URL(targetUrl).hostname.replace(/^www\./, "");
    } catch {
      return { isVerified: false, method: null, verifiedAt: null, error: "Invalid URL" };
    }

    const { data: repos } = await db
      .from("repositories")
      .select("verification_status, verification_method, verified_at, full_name")
      .eq("verification_status", "verified");

    if (repos) {
      for (const repo of repos) {
        const repoDomain = repo.full_name?.split("/")[1]?.toLowerCase();
        if (repoDomain && hostname.includes(repoDomain)) {
          return {
            isVerified: true,
            method: repo.verification_method as VerificationMethod,
            verifiedAt: repo.verified_at,
          };
        }
      }
    }

    return { isVerified: false, method: null, verifiedAt: null };
  } catch (err) {
    return {
      isVerified: false,
      method: null,
      verifiedAt: null,
      error: (err as Error).message,
    };
  }
}

/**
 * Re-check verification (for periodic cron re-verification).
 * For DNS TXT: re-query DNS and downgrade to unverified if record removed.
 * For file upload: re-fetch file and downgrade if missing.
 */
export async function recheckVerification(repositoryId: string): Promise<{
  success: boolean;
  wasDowngraded: boolean;
  error?: string;
}> {
  const db = createServiceRoleClient();

  const { data: repo, error } = await db
    .from("repositories")
    .select("*")
    .eq("id", repositoryId)
    .single();

  if (error || !repo) {
    return { success: false, wasDowngraded: false, error: "Repository not found" };
  }

  if (repo.verification_status !== "verified") {
    return { success: true, wasDowngraded: false };
  }

  let stillVerified = true;

  if (repo.verification_method === "dns_txt") {
    // Re-check DNS TXT record
    const targetUrl = `https://${repo.full_name.replace("/", "").replace(".git", "")}`;
    const result = await verifyViaDnsTxt(repositoryId, targetUrl);
    stillVerified = result.success;
  } else if (repo.verification_method === "file_upload") {
    // Re-check file upload
    const targetUrl = `https://${repo.full_name.replace("/", "").replace(".git", "")}`;
    const result = await verifyViaFileUpload(repositoryId, targetUrl);
    stillVerified = result.success;
  }
  // GitHub app verification doesn't need re-checking

  const wasDowngraded = !stillVerified;

  if (wasDowngraded) {
    await db
      .from("repositories")
      .update({
        verification_status: "unverified",
        verified_at: null,
      })
      .eq("id", repositoryId);
  }

  return { success: true, wasDowngraded };
}

// ============================================================
// Exploit Scan Enforcement
// ============================================================

/**
 * Match a target URL to a repository ID.
 * Returns the repository_id if matched, null otherwise.
 */
export async function matchTargetToRepository(targetUrl: string): Promise<string | null> {
  const db = createServiceRoleClient();

  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.replace(/^www\./, "").replace(/\.com$/, "");

    // Try to match by converting hostname to repo format (e.g., github.com -> github/com)
    const repoNamePattern = hostname.replace(/\./g, "/");

    const { data: repos } = await db
      .from("repositories")
      .select("id, full_name")
      .eq("verification_status", "verified")
      .or(`full_name.ilike.${repoNamePattern},full_name.ilike.%/${repoNamePattern}`)
      .limit(1);

    if (repos && repos.length > 0) {
      return repos[0].id;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Enforce ownership verification for an exploit scan job.
 * Returns { allowed: true } if the target is verified,
 * or { allowed: false, errorCode: "TARGET_NOT_VERIFIED" } otherwise.
 */
export async function enforceExploitScanVerification(jobId: string): Promise<{
  allowed: boolean;
  errorCode?: string;
  errorMessage?: string;
}> {
  const db = createServiceRoleClient();

  // Fetch the job
  const { data: job, error: jobError } = await db
    .from("exploit_scan_jobs")
    .select("target_url, repository_id")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return {
      allowed: false,
      errorCode: "JOB_NOT_FOUND",
      errorMessage: "Scan job not found",
    };
  }

  // If the job already has a repository_id attached, check its verification
  if (job.repository_id) {
    const repoCheck = await isRepositoryVerified(job.repository_id);
    if (repoCheck.isVerified) {
      return { allowed: true };
    }
    // Repo exists but is not verified
    return {
      allowed: false,
      errorCode: "TARGET_NOT_VERIFIED",
      errorMessage: `Target repository is not verified for exploit scanning (method: ${repoCheck.method || "none"})`,
    };
  }

  // No repository_id — try to match target URL to a verified repo
  const matchedRepoId = await matchTargetToRepository(job.target_url);
  if (matchedRepoId) {
    const repoCheck = await isRepositoryVerified(matchedRepoId);
    if (repoCheck.isVerified) {
      // Attach the matched repo to the job for audit trail
      await db
        .from("exploit_scan_jobs")
        .update({ repository_id: matchedRepoId })
        .eq("id", jobId);
      return { allowed: true };
    }
  }

  // Not verified
  return {
    allowed: false,
    errorCode: "TARGET_NOT_VERIFIED",
    errorMessage: "Target is not verified for exploit scanning. Please complete ownership verification first.",
  };
}
