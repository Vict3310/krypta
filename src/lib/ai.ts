import { generateObjectWithFallback } from "./ai-provider";
import { generateObject } from "ai";
import { zgModel } from "./ai-0g";
import { z } from "zod";

const VulnerabilitySchema = z.object({
  hasVulnerability: z.boolean(),
  type: z.string().optional().describe("E.g., SQL Injection, XSS, hardcoded secret"),
  severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  confidence: z.number().min(0).max(1).describe("Your confidence in this finding (0-1). Must be >= 0.7 to report."),
  plainEnglishExplanation: z.string().optional().describe("A clear explanation of the issue, WHY it's exploitable, and HOW it can be exploited. Be specific about the attack vector."),
  fixedCode: z.string().optional().describe("The exact replacement code snippet that patches the vulnerability."),
});

export interface ScanRules {
  minSeverity?: "Low" | "Medium" | "High" | "Critical";
  includePaths?: string[];
  excludePaths?: string[];
  ignoredTypes?: string[];
  minConfidence?: number; // 0-1, default 0.8
}

const severityRank: Record<string, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

const CONFIDENCE_THRESHOLD = 0.75; // Minimum confidence to report a finding

export async function scanCodeSnippet(code: string, filename: string, rules?: ScanRules) {
  try {
    const minSeverity = rules?.minSeverity ?? "Low";
    const includePaths = rules?.includePaths ?? [];
    const excludePaths = rules?.excludePaths ?? [];
    const ignoredTypes = rules?.ignoredTypes ?? [];
    const minConfidence = rules?.minConfidence ?? CONFIDENCE_THRESHOLD;

    // Check path filters before scanning
    if (excludePaths.length > 0) {
      for (const pattern of excludePaths) {
        if (filename.includes(pattern)) {
          return {
            hasVulnerability: false,
            type: undefined,
            severity: undefined,
            plainEnglishExplanation: undefined,
            fixedCode: undefined,
          };
        }
      }
    }

    if (includePaths.length > 0) {
      const matchesInclude = includePaths.some(pattern => filename.includes(pattern));
      if (!matchesInclude) {
        return {
          hasVulnerability: false,
          type: undefined,
          severity: undefined,
          plainEnglishExplanation: undefined,
          fixedCode: undefined,
        };
      }
    }

    const { object } = await generateObjectWithFallback({
      schema: VulnerabilitySchema,
      system: `You are Krypta, an expert AI security researcher performing CODE ANALYSIS for vulnerability detection.

IMPORTANT RULES:
1. ONLY report vulnerabilities you are HIGHLY confident about (>= 75% confidence)
2. FALSE POSITIVES are worse than missing a vulnerability — be conservative
3. A real vulnerability must have a CLEAR attack vector and exploit path
4. Code patterns like console.log, eval usage, or hardcoded strings are NOT automatically vulnerabilities
5. Consider the context: a file named "test.ts" may intentionally contain dangerous patterns
6. For a vulnerability to be real:
   - There must be user-controlled input flowing into a sensitive operation (SQL, DOM, shell, etc.)
   - OR there must be a hardcoded secret/token/password in source code (not in env files)
   - OR there must be a misconfiguration that exposes sensitive data to attackers
7. If the code looks clean or you're uncertain, report hasVulnerability: false
8. Set confidence LOW if you're not sure — it's better to miss a finding than create noise.

When you DO find a vulnerability, explain it clearly so a developer understands the exact risk.`,
      prompt: `Analyze this file for real, exploitable security vulnerabilities:

File: ${filename}
Type: ${filename.endsWith('.ts') || filename.endsWith('.tsx') ? 'TypeScript' : filename.endsWith('.js') || filename.endsWith('.jsx') ? 'JavaScript' : 'Other'}

${code.length > 2000 ? `Note: Code is long (${code.length} chars). Focus on security-critical patterns like: SQL queries, user input handling, auth, file operations, API calls.` : ''}

Code:\n${code}`,
    });

    // Filter by confidence threshold
    if (object.confidence && object.confidence < minConfidence) {
      return {
        hasVulnerability: false,
        type: undefined,
        severity: undefined,
        plainEnglishExplanation: undefined,
        fixedCode: undefined,
      };
    }

    // Filter by ignored types
    if (ignoredTypes.length > 0 && object.type) {
      const isIgnored = ignoredTypes.some(
        (ignored) => object.type!.toLowerCase().includes(ignored.toLowerCase())
      );
      if (isIgnored) {
        return {
          hasVulnerability: false,
          type: undefined,
          severity: undefined,
          plainEnglishExplanation: undefined,
          fixedCode: undefined,
        };
      }
    }

    // Filter by severity threshold
    if (object.severity && severityRank[object.severity] < severityRank[minSeverity]) {
      return {
        hasVulnerability: false,
        type: undefined,
        severity: undefined,
        plainEnglishExplanation: undefined,
        fixedCode: undefined,
      };
    }

    return object;
  } catch (error) {
    console.error("AI Scan failed:", error);
    throw error;
  }
}