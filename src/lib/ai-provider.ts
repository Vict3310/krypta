/**
 * Unified AI Provider with fallback
 *
 * Primary: 0G (Zero Gravity) Compute via OpenAI-compatible endpoint
 * Fallback: OpenAI (gpt-4o-mini or configured model)
 *
 * Falls back automatically when 0G fails (timeout, error, rate limit).
 */
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";

const zgBaseUrl = process.env.ZERO_GRAVITY_BASE_URL;
const zgApiKey = process.env.ZERO_GRAVITY_API_KEY;
const zgModelId = process.env.ZERO_GRAVITY_MODEL ?? "zai-org/GLM-5-FP8";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// Create 0G provider (may be undefined if not configured)
const zgProvider = zgBaseUrl && zgApiKey
  ? createOpenAI({
      name: "zero-gravity",
      baseURL: zgBaseUrl,
      apiKey: zgApiKey,
    })
  : null;

// Create OpenAI provider (may be undefined if not configured)
const openaiProvider = openaiApiKey
  ? createOpenAI({
      name: "openai",
      apiKey: openaiApiKey,
    })
  : null;

export function zgModel(modelId?: string) {
  const id = modelId ?? zgModelId;
  if (!zgProvider) {
    throw new Error(
      "0G provider not configured. Set ZERO_GRAVITY_BASE_URL and ZERO_GRAVITY_API_KEY."
    );
  }
  return zgProvider.languageModel(id);
}

/**
 * Get the best available AI model, preferring 0G.
 * Falls back to OpenAI if 0G is not configured.
 */
export function aiModel(modelId?: string) {
  const id = modelId ?? zgModelId;
  if (zgProvider) {
    return zgProvider.languageModel(id);
  }
  if (openaiProvider) {
    return openaiProvider.languageModel(openaiModelId);
  }
  throw new Error(
    "No AI provider configured. Set either:\n" +
    "  - ZERO_GRAVITY_BASE_URL + ZERO_GRAVITY_API_KEY\n" +
    "  - OPENAI_API_KEY"
  );
}

/**
 * Smart generateObject with automatic fallback from 0G → OpenAI.
 *
 * On failure from 0G, automatically retries with OpenAI.
 * On OpenAI failure, returns the error.
 *
 * Both calls are bounded by a timeout so a hung provider can't stall a
 * serverless function (default 60s — below the 60s Vercel function limit).
 */
const AI_CALL_TIMEOUT_MS = 60_000;

export async function generateObjectWithFallback<Z extends z.ZodType>({
  schema,
  system,
  prompt,
  modelId,
}: {
  schema: Z;
  system?: string;
  prompt: string;
  modelId?: string;
}) {
  const { generateObject: origGenerateObject } = await import("ai");

  try {
    // Try 0G first
    return await origGenerateObject({
      model: zgModel(modelId),
      schema,
      system,
      prompt,
      signal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn(
      "[AI Fallback] 0G failed, trying OpenAI:",
      (error as Error).message
    );

    if (!openaiProvider) {
      throw error; // No fallback available
    }

    // Retry with OpenAI
    return await origGenerateObject({
      model: openaiProvider.languageModel(openaiModelId),
      schema,
      system,
      prompt,
      signal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
    });
  }
}
