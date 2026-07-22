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
        <div className={`p-2 rounded-lg ${scan.status === "clean" ? "bg-emerald-50" : scan.status === "vulnerable" ? "bg-red-50" : "bg-amber-50"}`}>
          {scan.status === "clean" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : scan.status === "vulnerable" ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
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

// Scan now button
function ScanNowButton({ repositoryId, onScanComplete }: { repositoryId: string; onScanComplete: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleScan = async () => {
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
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }

      setResult(data.message);
      setTimeout(() => {
        onScanComplete();
      }, 2000);
    } catch (err) {
      console.error("Scan failed:", err);
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
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
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
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) return;

        const name = session.user.user_metadata?.full_name?.split(" ")[0] || session.user.email?.split("@")[0] || "there";
        setFirstName(name);

        // Fetch connected repositories
        const { data: repos } = await supabase
          .from("repositories")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (repos) {
          setConnectedRepos(repos);
        }

        // Fetch recent scans
        const { data: scans } = await supabase
          .from("scans")
          .select(`
            *,
            repositories (full_name)
          `)
          .eq("repositories.user_id", session.user.id)
          .order("triggered_at", { ascending: false })
          .limit(5);

        if (scans) {
          setRecentScans(scans as any);
        }

        // Calculate metrics
        const repoIds = repos?.map((r: any) => r.id) ?? [];
        setMetrics({
          activeRepos: repoIds.length,
          totalScans: repoIds.length > 0
            ? (await supabase.from("scans").select("id", { count: "exact" }).in("repository_id", repoIds)).count ?? 0
            : 0,
          totalVulnerabilities: 0,
          fixedCount: 0,
        });

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
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
      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64 text-sf-text-tertiary">Loading...</div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mt-4 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-sf-text-primary tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {firstName} 👋
          </h1>
          <p className="text-sm text-sf-text-secondary mt-1">
            Here&apos;s what&apos;s happening across your repositories.
          </p>
        </div>
        <Link
          href="/dashboard/repositories/new"
          className="hidden md:inline-flex items-center gap-2 rounded-full bg-[#171719] text-white px-5 py-2.5 text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5"
        >
          <GitBranch className="h-4 w-4" />
          Connect Repo
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metricCards.map((card, i) => (
          <div
            key={i}
            className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bgColor} ${card.iconColor}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-semibold text-sf-text-primary">{card.value}</p>
            <p className="text-xs text-sf-text-secondary mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Connected Repositories */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sf-text-primary">Connected Repositories</h2>
          <Link href="/dashboard/repositories/new" className="text-xs text-sf-accent hover:underline flex items-center gap-1">
            Manage repos
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {connectedRepos.length === 0 ? (
          <div className="rounded-[28px] border border-black/5 bg-white p-12 text-center shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
            <GitBranch className="h-12 w-12 text-sf-text-tertiary/40 mx-auto mb-4" />
            <p className="text-sf-text-primary font-medium mb-2">No repositories connected</p>
            <p className="text-sm text-sf-text-secondary mb-6">Connect a GitHub repository to start security scanning.</p>
            <Link
              href="/dashboard/repositories/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#171719] text-white px-5 py-2.5 text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5"
            >
              <GitBranch className="h-4 w-4" />
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] overflow-hidden">
            <div className="divide-y divide-black/5">
              {connectedRepos.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-sf-text-tertiary" />
                    <div>
                      <span className="text-sm font-medium text-sf-text-primary block">
                        {repo.full_name}
                      </span>
                      <span className="text-xs text-sf-text-tertiary">
                        Branch: {repo.default_branch || "main"}
                      </span>
                    </div>
                  </div>
                  <ScanNowButton
                    repositoryId={repo.id}
                    onScanComplete={() => {
                      // Reload scans
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sf-text-primary">Recent Scans</h2>
          <Link href="/dashboard/scans" className="text-xs text-sf-accent hover:underline flex items-center gap-1">
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {recentScans.length === 0 ? (
          <div className="rounded-[28px] border border-black/5 bg-white p-12 text-center shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
            <Shield className="h-12 w-12 text-sf-text-tertiary/40 mx-auto mb-4" />
            <p className="text-sf-text-primary font-medium mb-2">No scans yet</p>
            <p className="text-sm text-sf-text-secondary mb-6">Click "Scan Now" on a repository to start security scanning.</p>
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
