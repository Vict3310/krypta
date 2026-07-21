import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    console.error("[Auth Callback] No code parameter in callback URL");
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] exchangeCodeForSession failed:", error.message, error.status);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    if (!data?.session) {
      console.error("[Auth Callback] No session returned from exchange");
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    console.log("[Auth Callback] Session established for user:", data.session.user.id);
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error("[Auth Callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
