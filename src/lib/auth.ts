import { createClient } from "@/utils/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Require an authenticated user via cookie session.
 * Uses getUser() (validates with Supabase Auth), never service-role getSession().
 */
export async function requireUser(): Promise<
  { user: User; error?: never } | { user?: never; error: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user };
}

/** Constant-time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Verify Bearer secret from Authorization header. */
export function verifyBearerSecret(
  request: Request,
  expected: string | undefined
): boolean {
  if (!expected) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), expected);
}
