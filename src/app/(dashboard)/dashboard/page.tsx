import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getDashboardMetrics, getRecentScans } from "@/lib/db";
import { TerminalWidget } from "@/components/TerminalWidget";
import AnalyticsSection from "@/components/AnalyticsSection";
import { Shield, GitBranch, CheckCircle2, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Scan } from "@/lib/types";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [metrics, recentScans] = await Promise.all([
    getDashboardMetrics(user.id),
    getRecentScans(user.id, 5),
  ]);

  const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

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

      {/* Security Analytics */}
      <div className="mb-8">
        <AnalyticsSection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <div className="rounded-[28px] border border-black/5 bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
            <h2 className="font-semibold text-sf-text-primary">Recent Scans</h2>
            <Link href="/dashboard/history" className="text-xs text-sf-accent hover:underline flex items-center gap-1">
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {recentScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Shield className="h-12 w-12 text-sf-text-tertiary/40 mb-4" />
              <p className="text-sf-text-primary font-medium mb-2">No scans yet</p>
              <p className="text-sm text-sf-text-secondary mb-6">Connect a repository to start automated security scanning.</p>
              <Link
                href="/dashboard/repositories/new"
                className="rounded-full bg-[#171719] text-white px-5 py-2.5 text-sm font-medium shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5"
              >
                Connect Repository
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {recentScans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/dashboard/scans/${scan.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-black/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-sm font-medium text-sf-text-primary block">
                        {(scan as Scan & { repositories: { full_name: string } }).repositories?.full_name ?? "Unknown repo"}
                      </span>
                      <span className="text-xs text-sf-text-tertiary flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(scan.triggered_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <SeverityBadge status={scan.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Live Activity Terminal */}
        <div>
          <h2 className="font-semibold text-sf-text-primary mb-4">Live Activity</h2>
          <TerminalWidget />
        </div>
      </div>
    </main>
  );
}
