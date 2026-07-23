/**
 * POST /api/ai/triage
 *
 * Uses 0G AI to prioritize vulnerabilities by real-world exploit likelihood,
 * not just severity score. Returns a priority score and recommended remediation order.
 */
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { zgModel } from "@/lib/ai-0g";

const VulnerabilityTriageSchema = z.object({
  vulnerabilities: z.array(z.object({
    vulnerabilityId: z.string(),
    priorityScore: z.number().min(0).max(100).describe("Priority score (0-100), higher = more urgent"),
    reasoning: z.string().describe("Why this priority score was assigned"),
    exploitChain: z.string().optional().describe("How this could be chained with other vulns"),
    remediationOrder: z.number().min(1).describe("Where this should be in the remediation queue"),
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

    // Call 0G AI to triage
    const vulnContext = vulnerabilities.map((v: any, i: number) => `
${i + 1}. **${v.vulnerability_type || "Unknown"}** (${v.severity})
   File: ${v.file_path || "N/A"}
   Explanation: ${v.plain_english_explanation || "N/A"}
   Vulnerable Code: ${v.vulnerable_code ? `\`\`\`\n${v.vulnerable_code}\n\`\`\`` : "N/A"}`
    ).join("\n");

    const { object } = await generateObject({
      model: zgModel(),
      schema: VulnerabilityTriageSchema,
      system: `You are Krypta, an expert AI security researcher prioritizing vulnerabilities.
      Rank each vulnerability by REAL-WORLD EXPLOIT LIKELIHOOD, not just severity:
      
      Consider:
      - Is this in a user-facing endpoint? (higher priority)
      - Can it be exploited remotely? (higher priority)
      - Is the exploit chain short? (higher priority)
      - Are there common automated tools for this attack? (higher priority)
      - Does the vulnerable code handle user input? (higher priority)
      - Is this a well-known vulnerability class with existing PoCs? (higher priority)
      
      Assign priority scores (0-100) and remediation order (1 = first to fix).
      Be decisive — clear priorities are more useful than vague ones.`,
      prompt: `Scan ID: ${scanId}\n${vulnContext}`,
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
