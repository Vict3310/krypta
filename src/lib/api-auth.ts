/**
 * REST API Authentication
 * Validates API keys (SHA-256 / HMAC-SHA256 hashed) and returns the owning user id.
 *
 * Hash scheme:
 * - New keys (when API_KEY_HASH_SECRET is set): "v2:<hmac-sha256>" — keyed hashing
 *   so a database leak alone is not enough to brute-force keys.
 * - Legacy keys: plain SHA-256 hex (accepted for backward compatibility).
 */
import { createHash, createHmac } from "node:crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import * as Sentry from "@sentry/nextjs";
import type { User } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/auth";

const V2_PREFIX = "v2:";

export function hashApiKey(key: string): string {
  const secret = process.env.API_KEY_HASH_SECRET;
  if (secret) {
    return `${V2_PREFIX}${createHmac("sha256", secret).update(key).digest("hex")}`;
  }
  return hashApiKeyLegacy(key);
}

function hashApiKeyLegacy(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(request: Request): Promise<
  | { user: Pick<User, "id">; apiKey: { id: string; user_id: string; name: string; created_at: string }; error?: never; status?: never }
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

  const secret = process.env.API_KEY_HASH_SECRET;
  const legacyHash = hashApiKeyLegacy(token);
  const v2Hash = secret
    ? `${V2_PREFIX}${createHmac("sha256", secret).update(token).digest("hex")}`
    : null;

  const supabase = createServiceRoleClient();

  // Match against either the current (v2) or legacy hash so existing keys keep working.
  const filter = v2Hash
    ? `key_hash.eq.${legacyHash},key_hash.eq.${v2Hash}`
    : `key_hash.eq.${legacyHash}`;

  const { data, error: apiKeyError } = await supabase
    .from("api_keys")
    .select("id, user_id, name, created_at, key_hash")
    .or(filter)
    .limit(1);

  const apiKey = data?.[0];
  const matches =
    apiKey &&
    (safeEqual(apiKey.key_hash, legacyHash) ||
      (v2Hash !== null && safeEqual(apiKey.key_hash, v2Hash)));

  if (apiKeyError || !apiKey || !matches) {
    if (apiKeyError) Sentry.captureException(apiKeyError);
    return { error: "Invalid API key", status: 401 };
  }

  // Touch last_used_at (best-effort)
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id);

  return {
    user: { id: apiKey.user_id },
    apiKey: {
      id: apiKey.id,
      user_id: apiKey.user_id,
      name: apiKey.name,
      created_at: apiKey.created_at,
    },
  };
}
