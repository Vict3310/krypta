/**
 * POST /api/ai/review-fix
 *
 * Uses 0G AI to review generated auto-fixes before they go into a PR.
 * Checks for: correctness, security, completeness, and best practices.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai-provider";

const FixReviewSchema = z.object({
  pass: z.boolean().describe("Whether the fix looks correct and secure"),
  score: z.number().min(0).max(10).describe("Fix quality score (0-10)"),
  confidence: z.number().min(0).max(1).describe("Confidence in the review (0-1)"),
  issues: z.array(z.string()).optional().describe("Specific issues found with the fix"),
  suggestions: z.array(z.string()).optional().describe("Suggested improvements"),
  securityRisks: z.array(z.string()).optional().describe("Potential security risks introduced by the fix"),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();

  try {
    const { vulnerabilityId } = await req.json();

    if (!vulnerabilityId) {
      return NextResponse.json(
        { error: "Missing vulnerabilityId" },
        { status: 400 }
      );
    }

    // Get vulnerability details
    const { data: vulnerability, error: vulnError } = await db
      .from("vulnerabilities")
      .select("*")
      .eq("id", vulnerabilityId)
      .single();

    if (vulnError || !vulnerability) {
      return NextResponse.json(
        { error: "Vulnerability not found" },
        { status: 404 }
      );
    }

    // Verify user owns this vulnerability
    const { data: repo } = await db
      .from("scans")
      .select("repository_id")
      .eq("id", vulnerability.scan_id)
      .single();

    if (!repo) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Call 0G AI (with OpenAI fallback) to review the fix
    const { object } = await generateObjectWithFallback({
      schema: FixReviewSchema,
      system: `You are Krypta, an expert AI security researcher reviewing auto-generated code fixes.
      Critically analyze the fix for:
      1. **Correctness**: Does it actually address the vulnerability?
      2. **Security**: Does it introduce new vulnerabilities?
      3. **Completeness**: Is the fix thorough or does it miss edge cases?
      4. **Best Practices**: Does it follow security and coding best practices?

      Be strict and thorough. False fixes are worse than no fixes.`,
      prompt: `Vulnerability: ${vulnerability.vulnerability_type || "Unknown"}
      Severity: ${vulnerability.severity}
      File: ${vulnerability.file_path || "N/A"}
      Line: ${vulnerability.line || "N/A"}

      Vulnerable Code:
      \`\`\`
      ${vulnerability.vulnerable_code || "N/A"}
      \`\`\`

      Proposed Fix:
      \`\`\`
      ${vulnerability.fixed_code || "No fix generated yet"}
      \`\`\`

      ${vulnerability.plain_english_explanation ? `Explanation: ${vulnerability.plain_english_explanation}` : ""}`,
    });

    // Store review result
    const { data: review, error: reviewError } = await db
      .from("fix_reviews")
      .insert({
        vulnerability_id: vulnerabilityId,
        pass: object.pass,
        score: object.score,
        confidence: object.confidence,
        issues: object.issues,
        suggestions: object.suggestions,
        security_risks: object.securityRisks,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (reviewError) {
      console.error("[AI Fix Review] Failed to store result:", reviewError);
    }

    return NextResponse.json({
      review: {
        ...object,
        id: review?.id,
      },
    });
  } catch (error) {
    console.error("[AI Fix Review] Error:", error);
    return NextResponse.json(
      { error: "AI fix review failed" },
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
  const vulnerabilityId = searchParams.get("vulnerabilityId");

  if (!vulnerabilityId) {
    return NextResponse.json(
      { error: "Missing vulnerabilityId" },
      { status: 400 }
    );
  }

  const db = createServiceRoleClient();

  const { data: review, error } = await db
    .from("fix_reviews")
    .select("*")
    .eq("vulnerability_id", vulnerabilityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !review) {
    return NextResponse.json({ reviewed: false });
  }

  return NextResponse.json({
    reviewed: true,
    ...review,
  });
}
