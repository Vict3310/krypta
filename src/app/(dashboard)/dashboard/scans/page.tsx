"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Filter, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Scan, Vulnerability } from "@/lib/types";

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    Critical: "bg-red-50 text-red-700 border-red-200",
    High: "bg-orange-50 text-orange-700 border-orange-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-blue-50 text-blue-700 border-blue-200",
    Clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {severity}
    </span>
  );
}

export default function ScansPage() {
  const [scans, setScans] = useState<Array<Scan & { vulnerabilities?: Vulnerability[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const supabase = createClient();

  useEffect(() => {
    async function loadScans() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn("[Scans] No session");
          setLoading(false);
          return;
        }

        // Fetch user's repositories first
        const { data: repos, error: reposError } = await supabase
          .from("repositories")
          .select("id")
          .eq("user_id", session.user.id);

        if (reposError) {
          console.error("[Scans] Repos error:", reposError);
          setScans([]);
          setLoading(false);
          return;
        }

        if (!repos || repos.length === 0) {
          console.warn("[Scans] No repos found for user");
          setScans([]);
          setLoading(false);
          return;
        }

        const repoIds = repos.map(r => r.id);
        console.log("[Scans] Repo IDs:", repoIds);

        // Fetch scans with vulnerabilities for this user's repos
        const { data: scansData, error: scansError } = await supabase
          .from("scans")
          .select(`
            *,
            vulnerabilities (
              severity,
              vulnerability_type,
              plain_english_explanation,
              pr_url,
              status
            ),
            repositories (full_name)
          `)
          .in("repository_id", repoIds)
          .order("triggered_at", { ascending: false })
          .limit(50);

        if (scansError) {
          console.error("[Scans] Scans query error:", scansError);
        } else {
          console.log("[Scans] Loaded", (scansData as any)?.length ?? 0, "scans");
        }

        setScans((scansData as any) ?? []);
      } catch (error) {
        console.error("[Scans] Unexpected error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadScans();

    // Subscribe to real-time scan updates
    const channel = supabase
      .channel("scans-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scans" },
        () => loadScans()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredScans = scans
    .filter(s => filter === "all" || s.status === filter)
    .filter(s => {
      if (!search) return true;
      return s.repositories?.full_name?.toLowerCase().includes(search.toLowerCase());
    });

  if (loading) {
    return (
      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        <header className="mt-4 mb-8">
          <h1 className="text-2xl font-semibold text-sf-text-primary tracking-tight">Scan Results</h1>
        </header>
        <div className="flex items-center justify-center h-64 text-sf-text-tertiary">Loading scans...</div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mt-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-sf-text-primary tracking-tight">Scan Results</h1>
          <p className="text-sm text-sf-text-secondary mt-1">
            Detailed vulnerability reports and automatic fixes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-sf-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories..."
              className="rounded-full border border-black/10 bg-white pl-9 pr-4 py-2.5 text-sm outline-none placeholder:text-sf-text-tertiary shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20 w-56"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm outline-none shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] transition-all focus:border-sf-accent/50"
          >
            <option value="all">All Status</option>
            <option value="vulnerable">Vulnerable</option>
            <option value="clean">Clean</option>
            <option value="scanning">Scanning</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </header>

      {filteredScans.length === 0 ? (
        <div className="rounded-[28px] border border-black/5 bg-white p-16 text-center shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
          <ShieldAlert className="h-12 w-12 text-sf-text-tertiary mx-auto mb-4" />
          <p className="text-sf-text-secondary">No scans yet. Connect a repository to get started.</p>
          <Link href="/dashboard/repositories/new" className="inline-block mt-4 text-sm text-sf-accent hover:underline">
            Connect a repository →
          </Link>
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.02]">
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-sf-text-tertiary">Target</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-sf-text-tertiary">Status</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-sf-text-tertiary">Issue Type</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-sf-text-tertiary">Detected</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredScans.map((scan) => {
                  const latestVuln = scan.vulnerabilities?.[scan.vulnerabilities.length - 1];
                  const severity = latestVuln?.severity || "Clean";
                  const issue = latestVuln?.vulnerability_type || "No issues";
                  const timeAgo = getTimeAgo(scan.triggered_at);

                  return (
                    <tr key={scan.id} className="hover:bg-black/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-sf-accent shrink-0" />
                          <span className="text-sm font-medium text-sf-text-primary">{scan.repositories?.full_name || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <SeverityBadge severity={severity} />
                      </td>
                      <td className="px-6 py-4 text-sm text-sf-text-secondary">{issue}</td>
                      <td className="px-6 py-4 text-sm text-sf-text-tertiary">{timeAgo}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/scans/${scan.id}`}
                          className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-sf-text-primary shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] transition-all hover:bg-black/5"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
