import { GitBranch, Plus, Search, ShieldCheck, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getGitHubUserRepositories } from "@/lib/github";
import { getUserRepositories } from "@/lib/db";
import { connectRepository } from "./actions";
import Link from "next/link";

export default async function NewRepositoryPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  let githubRepos: any[] = [];
  let dbRepos: any[] = [];
  let errorMsg: string | null = null;
  let githubUsername: string | null = null;

  if (session?.user) {
    dbRepos = await getUserRepositories(session.user.id);

    // Try to get GitHub username from metadata
    // Supabase GitHub OAuth stores: preferred_username (GitHub username), user_name, name
    const meta = session.user.user_metadata as any;
    const githubLogin = meta?.preferred_username || meta?.user_name || meta?.login || meta?.github_username;
    if (githubLogin) {
      githubUsername = githubLogin;
    } else {
      // Fall back to email only if it doesn't contain @ (raw GitHub OAuth email, not common)
      const email = session.user.email?.replace(/@github\.com$/i, "");
      if (email && !email.includes("@")) {
        githubUsername = email;
      } else {
        errorMsg = `Could not determine your GitHub username. Please sign in with GitHub.`;
      }
    }

    console.log("[NewRepositoryPage] githubUsername:", githubUsername, "userId:", session.user.id);
  }

  try {
    if (githubUsername) {
      githubRepos = await getGitHubUserRepositories(githubUsername);
    }
  } catch (e) {
    console.error(e);
    if (!errorMsg) {
      errorMsg = "Failed to fetch repositories from GitHub.";
    }
  }

  const dbRepoIds = new Set(dbRepos.map((r) => r.github_repo_id));

  const reposToDisplay = githubRepos.map((repo) => ({
    githubRepoId: repo.id,
    name: repo.full_name,
    defaultBranch: repo.default_branch,
    isConnected: dbRepoIds.has(repo.id),
  }));

  return (
    <main className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-sf-text-primary tracking-tight">
          Connect Repository
        </h1>
        <p className="text-sm text-sf-text-secondary mt-1">
          Select a GitHub repository to enable Krypta AI Security Scanning.
        </p>
        <p className="text-sm text-sf-text-tertiary mt-1">
          You must first{' '}
          <a
            href={`https://github.com/apps/krypta/installations/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sf-accent underline"
          >
            install the Krypta GitHub App
          </a>{' '}
          on your account, or manually connect a repository below.
        </p>
      </header>

      <div className="rounded-[28px] border border-black/5 bg-white p-6 md:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 rounded-full bg-red-50 border border-red-200 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-red-600 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Search & Sync */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-sf-text-tertiary" />
            <input
              type="text"
              placeholder="Search your repositories..."
              className="w-full rounded-full border border-black/10 bg-white pl-9 pr-4 py-3 text-sm outline-none placeholder:text-sf-text-tertiary shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20"
            />
          </div>
        </div>

        {/* Repo list */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {reposToDisplay.map((repo) => (
            <div
              key={repo.githubRepoId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-black/5 bg-black/[0.02] px-5 py-4 transition-colors hover:bg-black/[0.04]"
            >
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-sf-text-tertiary shrink-0" />
                <span className="text-sm font-medium text-sf-text-primary">
                  {repo.name}
                </span>
              </div>

              {repo.isConnected ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Scanning Enabled
                </div>
              ) : (
                <form action={connectRepository}>
                  <input
                    type="hidden"
                    name="repoFullName"
                    value={repo.name}
                  />
                  <input
                    type="hidden"
                    name="githubRepoId"
                    value={repo.githubRepoId}
                  />
                  <input
                    type="hidden"
                    name="defaultBranch"
                    value={repo.defaultBranch}
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#171719] px-3 py-1.5 text-xs font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_18px_-10px_rgba(23,23,25,0.5)] transition-all hover:-translate-y-0.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Connect
                  </button>
                </form>
              )}
            </div>
          ))}
          {reposToDisplay.length === 0 && !errorMsg && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-sf-text-tertiary">
                {githubUsername
                  ? `No repositories found for @${githubUsername}. This usually means the GitHub App isn't installed or your environment variables aren't configured. Install the Krypta GitHub App below, or connect a repository manually.`
                  : "Unable to determine your GitHub username. Please sign in with GitHub."
                }
              </p>
              <a
                href={`https://github.com/apps/krypta/installations/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#171719] px-5 py-3 text-sm font-medium text-white transition-all hover:-translate-y-0.5"
              >
                Install Krypta GitHub App
              </a>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 pt-6 border-t border-black/5 flex items-start gap-3 text-sm text-sf-text-secondary">
          <ShieldCheck className="h-5 w-5 text-sf-accent shrink-0 mt-0.5" />
          <p>
            Install the Krypta GitHub App on your GitHub account to enable automatic
            scanning on every push and pull request. We only request read access to
            your code and write access for opening PRs.
          </p>
        </div>
      </div>
    </main>
  );
}
