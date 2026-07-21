/**
 * Scan Report Export API
 * Exports vulnerability data as JSON or HTML (for PDF printing)
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanId } = await params;
    const { searchParams } = new URL(_request.url);
    const format = searchParams.get("format") || "json";

    const supabase = createServiceRoleClient();

    // Fetch scan and associated vulnerabilities
    const [{ data: scan, error: scanError }, { data: vulns, error: vulnError }] =
      await Promise.all([
        supabase
          .from("scans")
          .select("*, repositories(full_name)")
          .eq("id", scanId)
          .single(),
        supabase
          .from("vulnerabilities")
          .select("*")
          .eq("scan_id", scanId)
          .order("severity", { ascending: false }),
      ]);

    if (scanError || !scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (vulnError) {
      throw vulnError;
    }

    const vulnerabilities = (vulns ?? []) as Array<Record<string, unknown>>;

    // Generate report metadata
    const reportData = {
      generatedAt: new Date().toISOString(),
      scan: {
        id: scan.id,
        repository: (scan as any).repositories?.full_name || "Unknown",
        branch: scan.branch,
        commitSha: scan.commit_sha,
        status: scan.status,
        triggeredAt: scan.triggered_at,
        completedAt: scan.completed_at,
      },
      summary: {
        totalVulnerabilities: vulnerabilities.length,
        critical: vulnerabilities.filter((v: any) => v.severity === "Critical").length,
        high: vulnerabilities.filter((v: any) => v.severity === "High").length,
        medium: vulnerabilities.filter((v: any) => v.severity === "Medium").length,
        low: vulnerabilities.filter((v: any) => v.severity === "Low").length,
        fixed: vulnerabilities.filter((v: any) => v.status === "fixed").length,
      },
      vulnerabilities: vulnerabilities.map((v: any) => ({
        id: v.id,
        type: v.vulnerability_type,
        severity: v.severity,
        status: v.status,
        filePath: v.file_path,
        explanation: v.plain_english_explanation,
        vulnerableCode: v.vulnerable_code,
        fixedCode: v.fixed_code,
        prUrl: v.pr_url,
        createdAt: v.created_at,
      })),
    };

    if (format === "json") {
      return NextResponse.json(reportData, {
        headers: {
          "Content-Disposition": `attachment; filename="krypta-report-${scanId}.json"`,
          "Content-Type": "application/json",
        },
      });
    }

    // HTML format (for PDF printing via browser)
    const html = generateHtmlReport(reportData);

    return new NextResponse(html, {
      headers: {
        "Content-Disposition": `attachment; filename="krypta-report-${scanId}.html"`,
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}

function generateHtmlReport(data: Record<string, unknown>): string {
  const scan = data.scan as Record<string, unknown>;
  const summary = data.summary as Record<string, number>;
  const vulns = data.vulnerabilities as Array<Record<string, unknown>>;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Krypta Security Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 1rem; border-bottom: 2px solid #e34a32; padding-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .summary-card { padding: 1rem; border-radius: 8px; text-align: center; }
    .summary-card .number { font-size: 2rem; font-weight: bold; }
    .summary-card .label { font-size: 0.85rem; color: #666; }
    .critical { background: #fef2f2; border: 1px solid #fecaca; }
    .critical .number { color: #dc2626; }
    .high { background: #fff7ed; border: 1px solid #fed7aa; }
    .high .number { color: #ea580c; }
    .medium { background: #fffbeb; border: 1px solid #fde68a; }
    .medium .number { color: #d97706; }
    .low { background: #eff6ff; border: 1px solid #bfdbfe; }
    .low .number { color: #2563eb; }
    .vuln-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }
    .vuln-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .vuln-type { font-weight: 600; font-size: 1.1rem; }
    .badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .severity-Critical { background: #fef2f2; color: #dc2626; }
    .severity-High { background: #fff7ed; color: #ea580c; }
    .severity-Medium { background: #fffbeb; color: #d97706; }
    .severity-Low { background: #eff6ff; color: #2563eb; }
    .status-badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; }
    .status-open { background: #f0fdf4; color: #16a34a; }
    .status-fixed { background: #eff6ff; color: #2563eb; }
    .status-dismissed { background: #f3f4f6; color: #6b7280; }
    .status-snoozed { background: #fefce8; color: #ca8a04; }
    pre { background: #1a1a2e; color: #e2e8f0; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; margin: 0.5rem 0; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 0.8rem; }
    @media print { body { padding: 1rem; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>🔒 Krypta Security Report</h1>
  <p class="meta">Generated: ${new Date(data.generatedAt as string).toLocaleString()}</p>

  <div class="meta">
    <strong>Repository:</strong> ${scan.full_name || "Unknown"}<br>
    <strong>Branch:</strong> ${scan.branch || "main"}<br>
    <strong>Commit:</strong> <code>${(scan.commitSha as string)?.slice(0, 8)}${(scan.commitSha as string)?.length > 8 ? "..." : ""}</code><br>
    <strong>Status:</strong> ${scan.status}
  </div>

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card critical">
      <div class="number">${summary.critical || 0}</div>
      <div class="label">Critical</div>
    </div>
    <div class="summary-card high">
      <div class="number">${summary.high || 0}</div>
      <div class="label">High</div>
    </div>
    <div class="summary-card medium">
      <div class="number">${summary.medium || 0}</div>
      <div class="label">Medium</div>
    </div>
    <div class="summary-card low">
      <div class="number">${summary.low || 0}</div>
      <div class="label">Low</div>
    </div>
  </div>

  <h2>Vulnerabilities (${summary.totalVulnerabilities || 0})</h2>
  ${vulns.map((v) => `
    <div class="vuln-card">
      <div class="vuln-header">
        <span class="vuln-type">${v.vulnerability_type || "Unknown"}</span>
        <div>
          <span class="badge severity-${v.severity}">${v.severity}</span>
          <span class="status-badge status-${v.status}">${v.status}</span>
        </div>
      </div>
      <p>${v.explanation || "No description available."}</p>
      ${v.filePath ? `<p style="margin-top:0.5rem; font-size:0.85rem; color:#666;">📁 ${v.filePath}</p>` : ""}
      ${v.vulnerable_code ? `<pre><code>${v.vulnerable_code}</code></pre>` : ""}
      ${v.fixed_code ? `<pre><code>✅ ${v.fixed_code}</code></pre>` : ""}
      ${v.pr_url ? `<p style="font-size:0.85rem;">🔗 <a href="${v.pr_url}" target="_blank">Pull Request</a></p>` : ""}
    </div>
  `).join("")}

  <div class="footer">
    <p>Generated by <strong>Krypta</strong> — AI-Powered Penetration Testing</p>
    <p class="no-print" style="margin-top:0.5rem;"><button onclick="window.print()" style="padding:0.5rem 1rem; background:#e34a32; color:white; border:none; border-radius:6px; cursor:pointer;">🖨️ Print / Save as PDF</button></p>
  </div>
</body>
</html>`;
}
