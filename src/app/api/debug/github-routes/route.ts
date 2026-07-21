import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGitHubUserRepositories } from "@/lib/github";

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "not authenticated" });
  }

  const githubLogin = (session.user.user_metadata as any)?.login;
  const githubUsername = session.user.email?.replace(/@github\.com$/i, "");

  let repos: any[] = [];
  let reposError: string | null = null;

  try {
    repos = await getGitHubUserRepositories(githubLogin || githubUsername || "");
  } catch (e) {
    reposError = (e as Error).message;
  }

  return NextResponse.json({
    userId: session.user.id,
    email: session.user.email,
    userMetadata: session.user.user_metadata,
    extractedGithubLogin: githubLogin,
    extractedGithubUsername: githubUsername,
    usernameUsed: githubLogin || githubUsername,
    repoCount: repos.length,
    repos: repos.map((r: any) => r.full_name),
    reposError,
    env: {
      hasGitHubAppKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
      hasGitHubAppId: !!process.env.GITHUB_APP_ID,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    },
  });
}
