"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, CheckCircle2, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import type { Scan, Vulnerability } from "@/lib/types";

interface VulnerabilityTimelineEvent {
  status: string;
  timestamp: string;
  label: string;
  icon: typeof CheckCircle2;
}

export default function ScanDetailPage({ params }: { params: { id: string } }) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [{ data: scanData }, { data: vulnData }] = await Promise.all([
        supabase.from("scans").select("*, repositories(full_name)").eq("id", params.id).single(),
        supabase.from("vulnerabilities").select("*").eq("scan_id", params.id).order("severity", { ascending: false }),
      ]);
      setScan(scanData as Scan);
      setVulnerabilities((vulnData as Vulnerability[]) ?? []);
      if (vulnData && vulnData.length > 0) setSelected(vulnData[0] as Vulnerability);
      setLoading(false);
    };
    load();
  }, [params.id]);

  // Real-time Supabase subscription for live scan updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`scan-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vulnerabilities",
          filter: `scan_id=eq.${params.id}`,
        },
        (payload) => {
          const updated = payload.new as Vulnerability;
          setVulnerabilities((prev) =>
            prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v))
          );
          if (selected?.id === updated.id) {
            setSelected((prev) => (prev ? { ...prev, ...updated } : null));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scans",
          filter: `id=eq.${params.id}`,
        },
        (payload) => {
          const updatedScan = payload.new as Scan;
          setScan((prev) => (prev ? { ...prev, ...updatedScan } : null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, selected?.id]);

  const handleDismiss = async (vuln: Vulnerability) => {
    const supabase = createClient();
    await supabase.from("vulnerabilities").update({ status: "dismissed" }).eq("id", vuln.id);
    setVulnerabilities((prev) =>
      prev.map((v) => (v.id === vuln.id ? { ...v, status: "dismissed" } : v))
    );
    if (selected?.id === vuln.id)
      setSelected((prev) => (prev ? { ...prev, status: "dismissed" } : null));
    toast("Vulnerability dismissed", { description: "Marked as false positive." });
  };

  const handleSnooze = async (vuln: Vulnerability) => {
    const supabase = createClient();
    const snoozedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("vulnerabilities")
      .update({ status: "snoozed", snoozed_until: snoozedUntil })
      .eq("id", vuln.id);
    setVulnerabilities((prev) =>
      prev.map((v) => (v.id === vuln.id ? { ...v, status: "snoozed" } : v))
    );
    toast("Snoozed for 30 days", { description: "You won't be reminded about this until then." });
  };

  const severityStyle: Record<string, string> = {
    Critical: "bg-red-50 text-red-700 border-red-200",
    High: "bg-orange-50 text-orange-700 border-orange-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-blue-50 text-blue-700 border-blue-200",
  };

  // Build timeline from vulnerability status history
  const buildTimeline = (vuln: Vulnerability): VulnerabilityTimelineEvent[] => {
    const events: VulnerabilityTimelineEvent[] = [
      {
        status: "open",
        timestamp: vuln.created_at,
        label: "Detected",
        icon: ShieldAlert,
      },
    ];

    if (vuln.updated_at && vuln.updated_at !== vuln.created_at) {
      events.push({
        status: vuln.status,
        timestamp: vuln.updated_at,
        label: getStatusLabel(vuln.status),
        icon: getStatusIcon(vuln.status),
      });
    }

    return events;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      fixed: "Fixed",
      dismissed: "Dismissed",
      snoozed: "Snoozed",
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string): typeof ShieldAlert => {
    const icons: Record<string, typeof CheckCircle2> = {
      fixed: CheckCircle2,
      dismissed: X,
      snoozed: Clock,
    };
    return (icons[status] as typeof ShieldAlert) || ShieldAlert;
  };

  if (loading) {
    return (
      <main className="p-8 flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-sf-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!scan)
    return (
      <main className="p-8 text-center text-sf-text-secondary">
        Scan not found.{" "}
        <Link href="/dashboard/scans" className="text-sf-accent underline">
          Go back
        </Link>
      </main>
    );

  const repoName = (scan as Scan & { repositories: { full_name: string } }).repositories?.full_name;

  return (
    <main className="p-6 md:p-8 max-w-7xl mx-auto">
      <Link
        href="/dashboard/scans"
        className="inline-flex items-center text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors mb-6 mt-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Scans
      </Link>

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          {repoName && (
            <span className="text-sm text-sf-text-tertiary">{repoName}</span>
          )}
          <h1 className="text-2xl font-semibold text-sf-text-primary tracking-tight mt-1">
            {vulnerabilities.length === 0
              ? "Clean Scan ✅"
              : `${vulnerabilities.length} Vulnerabilit${vulnerabilities.length === 1 ? "y" : "ies"} Found`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {scan.status === "vulnerable" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
              Vulnerable
            </span>
          )}
          {scan.status === "clean" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Clean
            </span>
          )}
          <span className="text-sm text-sf-text-tertiary">
            {new Date(scan.triggered_at).toLocaleString()}
          </span>
        </div>
      </header>

      {vulnerabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-24">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
          <p className="text-sf-text-primary text-xl font-semibold mb-2">
            No vulnerabilities detected
          </p>
          <p className="text-sf-text-secondary">This scan came back completely clean.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vulnerability list */}
          <div className="lg:col-span-1 space-y-2">
            {vulnerabilities.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${selected?.id === v.id
                  ? "border-sf-accent/30 bg-sf-accent/5 shadow-[0_0_20px_-10px_rgba(227,74,50,0.2)]"
                  : "border-black/5 bg-white hover:bg-black/[0.02]"
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityStyle[v.severity] ?? "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                  >
                    {v.severity}
                  </span>
                  {v.status !== "open" && (
                    <span className="text-xs text-sf-text-tertiary capitalize">{v.status}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-sf-text-primary truncate">
                  {v.vulnerability_type ?? "Unknown"}
                </p>
                <p className="text-xs text-sf-text-tertiary mt-0.5 truncate">
                  {v.file_path ?? "Unknown file"}
                  {v.line ? `:${v.line}` : ""}
                </p>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-lg font-semibold text-sf-text-primary flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-sf-accent" />
                    {selected.vulnerability_type}
                  </h2>
                  {selected.status === "open" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSnooze(selected)}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-sf-text-secondary shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] transition-all hover:bg-black/5"
                      >
                        <Clock className="h-3 w-3" />
                        Snooze
                      </button>
                      <button
                        onClick={() => handleDismiss(selected)}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] transition-all hover:bg-red-50"
                      >
                        <X className="h-3 w-3" />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-sf-text-secondary">
                  {selected.plain_english_explanation}
                </p>
                {selected.file_path && (
                  <p className="text-xs text-sf-text-tertiary mt-3 font-mono bg-black/[0.02] px-3 py-1.5 rounded-lg inline-block">
                    {selected.file_path}
                    {selected.line ? `:${selected.line}` : ""}
                  </p>
                )}
              </div>

              {/* Vulnerability Timeline */}
              <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
                <h3 className="text-sm font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sf-accent" />
                  Vulnerability Timeline
                </h3>
                <div className="relative pl-4 space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {buildTimeline(selected).map((event, idx) => {
                    const Icon = event.icon;
                    return (
                      <div key={idx} className="relative flex items-start gap-3">
                        <div className="absolute -left-4 top-1 w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10">
                          <Icon className="h-3 w-3 text-gray-500" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm text-sf-text-primary">{event.label}</p>
                          <p className="text-xs text-sf-text-tertiary">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.vulnerable_code && (
                <div className="rounded-[28px] border border-black/5 bg-[#171719] overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_20px_40px_-20px_rgba(23,23,25,0.8)]">
                  <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-white/40 ml-3 font-mono">
                      {selected.file_path}
                    </span>
                  </div>
                  <div className="p-4 overflow-x-auto text-sm text-white/75 font-mono space-y-2">
                    <pre className="bg-red-500/10 border-l-4 border-red-500 -mx-4 px-4 py-2 text-red-300 whitespace-pre-wrap">
                      {selected.vulnerable_code}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
