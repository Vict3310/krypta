import { createClient } from "@supabase/supabase-js";

// Use this ONLY in secure server environments (like webhooks or cron jobs)
// It bypasses RLS and has full access to the database
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or Service Role Key");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
