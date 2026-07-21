import { createClient } from "@/utils/supabase/server";
import type { Scan, Vulnerability, Repository } from "./types";

export async function getDashboardMetrics(userId: string) {
  const supabase = await createClient();

  // Get all repos for the user
  const { data: repos } = await supabase
    .from("repositories")
    .select("id")
    .eq("user_id", userId);

  const repoIds = repos?.map((r) => r.id) ?? [];

  if (repoIds.length === 0) {
    return { totalScans: 0, totalVulnerabilities: 0, fixedCount: 0, activeRepos: 0 };
  }

  const [scansResult, vulnsResult, fixedResult] = await Promise.all([
    supabase.from("scans").select("id", { count: "exact" }).in("repository_id", repoIds),
    supabase.from("vulnerabilities")
      .select("id", { count: "exact" })
      .in("scan_id",
        (await supabase.from("scans").select("id").in("repository_id", repoIds)).data?.map(s => s.id) ?? []
      )
      .neq("status", "dismissed"),
    supabase.from("vulnerabilities")
      .select("id", { count: "exact" })
      .in("scan_id",
        (await supabase.from("scans").select("id").in("repository_id", repoIds)).data?.map(s => s.id) ?? []
      )
      .eq("status", "fixed"),
  ]);

  return {
    totalScans: scansResult.count ?? 0,
    totalVulnerabilities: vulnsResult.count ?? 0,
    fixedCount: fixedResult.count ?? 0,
    activeRepos: repoIds.length,
  };
}

export async function getRecentScans(userId: string, limit = 10): Promise<Scan[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("scans")
    .select(`
      *,
      repositories!inner(full_name, user_id)
    `)
    .eq("repositories.user_id", userId)
    .order("triggered_at", { ascending: false })
    .limit(limit);

  return (data as Scan[]) ?? [];
}

export async function getScanById(scanId: string): Promise<Scan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scans")
    .select("*, repositories(full_name)")
    .eq("id", scanId)
    .single();
  return data as Scan | null;
}

export async function getVulnerabilitiesByScan(scanId: string): Promise<Vulnerability[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vulnerabilities")
    .select("*")
    .eq("scan_id", scanId)
    .order("severity", { ascending: false });
  return (data as Vulnerability[]) ?? [];
}

export async function getUserRepositories(userId: string): Promise<Repository[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("repositories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as Repository[]) ?? [];
}

export async function dismissVulnerability(vulnerabilityId: string) {
  const supabase = await createClient();
  return supabase
    .from("vulnerabilities")
    .update({ status: "dismissed" })
    .eq("id", vulnerabilityId);
}

export async function snoozeVulnerability(vulnerabilityId: string, days = 30) {
  const supabase = await createClient();
  const snoozedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return supabase
    .from("vulnerabilities")
    .update({ status: "snoozed", snoozed_until: snoozedUntil })
    .eq("id", vulnerabilityId);
}
