"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Shield, AlertTriangle, TrendingDown, CheckCircle2, Gauge, Target, BarChart3 } from "lucide-react";

interface AnalyticsData {
  securityScore: number;
  totalScans: number;
  totalVulnerabilities: number;
  vulnerabilitiesBySeverity: { critical: number; high: number; medium: number; low: number };
  vulnerabilitiesByStatus: { open: number; fixed: number; dismissed: number; snoozed: number };
  recentTrend: Array<{
    date: string;
    status: string;
    vulns: number;
    critical: number;
    high: number;
  }>;
  repositoryTrend: Array<{
    repositoryId: string;
    totalVulnerabilities: number;
    openVulnerabilities: number;
    fixedVulnerabilities: number;
  }>;
}

export default function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session) return;

        const response = await fetch(`/api/analytics`);
        if (!response.ok) throw new Error("Failed to fetch analytics");

        const data = await response.json();
        setAnalytics(data);
      } catch (error) {
        console.error("Failed to load analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
        <div className="flex items-center justify-center h-64 text-sf-text-tertiary">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) return null;

  const scoreColor = analytics.securityScore >= 80 ? "text-emerald-500" :
    analytics.securityScore >= 60 ? "text-amber-500" :
    analytics.securityScore >= 40 ? "text-orange-500" :
    "text-red-500";

  const scoreBg = analytics.securityScore >= 80 ? "bg-emerald-500/10" :
    analytics.securityScore >= 60 ? "bg-amber-500/10" :
    analytics.securityScore >= 40 ? "bg-orange-500/10" :
    "bg-red-500/10";

  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-sf-text-primary flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sf-accent" />
          Security Analytics
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Score */}
        <div className="flex flex-col items-center justify-center p-6">
          <div className={`relative w-32 h-32 rounded-full ${scoreBg} flex items-center justify-center`}>
            <svg className="absolute inset-2 w-[92%] h-[92%] -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-gray-200"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className={scoreColor}
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - analytics.securityScore / 100)}`}
              />
            </svg>
            <div className="text-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>{analytics.securityScore}</span>
              <p className="text-xs text-sf-text-tertiary mt-1">Security Score</p>
            </div>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-sf-text-primary flex items-center gap-2">
            <Target className="h-4 w-4 text-sf-accent" />
            By Severity
          </h3>
          <SeverityBar label="Critical" count={analytics.vulnerabilitiesBySeverity.critical} color="bg-red-500" total={analytics.totalVulnerabilities} />
          <SeverityBar label="High" count={analytics.vulnerabilitiesBySeverity.high} color="bg-orange-500" total={analytics.totalVulnerabilities} />
          <SeverityBar label="Medium" count={analytics.vulnerabilitiesBySeverity.medium} color="bg-amber-500" total={analytics.totalVulnerabilities} />
          <SeverityBar label="Low" count={analytics.vulnerabilitiesBySeverity.low} color="bg-blue-500" total={analytics.totalVulnerabilities} />
        </div>

        {/* Status Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-sf-text-primary flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sf-accent" />
            By Status
          </h3>
          <StatusItem label="Open" count={analytics.vulnerabilitiesByStatus.open} icon={AlertTriangle} iconColor="text-red-400" />
          <StatusItem label="Fixed" count={analytics.vulnerabilitiesByStatus.fixed} icon={CheckCircle2} iconColor="text-emerald-400" />
          <StatusItem label="Snoozed" count={analytics.vulnerabilitiesByStatus.snoozed} icon={Shield} iconColor="text-amber-400" />
          <StatusItem label="Dismissed" count={analytics.vulnerabilitiesByStatus.dismissed} icon={Shield} iconColor="text-gray-400" />
        </div>
      </div>

      {/* Recent Trend */}
      {analytics.recentTrend.length > 0 && (
        <div className="mt-6 pt-6 border-t border-black/5">
          <h3 className="text-sm font-semibold text-sf-text-primary flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-sf-accent" />
            Scan Trend (Last {analytics.recentTrend.length} Scans)
          </h3>
          <div className="flex items-end gap-3 h-32">
            {analytics.recentTrend.map((scan, idx) => {
              const maxVulns = Math.max(...analytics.recentTrend.map(s => s.vulns), 1);
              const height = Math.max((scan.vulns / maxVulns) * 100, 4);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative w-full flex justify-center">
                    {scan.critical > 0 && (
                      <div className="absolute -top-1 w-3 h-3 bg-red-500 rounded-full" title={`${scan.critical} critical`} />
                    )}
                    {scan.high > 0 && (
                      <div className="absolute -top-3 left-1 w-2.5 h-2.5 bg-orange-500 rounded-full" title={`${scan.high} high`} />
                    )}
                  </div>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      scan.vulns > 0
                        ? scan.critical > 0
                          ? "bg-red-500/80"
                          : scan.high > 0
                            ? "bg-orange-500/80"
                            : "bg-amber-500/80"
                        : "bg-emerald-500/80"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-[10px] text-sf-text-tertiary text-center leading-tight">
                    {new Date(scan.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-sf-text-secondary w-12">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-sf-text-primary w-6 text-right">{count}</span>
    </div>
  );
}

function StatusItem({ label, count, icon: Icon, iconColor }: { label: string; count: number; icon: typeof Shield; iconColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
      <span className="text-xs text-sf-text-secondary flex-1">{label}</span>
      <span className="text-sm font-medium text-sf-text-primary">{count}</span>
    </div>
  );
}
