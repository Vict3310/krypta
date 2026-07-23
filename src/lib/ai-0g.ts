/**
 * 0G Compute AI Provider
 *
 * OpenAI-compatible router for Krypta's AI features.
 * Docs: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
 */
import { createOpenAI } from "@ai-sdk/openai";

const baseUrl = process.env.ZERO_GRAVITY_BASE_URL;
const apiKey = process.env.ZERO_GRAVITY_API_KEY;

if (!baseUrl || !apiKey) {
  throw new Error(
    "ZERO_GRAVITY_API_KEY and ZERO_GRAVITY_BASE_URL must be set in .env.local"
  );
}

export const zg = createOpenAI({
  name: "zero-gravity",
  baseURL: baseUrl,
  apiKey,
});

export function zgModel(modelId?: string) {
  const id = modelId ?? process.env.ZERO_GRAVITY_MODEL ?? "zai-org/GLM-5-FP8";
  return zg(id);
}
