"use client";

import { GitBranch, Plus, Search, ShieldCheck, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useState, useEffect } from "react";

interface Repo {
  githubRepoId: number;
  name: string;
  defaultBranch: string;
  isConnected: boolean;
}

export default function NewRepositoryPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setErrorMsg("Not authenticated");
          setLoading(false);
          return;
        }

        setUserEmail(session.user.email || null);
        setUserMetadata(session.user.user_metadata || null);
        console.log("[Page] Session loaded:", {
          userId: session.user.id,
          email: session.user.email,
          metadata: session.user.user_metadata,
        });

        // Try to get GitHub username from metadata
        const meta = session.user.user_metadata as any;
        const githubLogin = meta?.preferred_username || meta?.user_name || meta?.login || meta?.github_username;

        if (githubLogin) {
          setGithubUsername(githubLogin);
          console.log("[Page] GitHub username from metadata:", githubLogin);
        } else {
          const email = session.user.email?.replace(/@github\.com$/i, "");
          if (email && !email.includes("@")) {
            setGithubUsername(email);
            console.log("[Page] GitHub username from email:", email);
          } else {
            setErrorMsg("Could not determine your GitHub username.");
          }
        }

        // Load connected repos from DB
        const { data: dbRepos } = await supabase
          .from("repositories")
          .select("github_repo_id")
          .eq("user_id", session.user.id);
        console.log("[Page] DB-connected repos:", dbRepos?.map((r: any) => r.github_repo_id) || []);

        // Load GitHub repos
        if (githubLogin) {
          console.log("[Page] Fetching GitHub repos for:", githubLogin);
          const res = await fetch(`/api/github/repos?username=${encodeURIComponent(githubLogin)}`);
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`API returned ${res.status}: ${body}`);
          }
          const data = await res.json();
          console.log("[Page] GitHub API response:", data);

          // Map GitHub API fields to our interface
          const mapped = (data.repos || []).map((r: any) => ({
            githubRepoId: r.id,
            name: r.full_name,
            defaultBranch: r.default_branch,
            isConnected: false,
          }));
          setRepos(mapped);
        }
      } catch (e) {
        console.error("[Page] Load error:", e);
        setErrorMsg((e as Error).message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const connectRepo = async (repo: Repo) => {
    setIsConnecting(true);
    setConnectError(null);

    console.log("[Connect] Starting connect for:", repo.name, "id:", repo.githubRepoId, "branch:", repo.defaultBranch);

    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repo.name,
          githubRepoId: repo.githubRepoId,
          defaultBranch: repo.defaultBranch,
        }),
      });

      console.log("[Connect] Response status:", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("[Connect] Response body:", data);

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log("[Connect] Success! Re-fetching repo list...");
      setRepos((prev) =>
        prev.map((r) => (r.githubRepoId === repo.githubRepoId ? { ...r, isConnected: true } : r))
      );
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[Connect] Error:", msg);
      setConnectError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  if (loading) {
    return (
      <main className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64 text-sf-text-tertiary">Loading...</div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Debug info */}
      <details className="mb-6 rounded-xl border border-black/5 bg-black/[0.02] p-4">
        <summary className="text-sm font-medium text-sf-text-secondary cursor-pointer">Debug Info</summary>
        <div className="mt-3 space-y-2 text-xs font-mono">
          <p><strong>Email:</strong> {userEmail}</p>
          <p><strong>GitHub Username:</strong> {githubUsername}</p>
          <p><strong>Metadata:</strong> {JSON.stringify(userMetadata)}</p>
          <p><strong>Repos Loaded:</strong> {repos.length}</p>
        </div>
      </details>

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

        {connectError && (
          <div className="mb-6 flex items-center gap-3 rounded-full bg-red-50 border border-red-200 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-red-600 text-sm">{connectError}</p>
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
          {repos.map((repo) => (
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
                <button
                  onClick={() => connectRepo(repo)}
                  disabled={isConnecting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#171719] px-3 py-1.5 text-xs font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_18px_-10px_rgba(23,23,25,0.5)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          ))}
          {repos.length === 0 && !errorMsg && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-sf-text-tertiary">
                {githubUsername
                  ? `No repositories found for @${githubUsername}.`
                  : "Unable to determine your GitHub username."
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
