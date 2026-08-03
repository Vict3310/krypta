"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { recordAuthFailure } from "@/lib/security-monitor";
import { authLimiter } from "@/lib/rate-limit";

const getRequestIp = async (): Promise<string> => {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
};

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

export async function signInWithGitHub() {
  const ip = await getRequestIp();
  const { success } = await authLimiter(`github:${ip}`);
  if (!success) {
    redirect("/login?error=rate_limited");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback`,
      scopes: "repo read:user user:email",
    },
  });

  if (error) {
    console.error("[GitHub OAuth] Supabase OAuth error:", error.message);
    await recordAuthFailure(ip, null);
    redirect("/login?error=github_failed");
  }

  if (data.url) {
    console.log("[GitHub OAuth] Redirecting to GitHub:", data.url.split("?")[0]);
    redirect(data.url);
  }
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    redirect("/login?error=no_email");
  }

  // Rate limit magic-link sends by email + IP (prevents email bombing).
  const ip = await getRequestIp();
  const { success } = await authLimiter(`otp:${email.trim().toLowerCase()}:${ip}`);
  if (!success) {
    redirect("/login?error=rate_limited");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getBaseUrl()}/auth/callback`,
    },
  });

  if (error) {
    await recordAuthFailure(ip, null);
    redirect("/login?error=magic_link_failed");
  }

  redirect("/login?message=check_email");
}
