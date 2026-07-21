import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const VulnerabilitySchema = z.object({
  hasVulnerability: z.boolean(),
  type: z.string().optional().describe("E.g., IDOR, SQL Injection, XSS"),
  severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  plainEnglishExplanation: z.string().optional().describe("A clear explanation of the issue and how it can be exploited."),
  fixedCode: z.string().optional().describe("The exact replacement code snippet that patches the vulnerability."),
});

export interface ScanRules {
  minSeverity?: "Low" | "Medium" | "High" | "Critical";
  includePaths?: string[];
  excludePaths?: string[];
  ignoredTypes?: string[];
}

const severityRank: Record<string, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

export async function scanCodeSnippet(code: string, filename: string, rules?: ScanRules) {
  try {
    const minSeverity = rules?.minSeverity ?? "Low";
    const includePaths = rules?.includePaths ?? [];
    const excludePaths = rules?.excludePaths ?? [];
    const ignoredTypes = rules?.ignoredTypes ?? [];

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

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: VulnerabilitySchema,
      system: `You are Krypta, an expert AI security researcher. Analyze the following code snippet for security vulnerabilities.
      If you find a vulnerability, explain it in plain English with zero false positives.
      Then, provide the exact fixed code to replace the vulnerable section.`,
      prompt: `File: ${filename}\n\nCode:\n${code}`,
    });

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
