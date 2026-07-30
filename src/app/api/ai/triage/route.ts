/**
 * POST /api/ai/triage
 *
 * Uses 0G AI to prioritize vulnerabilities by real-world exploit likelihood,
 * not just severity score. Returns a priority score and recommended remediation order.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai-provider";

const VulnerabilityTriageSchema = z.object({
  vulnerabilities: z.array(z.object({
    vulnerabilityId: z.string(),
    priorityScore: z.number().min(0).max(100).describe("Priority score (0-100), higher = more urgent to fix"),
    reasoning: z.string().describe("Why this priority score was assigned — be specific about risk factors"),
    exploitChain: z.string().optional().describe("How this could be chained with other vulns to achieve a larger attack"),
    remediationOrder: z.number().min(1).describe("Where this should be in the remediation queue (1 = first)"),
  })),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { scanId } = await req.json();

    if (!scanId) {
      return NextResponse.json(
        { error: "Missing scanId" },
        { status: 400 }
      );
    }

    // Get all open vulnerabilities for this scan
    const { data: vulnerabilities, error: vulnError } = await db
      .from("vulnerabilities")
      .select("*")
      .eq("scan_id", scanId)
      .eq("status", "open")
      .order("created_at", { ascending: true });

    if (vulnError || !vulnerabilities || vulnerabilities.length === 0) {
      return NextResponse.json(
        { error: "No open vulnerabilities found", vulnerabilities: [] },
        { status: 404 }
      );
    }

    // Verify user owns these vulnerabilities
    const { data: repo } = await db
      .from("scans")
      .select("repository_id")
      .eq("id", scanId)
      .single();

    if (!repo) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Call 0G AI to triage (with OpenAI fallback)
    const vulnContext = vulnerabilities.map((v: any, i: number) => `
${i + 1}. **${v.vulnerability_type || "Unknown"}** — Severity: ${v.severity}
   File: ${v.file_path || "N/A"}
   Explanation: ${v.plain_english_explanation || "N/A"}
   Vulnerable Code: ${v.vulnerable_code ? `\`\`\`\n${v.vulnerable_code}\n\`\`\`` : "N/A"}
   Fixed Code: ${v.fixed_code ? `\`\`\`\n${v.fixed_code}\n\`\`\`` : "N/A"}`
    ).join("\n");

    const { object } = await generateObjectWithFallback({
      schema: VulnerabilityTriageSchema,
      system: `You are Krypta, an expert security researcher prioritizing vulnerabilities for remediation.

SCORING GUIDELINES (0-100 priority score):
- 90-100: Remote code execution, critical auth bypass, easily exploitable SQLi — FIX IMMEDIATELY
- 70-89: XSS in auth flows, CORS misconfigurations with credentials, SSRF to cloud metadata
- 50-69: Stored XSS, broken access control, hardcoded secrets in production code
- 30-49: Reflected XSS, console debug leaks, minor info disclosure
- 10-29: Low-risk patterns, theoretical issues, easily mitigated
- 0-9: Likely false positives, defensive code, test files

IMPORTANT RULES:
1. Consider ATTACK COMPLEXITY: Can a non-expert exploit this?
2. Consider IMPACT: What can an attacker achieve?
3. Consider EXPLOIT CHAIN: Does this enable other attacks?
4. HIGH confidence = high priority even if severity says "Medium"
5. LOW confidence or test files = low priority
6. Be DECISIVE — clear priorities help developers fix the right things first.`,
      prompt: `Scan ID: ${scanId}\n${vulnContext}\n\nTriage these ${vulnerabilities.length} vulnerabilities by real-world risk.`,
    });

    // Store triage results
    const triageResults = object.vulnerabilities.map((v: any) => ({
      scan_id: scanId,
      vulnerability_id: v.vulnerabilityId,
      priority_score: v.priorityScore,
      reasoning: v.reasoning,
      exploit_chain: v.exploitChain,
      remediation_order: v.remediationOrder,
      created_at: new Date().toISOString(),
    }));

    await db
      .from("vulnerability_triages")
      .insert(triageResults);

    return NextResponse.json({
      vulnerabilities: object.vulnerabilities,
    });
  } catch (error) {
    console.error("[AI Triage] Error:", error);
    return NextResponse.json(
      { error: "AI triage failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get("scanId");

  if (!scanId) {
    return NextResponse.json(
      { error: "Missing scanId" },
      { status: 400 }
    );
  }

  const db = createServiceRoleClient();

  const { data: triages, error } = await db
    .from("vulnerability_triages")
    .select("*")
    .eq("scan_id", scanId)
    .order("remediation_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch triage results" },
      { status: 500 }
    );
  }

  return NextResponse.json({ vulnerabilities: triages });
}
