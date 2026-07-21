/**
 * Analytics API
 * Returns security score, vulnerability trends, and severity distribution
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Get user's repository IDs
    const { data: repos } = await supabase
      .from("repositories")
      .select("id")
      .eq("user_id", userId);

    const repoIds = repos?.map((r) => r.id) ?? [];

    if (repoIds.length === 0) {
      return NextResponse.json({
        securityScore: 100,
        totalScans: 0,
        totalVulnerabilities: 0,
        vulnerabilitiesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        vulnerabilitiesByStatus: { open: 0, fixed: 0, dismissed: 0, snoozed: 0 },
        recentTrend: [],
        repositoryTrend: [],
      });
    }

    // Get all scans with their vulnerabilities
    const { data: scans } = await supabase
      .from("scans")
      .select("*")
      .in("repository_id", repoIds)
      .order("triggered_at", { ascending: false });

    const { data: vulnerabilities } = await supabase
      .from("vulnerabilities")
      .select("*")
      .in("scan_id", (scans ?? []).map((s) => s.id));

    const vulns = (vulnerabilities ?? []) as Array<Record<string, unknown>>;
    const scanList = (scans ?? []) as Array<Record<string, unknown>>;

    // Calculate security score (0-100)
    const totalVulns = vulns.length;
    const criticalCount = vulns.filter((v: any) => v.severity === "Critical").length;
    const highCount = vulns.filter((v: any) => v.severity === "High").length;
    const mediumCount = vulns.filter((v: any) => v.severity === "Medium").length;
    const lowCount = vulns.filter((v: any) => v.severity === "Low").length;

    // Score: 100 - (critical * 25 + high * 15 + medium * 5 + low * 2)
    const securityScore = Math.max(0, Math.min(100, 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 5 + lowCount * 2)));

    // Severity distribution
    const vulnerabilitiesBySeverity = {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    };

    // Status distribution
    const vulnerabilitiesByStatus = {
      open: vulns.filter((v: any) => v.status === "open").length,
      fixed: vulns.filter((v: any) => v.status === "fixed").length,
      dismissed: vulns.filter((v: any) => v.status === "dismissed").length,
      snoozed: vulns.filter((v: any) => v.status === "snoozed").length,
    };

    // Recent trend (last 7 scans with severity breakdown)
    const recentTrend = scanList.slice(0, 7).reverse().map((scan) => ({
      date: scan.triggered_at,
      status: scan.status,
      vulns: vulns.filter((v: any) => v.scan_id === scan.id).length,
      critical: vulns.filter((v: any) => v.scan_id === scan.id && v.severity === "Critical").length,
      high: vulns.filter((v: any) => v.scan_id === scan.id && v.severity === "High").length,
    }));

    // Repository trend (vulnerabilities per repo, last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentScans } = await supabase
      .from("scans")
      .select("id, repository_id")
      .in("repository_id", repoIds)
      .gte("triggered_at", thirtyDaysAgo);

    const repositoryTrend = repoIds.map((repoId) => {
      const repoScanIds = (recentScans ?? [])
        .filter((s: any) => s.repository_id === repoId)
        .map((s: any) => s.id);

      const repoVulns = vulns.filter((v: any) => repoScanIds.includes(v.scan_id));
      const fixedVulns = repoVulns.filter((v: any) => v.status === "fixed");

      return {
        repositoryId: repoId,
        totalVulnerabilities: repoVulns.length,
        openVulnerabilities: repoVulns.filter((v: any) => v.status === "open").length,
        fixedVulnerabilities: fixedVulns.length,
      };
    });

    return NextResponse.json({
      securityScore,
      totalScans: scanList.length,
      totalVulnerabilities: totalVulns,
      vulnerabilitiesBySeverity,
      vulnerabilitiesByStatus,
      recentTrend,
      repositoryTrend,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
