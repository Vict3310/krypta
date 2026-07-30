/**
 * 0G Compute AI Provider
 *
 * OpenAI-compatible router for Krypta's AI features.
 * Docs: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
 *
 * NOTE: This module is lazy-loaded to avoid startup failures if env vars are missing.
 * For fallback logic, use ai-provider.ts instead.
 */
import { createOpenAI } from "@ai-sdk/openai";

let zgInstance: ReturnType<typeof createOpenAI> | null = null;

export function zgModel(modelId?: string) {
  const baseUrl = process.env.ZERO_GRAVITY_BASE_URL;
  const apiKey = process.env.ZERO_GRAVITY_API_KEY;
  const id = modelId ?? process.env.ZERO_GRAVITY_MODEL ?? "zai-org/GLM-5-FP8";

  if (!zgInstance) {
    if (!baseUrl || !apiKey) {
      throw new Error(
        "0G provider not configured. Set ZERO_GRAVITY_BASE_URL and ZERO_GRAVITY_API_KEY, or set OPENAI_API_KEY for fallback."
      );
    }
    zgInstance = createOpenAI({
      name: "zero-gravity",
      baseURL: baseUrl,
      apiKey,
    });
  }

  return zgInstance(id);
}
