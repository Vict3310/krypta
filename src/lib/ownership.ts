import { createServiceRoleClient } from "@/utils/supabase/service";

/** True if the user owns the repository that contains this scan. */
export async function userOwnsScan(
  userId: string,
  scanId: string
): Promise<boolean> {
  const db = createServiceRoleClient();
  const { data: scan } = await db
    .from("scans")
    .select("repository_id, repositories!inner(user_id)")
    .eq("id", scanId)
    .single();

  if (!scan) return false;
  const repo = scan.repositories as unknown as { user_id: string } | { user_id: string }[];
  const ownerId = Array.isArray(repo) ? repo[0]?.user_id : repo?.user_id;
  return ownerId === userId;
}

/** True if the user owns the repo linked to this vulnerability (via scan). */
export async function userOwnsVulnerability(
  userId: string,
  vulnerabilityId: string
): Promise<{ owned: boolean; vulnerability?: Record<string, unknown> }> {
  const db = createServiceRoleClient();
  const { data: vulnerability } = await db
    .from("vulnerabilities")
    .select("*, scans!inner(id, repository_id, repositories!inner(user_id, full_name))")
    .eq("id", vulnerabilityId)
    .single();

  if (!vulnerability) return { owned: false };

  const scan = vulnerability.scans as unknown as {
    repositories: { user_id: string; full_name: string } | { user_id: string; full_name: string }[];
  };
  const repo = Array.isArray(scan.repositories)
    ? scan.repositories[0]
    : scan.repositories;

  if (!repo || repo.user_id !== userId) return { owned: false };
  return { owned: true, vulnerability };
}

/** True if every vulnerability ID belongs to a repo owned by the user. */
export async function userOwnsVulnerabilities(
  userId: string,
  vulnerabilityIds: string[]
): Promise<boolean> {
  if (!vulnerabilityIds.length) return false;
  const db = createServiceRoleClient();

  const { data: rows } = await db
    .from("vulnerabilities")
    .select("id, scans!inner(repositories!inner(user_id))")
    .in("id", vulnerabilityIds);

  if (!rows || rows.length !== vulnerabilityIds.length) return false;

  return rows.every((row) => {
    const scan = row.scans as unknown as {
      repositories: { user_id: string } | { user_id: string }[];
    };
    const repo = Array.isArray(scan.repositories)
      ? scan.repositories[0]
      : scan.repositories;
    return repo?.user_id === userId;
  });
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
