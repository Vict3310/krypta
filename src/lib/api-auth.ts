/**
 * REST API Authentication
 * Validates API keys (SHA-256 hashed) and returns the owning user id.
 */
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import * as Sentry from "@sentry/nextjs";
import type { User } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/auth";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(request: Request): Promise<
  | { user: Pick<User, "id">; apiKey: { user_id: string; name: string; created_at: string }; error?: never; status?: never }
  | { error: string; status: number; user?: never; apiKey?: never }
> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid authorization header", status: 401 };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: "Invalid authorization format", status: 401 };
  }

  const supabase = createServiceRoleClient();
  const keyHash = hashApiKey(token);

  const { data, error: apiKeyError } = await supabase
    .from("api_keys")
    .select("user_id, name, created_at, key_hash")
    .eq("key_hash", keyHash)
    .limit(1);

  const apiKey = data?.[0];
  if (apiKeyError || !apiKey || !safeEqual(apiKey.key_hash, keyHash)) {
    if (apiKeyError) Sentry.captureException(apiKeyError);
    return { error: "Invalid API key", status: 401 };
  }

  // Touch last_used_at (best-effort)
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);

  return {
    user: { id: apiKey.user_id },
    apiKey: {
      user_id: apiKey.user_id,
      name: apiKey.name,
      created_at: apiKey.created_at,
    },
  };
}
