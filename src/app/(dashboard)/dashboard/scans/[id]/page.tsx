"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, CheckCircle2, Clock, X, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import type { Scan, Vulnerability, VulnerabilityTriage, FixReview } from "@/lib/types";

interface VulnerabilityTimelineEvent {
  status: string;
  timestamp: string;
  label: string;
  icon: typeof CheckCircle2;
}

export default function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiTriage, setAiTriage] = useState<VulnerabilityTriage[]>([]);
  const [aiTriageLoading, setAiTriageLoading] = useState(false);
  const [fixReviews, setFixReviews] = useState<Record<string, FixReview>>({});
  const [fixReviewLoading, setFixReviewLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const { id } = await params;
      const supabase = createClient();

      console.log("[ScanDetail] Loading scan ID:", id);

      // Fetch scans without cross-table join (RLS blocks repositories in join)
      const { data: scanData } = await supabase
        .from("scans")
        .select("*")
        .eq("id", id)
        .single();

      console.log("[ScanDetail] Scan data:", scanData);

      // Fetch repo name separately
      const { data: repos } = await supabase
        .from("repositories")
        .select("id, full_name")
        .eq("id", scanData?.repository_id)
        .single();

      console.log("[ScanDetail] Repo data:", repos);

      // Merge repo name into scan
      const scanWithRepo = scanData ? {
        ...scanData,
        repositories: { full_name: repos?.full_name || "Unknown" },
      } : null;

      setScan(scanWithRepo as Scan);

      const { data: vulnData } = await supabase
        .from("vulnerabilities")
        .select("*")
        .eq("scan_id", id)
        .order("severity", { ascending: false });

      console.log("[ScanDetail] Vulnerabilities:", (vulnData as any)?.length);

      setVulnerabilities((vulnData as Vulnerability[]) ?? []);
      if (vulnData && vulnData.length > 0) setSelected(vulnData[0] as Vulnerability);
      setLoading(false);
    };
    load();
  }, [params]);

  // Real-time Supabase subscription for live scan updates
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    const supabase = createClient();

    (async () => {
      const { id } = await params;
      if (cancelled) return;

      channel = supabase
        .channel(`scan-${id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "vulnerabilities",
            filter: `scan_id=eq.${id}`,
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
            filter: `id=eq.${id}`,
          },
          (payload) => {
            const updatedScan = payload.new as Scan;
            setScan((prev) => (prev ? { ...prev, ...updatedScan } : null));
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [params, selected?.id]);

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

  const handleAiTriage = async () => {
    setAiTriageLoading(true);
    try {
      const { id } = await params;
      const res = await fetch("/api/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: id }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "AI triage failed");
        return;
      }

      const data = await res.json();
      setAiTriage(data.vulnerabilities ?? []);
      toast.success("AI prioritization complete");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAiTriageLoading(false);
    }
  };

  const handleAiReviewFix = async (vuln: Vulnerability) => {
    setFixReviewLoading((prev) => ({ ...prev, [vuln.id]: true }));
    try {
      const res = await fetch("/api/ai/review-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulnerabilityId: vuln.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "AI fix review failed");
        return;
      }

      const data = await res.json();
      setFixReviews((prev) => ({ ...prev, [vuln.id]: data.review }));
      toast.success("AI fix review complete");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFixReviewLoading((prev) => ({ ...prev, [vuln.id]: false }));
    }
  };

  const getTriageInfo = (vulnId: string) => aiTriage.find((t) => t.vulnerability_id === vulnId);
  const getFixReview = (vulnId: string) => fixReviews[vulnId];
  const getPriorityColor = (score: number) => {
    if (score >= 80) return "text-red-600 bg-red-50 border-red-200";
    if (score >= 60) return "text-orange-600 bg-orange-50 border-orange-200";
    if (score >= 40) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-blue-600 bg-blue-50 border-blue-200";
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
      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-sf-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!scan)
    return (
      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto text-center text-sf-text-secondary">
        Scan not found.{" "}
        <Link href="/dashboard/scans" className="text-sf-accent underline">
          Go back
        </Link>
      </main>
    );

  const repoName = (scan as Scan & { repositories: { full_name: string } }).repositories?.full_name;

  return (
    <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <Link
        href="/dashboard/scans"
        className="inline-flex items-center text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors mb-4 md:mb-6 mt-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Scans
      </Link>

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          {repoName && (
            <span className="text-xs sm:text-sm text-sf-text-tertiary">{repoName}</span>
          )}
          <h1 className="text-xl md:text-2xl font-semibold text-sf-text-primary tracking-tight mt-1">
            {vulnerabilities.length === 0
              ? "Clean Scan ✅"
              : `${vulnerabilities.length} Vulnerabilit${vulnerabilities.length === 1 ? "y" : "ies"} Found`}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          <span className="text-xs text-sf-text-tertiary">
            {new Date(scan.triggered_at).toLocaleString()}
          </span>
          {vulnerabilities.length > 0 && (
            <button
              onClick={handleAiTriage}
              disabled={aiTriageLoading || aiTriage.length > 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sf-accent/10 to-orange-500/10 border border-sf-accent/20 px-3 py-1.5 text-xs font-medium text-sf-accent shadow-sm transition-all hover:from-sf-accent/15 hover:to-orange-500/15 disabled:opacity-50 shrink-0"
            >
              {aiTriageLoading ? (
                <>
                  <Clock className="h-3 w-3 animate-spin" />
                  Prioritizing...
                </>
              ) : aiTriage.length > 0 ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  AI Prioritized
                </>
              ) : (
                <>
                  <Brain className="h-3 w-3" />
                  AI Prioritize
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {vulnerabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 sm:py-24">
          <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-emerald-500 mb-3 sm:mb-4" />
          <p className="text-sf-text-primary text-lg sm:text-xl font-semibold mb-2">
            No vulnerabilities detected
          </p>
          <p className="text-sf-text-secondary text-sm sm:text-base">This scan came back completely clean.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Vulnerability list */}
          <div className="lg:col-span-1 space-y-2">
            {vulnerabilities.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={`w-full text-left rounded-xl border p-3 sm:p-4 transition-all ${selected?.id === v.id
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
                  {aiTriage.length > 0 && (() => {
                    const triage = getTriageInfo(v.id);
                    if (!triage) return null;
                    const color = getPriorityColor(triage.priority_score);
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
                        P{Math.round(triage.priority_score)}
                      </span>
                    );
                  })()}
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
              <div className="rounded-[28px] border border-black/5 bg-white p-4 sm:p-6 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-sf-text-primary flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5 text-sf-accent" />
                    {selected.vulnerability_type}
                  </h2>
                  {selected.status === "open" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleSnooze(selected)}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium text-sf-text-secondary shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] transition-all hover:bg-black/5"
                      >
                        <Clock className="h-3 w-3" />
                        Snooze
                      </button>
                      <button
                        onClick={() => handleDismiss(selected)}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium text-red-600 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)] transition-all hover:bg-red-50"
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

                {selected.vulnerable_code && (
                  <div className="rounded-[28px] border border-black/5 bg-[#171719] overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_20px_40px_-20px_rgba(23,23,25,0.8)]">
                    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </div>
                        <span className="text-xs text-white/40 font-mono">
                          {selected.file_path}
                          {selected.line ? `:${selected.line}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400">Vulnerable</span>
                        {selected.fixed_code && <span className="text-white/20">→</span>}
                        {selected.fixed_code && <span className="text-emerald-400">Fixed</span>}
                      </div>
                    </div>

                    {/* Vulnerable code */}
                    <div className="p-4 overflow-x-auto">
                      <pre className="bg-red-500/10 border-l-4 border-red-500 -mx-4 px-4 py-2 text-red-300 whitespace-pre-wrap font-mono text-sm">
                        {selected.vulnerable_code}
                      </pre>
                    </div>

                    {/* Fixed code */}
                    {selected.fixed_code && (
                      <div className="border-t border-white/5 p-4 overflow-x-auto">
                        <pre className="bg-emerald-500/10 border-l-4 border-emerald-500 -mx-4 px-4 py-2 text-emerald-300 whitespace-pre-wrap font-mono text-sm">
                          {selected.fixed_code}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {selected.fixed_code && (
                  <div className="rounded-[28px] border border-black/5 bg-white p-4 sm:p-6 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-sf-text-primary flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-sf-accent" />
                        AI Fix Review
                      </h3>
                      <button
                        onClick={() => handleAiReviewFix(selected)}
                        disabled={fixReviewLoading[selected.id]}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#171719] text-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 shrink-0"
                      >
                        {fixReviewLoading[selected.id] ? (
                          <>
                            <Clock className="h-3 w-3 animate-spin" />
                            Reviewing...
                          </>
                        ) : getFixReview(selected.id) ? (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Re-review
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Review Fix
                          </>
                        )}
                      </button>
                    </div>

                    {getFixReview(selected.id) ? (() => {
                      const review = getFixReview(selected.id)!;
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            {review.pass ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                            <span className={`text-sm font-semibold ${review.pass ? "text-emerald-600" : "text-red-600"}`}>
                              {review.pass ? "Fix looks good" : "Issues found"}
                            </span>
                            <span className="text-[10px] text-sf-text-tertiary">Score: {review.score}/10 · Confidence: {Math.round(review.confidence * 100)}%</span>
                          </div>

                          {review.issues && review.issues.length > 0 && (
                            <div className="rounded-lg bg-red-50 p-2.5 border border-red-100">
                              <p className="text-xs font-medium text-red-700 mb-1">Issues:</p>
                              {review.issues.map((issue, i) => (
                                <p key={i} className="text-[11px] text-red-600">• {issue}</p>
                              ))}
                            </div>
                          )}

                          {review.suggestions && review.suggestions.length > 0 && (
                            <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-100">
                              <p className="text-xs font-medium text-blue-700 mb-1">Suggestions:</p>
                              {review.suggestions.map((s, i) => (
                                <p key={i} className="text-[11px] text-blue-600">• {s}</p>
                              ))}
                            </div>
                          )}

                          {review.security_risks && review.security_risks.length > 0 && (
                            <div className="rounded-lg bg-orange-50 p-2.5 border border-orange-100">
                              <p className="text-xs font-medium text-orange-700 mb-1">Security Risks:</p>
                              {review.security_risks.map((r, i) => (
                                <p key={i} className="text-[11px] text-orange-600">• {r}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <p className="text-xs text-sf-text-tertiary text-center py-4">Click "Review Fix" to validate the AI-generated fix</p>
                    )}
                  </div>
                )}
              </div>
          )}
            </div>
          )}
        </main>
      );
}
