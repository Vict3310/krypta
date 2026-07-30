"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  Shield,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Play,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { Scan, Vulnerability } from "@/lib/types";

function SeverityBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
    vulnerable: "bg-red-50 text-red-700 border-red-200",
    fixed: "bg-blue-50 text-blue-700 border-blue-200",
    scanning: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-gray-100 text-gray-600 border-gray-200",
    failed: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

// Scan card component
function ScanCard({ scan }: { scan: Scan & { repositories: { full_name: string } } }) {
  return (
    <Link
      href={`/dashboard/scans/${scan.id}`}
      className="flex items-center justify-between py-3 px-4 hover:bg-black/[0.02] transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${scan.status === "clean" ? "bg-emerald-50" :
            scan.status === "vulnerable" ? "bg-red-50" :
              scan.status === "failed" ? "bg-orange-50" :
                "bg-amber-50"
          }`}>
          {scan.status === "clean" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : scan.status === "vulnerable" ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : scan.status === "failed" ? (
            <AlertCircle className="h-4 w-4 text-orange-600" />
          ) : (
            <Clock className="h-4 w-4 text-amber-600" />
          )}
        </div>
        <div>
          <span className="text-sm font-medium text-sf-text-primary block">
            {scan.repositories?.full_name ?? "Unknown repo"}
          </span>
          <span className="text-xs text-sf-text-tertiary flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {new Date(scan.triggered_at).toLocaleString()}
          </span>
        </div>
      </div>
      <SeverityBadge status={scan.status} />
    </Link>
  );
}

// Scan now button with retry logic and better error handling
function ScanNowButton({ repositoryId, onScanComplete }: { repositoryId: string; onScanComplete: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const handleScan = async (retryCount = 0) => {
    console.log("[ScanNow] repositoryId:", repositoryId, "attempt:", retryCount + 1);
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Don't retry rate limits or auth errors
        if (res.status === 429) throw new Error("Please wait 60 seconds between triggers");
        if (data.details?.includes("DECODER") || data.details?.includes("EC") || data.details?.includes("RSA")) {
          throw new Error("GitHub App auth failed. Check your environment variables and redeploy.");
        }
        // Retry on server errors
        if (res.status >= 500 && retryCount < MAX_RETRIES) {
          setTimeout(() => handleScan(retryCount + 1), RETRY_DELAY * (retryCount + 1));
          return;
        }
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }

      setResult(data.message || "Scan started");
      setTimeout(() => onScanComplete(), 1000);
    } catch (err) {
      setError((err as Error).message);
      setScanning(false);
    }
  };

  if (scanning) {
    return (
      <div className="flex items-center gap-2 text-sm text-sf-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Scanning...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleScan}
        disabled={scanning}
        className="inline-flex items-center gap-2 rounded-full bg-[#171719] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_18px_-10px_rgba(23,23,25,0.5)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        Scan Now
      </button>

      {error && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
          {!error.includes("wait 60 seconds") && (
            <button onClick={() => handleScan(0)} className="text-xs text-sf-text-secondary hover:text-sf-accent underline self-start">
              Retry
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          <span>{result}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    totalScans: 0,
    totalVulnerabilities: 0,
    fixedCount: 0,
    activeRepos: 0,
  });
  const [recentScans, setRecentScans] = useState<Array<Scan & { repositories: { full_name: string } }>>([]);
  const [connectedRepos, setConnectedRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("there");

  useEffect(() => {
    async function loadData() {
      console.log("[Dashboard] === PAGE LOAD STARTED ===");

      // Use singleton Supabase client to avoid auth race conditions
      const { createClient: createClientInner } = await import("@/utils/supabase/client");
      const supabase = createClientInner();
      console.log("[Dashboard] Client created (singleton)");

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("[Dashboard] Session loaded:", { userId: session?.user?.id, email: session?.user?.email, sessionError });

      if (!session?.user) {
        console.warn("[Dashboard] No session, aborting");
        setLoading(false);
        return;
      }

      const name = session.user.user_metadata?.full_name?.split(" ")[0] || session.user.email?.split("@")[0] || "there";
      setFirstName(name);

      try {
        // Fetch connected repositories
        console.log("[Dashboard] Fetching repositories for user:", session.user.id);
        const { data: repos, error: reposError } = await supabase
          .from("repositories")
          .select("*")
          .eq("user_id", session.user.id);
        console.log("[Dashboard] Repos result:", { count: repos?.length, reposError });
        if (reposError) {
          console.error("[Dashboard] Repos error:", reposError);
        }
        if (repos) {
          setConnectedRepos(repos);
        } else {
          setConnectedRepos([]);
        }

        const repoIds = repos?.map((r: any) => r.id) ?? [];
        console.log("[Dashboard] Repo IDs:", repoIds);

        // Try a direct query for the known scan ID to debug
        console.log("[Dashboard] Testing with known scan ID: 960141e9-d36b-4f9e-a43a-a167fa48b70b");
        const { data: testScan, error: testError } = await supabase
          .from("scans")
          .select("*")
          .eq("id", "960141e9-d36b-4f9e-a43a-a167fa48b70b")
          .single();
        console.log("[Dashboard] Test scan result:", testScan, "error:", testError);

        // Fetch recent scans (without repositories join — RLS blocks cross-table joins)
        console.log("[Dashboard] Fetching scans for repo IDs:", repoIds);
        const { data: scans, error: scansError } = await supabase
          .from("scans")
          .select("*")
          .in("repository_id", repoIds)
          .order("triggered_at", { ascending: false })
          .limit(5);
        console.log("[Dashboard] Scans result:", { count: scans?.length, scansError });
        if (scansError) {
          console.error("[Dashboard] Scans error:", scansError);
        } else {
          console.log("[Dashboard] Scans data:", JSON.stringify(scans, null, 2));
        }
        if (scans) {
          // Enrich with repo names (fetched separately above)
          const repoMap = new Map(repos?.map((r: any) => [r.id, r.full_name]));
          setRecentScans((scans as any[]).map((s: any) => ({
            ...s,
            repositories: { full_name: repoMap.get(s.repository_id) || "Unknown" },
          })));
        } else {
          setRecentScans([]);
        }

        // Calculate metrics
        setMetrics({
          activeRepos: repoIds.length,
          totalScans: repoIds.length > 0
            ? (await supabase.from("scans").select("id", { count: "exact" }).in("repository_id", repoIds)).count ?? 0
            : 0,
          totalVulnerabilities: 0,
          fixedCount: 0,
        });
      } catch (error) {
        console.error("[Dashboard] Unexpected error:", error);
      } finally {
        setLoading(false);
      }

      console.log("[Dashboard] === PAGE LOAD COMPLETE ===");
    }

    loadData();
  }, []);

  const metricCards = [
    {
      label: "Total Scans",
      value: metrics.totalScans.toString(),
      icon: Shield,
      iconColor: "text-sf-accent",
      bgColor: "bg-sf-accent/10",
    },
    {
      label: "Vulnerabilities Found",
      value: metrics.totalVulnerabilities.toString(),
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      label: "Issues Fixed",
      value: metrics.fixedCount.toString(),
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Active Repos",
      value: metrics.activeRepos.toString(),
      icon: GitBranch,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  if (loading) {
    return (
      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-48 sm:h-64 text-sf-text-tertiary">Loading...</div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mt-4 mb-6 md:mb-8 flex items-center justify-between flex-col sm:flex-row gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-sf-text-primary tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-sf-text-secondary mt-0.5 sm:mt-1">
            Here&apos;s what&apos;s happening across your repositories.
          </p>
        </div>
        <Link
          href="/dashboard/repositories/new"
          className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#171719] text-white px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5"
        >
          <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Connect Repo
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 md:mb-8">
        {metricCards.map((card, i) => (
          <div
            key={i}
            className="rounded-2xl border border-black/5 bg-white p-4 sm:p-5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]"
          >
            <div className={`mb-2 sm:mb-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${card.bgColor} ${card.iconColor}`}>
              <card.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-sf-text-primary">{card.value}</p>
            <p className="text-[11px] sm:text-xs text-sf-text-secondary mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Connected Repositories */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-base font-semibold text-sf-text-primary">Connected Repositories</h2>
          <Link href="/dashboard/repositories/new" className="text-[11px] sm:text-xs text-sf-accent hover:underline flex items-center gap-1">
            Manage repos
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {connectedRepos.length === 0 ? (
          <div className="rounded-[28px] border border-black/5 bg-white p-8 sm:p-12 text-center shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
            <GitBranch className="h-10 w-10 sm:h-12 sm:w-12 text-sf-text-tertiary/40 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-sf-text-primary font-medium mb-1 sm:mb-2">No repositories connected</p>
            <p className="text-xs sm:text-sm text-sf-text-secondary mb-4 sm:mb-6">Connect a GitHub repository to start security scanning.</p>
            <Link
              href="/dashboard/repositories/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#171719] text-white px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5"
            >
              <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] overflow-hidden">
            <div className="divide-y divide-black/5">
              {connectedRepos.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                    <GitBranch className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-sf-text-tertiary" />
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-sf-text-primary block truncate max-w-[150px] sm:max-w-none">
                        {repo.full_name}
                      </span>
                      <span className="text-[10px] sm:text-xs text-sf-text-tertiary">
                        Branch: {repo.default_branch || "main"}
                      </span>
                    </div>
                  </div>
                  <ScanNowButton
                    repositoryId={repo.id}
                    onScanComplete={() => {
                      // Reload only the data, not the whole page
                      window.location.reload();
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Scans */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-base font-semibold text-sf-text-primary">Recent Scans</h2>
          <Link href="/dashboard/scans" className="text-[11px] sm:text-xs text-sf-accent hover:underline flex items-center gap-1">
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {recentScans.length === 0 ? (
          <div className="rounded-[28px] border border-black/5 bg-white p-8 sm:p-12 text-center shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
            <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-sf-text-tertiary/40 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-sf-text-primary font-medium mb-1 sm:mb-2">No scans yet</p>
            <p className="text-xs sm:text-sm text-sf-text-secondary mb-4 sm:mb-6">Click "Scan Now" on a repository to start security scanning.</p>
          </div>
        ) : (
          <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] overflow-hidden">
            <div className="divide-y divide-black/5">
              {recentScans.map((scan) => (
                <ScanCard key={scan.id} scan={scan as any} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
