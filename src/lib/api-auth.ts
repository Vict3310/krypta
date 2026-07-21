/**
 * REST API Authentication Middleware
 * Validates API keys and authenticates requests
 */
import { createServiceRoleClient } from "@/utils/supabase/service";
import * as Sentry from "@sentry/nextjs";

export async function validateApiKey(request: Request) {
  const supabase = createServiceRoleClient();
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return { error: "Missing authorization header", status: 401 };
  }

  // Support Bearer token format
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return { error: "Invalid authorization format", status: 401 };
  }

  // Validate API key
  const { data: apiKey, error: apiKeyError } = await supabase
    .from("api_keys")
    .select("user_id, name, created_at")
    .eq("key_hash", createHash(token))
    .single();

  if (apiKeyError || !apiKey) {
    Sentry.captureException(apiKeyError);
    return { error: "Invalid API key", status: 401 };
  }

  // Get session for the user
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { error: "User session not found", status: 401 };
  }

  return { user: session.user, apiKey };
}

// Simple hash function for API key comparison
function createHash(key: string): string {
  // In production, use proper hashing (SHA-256)
  return btoa(key);
}
