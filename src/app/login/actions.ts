"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { recordAuthFailure } from "@/lib/security-monitor";

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

export async function signInWithGitHub() {
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
    await recordAuthFailure("unknown", null);
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

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getBaseUrl()}/auth/callback`,
    },
  });

  if (error) {
    await recordAuthFailure("unknown", null);
    redirect("/login?error=magic_link_failed");
  }

  redirect("/login?message=check_email");
}
