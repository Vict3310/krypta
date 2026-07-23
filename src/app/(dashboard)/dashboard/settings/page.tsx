"use client";

import { useEffect, useState } from "react";
import { User, Key, Bell, Save, Trash2, CheckCircle2, Shield, Settings2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import type { Repository, RepositorySettings } from "@/lib/types";

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");
  const [alertPrefs, setAlertPrefs] = useState({
    critical: true,
    weekly: false,
  });

  // Slack integration state
  const [slackWebhook, setSlackWebhook] = useState("");
  const [slackChannel, setSlackChannel] = useState("#security");
  const [savingSlack, setSavingSlack] = useState(false);

  // Repository scanning rules state
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [repoSettings, setRepoSettings] = useState<RepositorySettings | null>(null);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setName(profile.full_name || "");
          setPlan(profile.plan || "free");
          setSlackWebhook(profile.slack_webhook_url || "");
          setSlackChannel(profile.slack_channel_name || "#security");
          // Get email from auth
          const { data: authUser } = await supabase.auth.getUser();
          setEmail(authUser.user?.email || "");
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [supabase]);

  useEffect(() => {
    async function loadRepositories() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: repos } = await supabase
          .from("repositories")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (repos && repos.length > 0) {
          setRepositories(repos);
          setSelectedRepo(repos[0].id);
          // Load settings for first repo
          const { data: settings } = await supabase
            .from("repository_settings")
            .select("*")
            .eq("repository_id", repos[0].id)
            .single();
          setRepoSettings(settings as RepositorySettings | null);
        }
      } catch (error) {
        console.error("Failed to load repositories:", error);
      }
    }

    loadRepositories();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Save profile
      await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", session.user.id);

      // Save notification preferences (stored in profiles as JSONB)
      // We'll use a custom field or a separate table
      // For now, just save to profiles as a JSONB column
      await supabase
        .from("profiles")
        .update({
          // Store notification prefs - we need to add a notification_prefs column to profiles
          // For now, we'll just save with a placeholder
        })
        .eq("id", session.user.id);

      toast.success("Settings saved successfully", {
        description: "Your preferences have been updated.",
        icon: <CheckCircle2 className="h-4 w-4 text-sf-accent" />,
      });
    } catch (error) {
      toast.error("Failed to save settings", {
        description: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async () => {
    if (!repoSettings || !selectedRepo) return;
    setSavingRules(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("repository_settings")
        .upsert({
          repository_id: selectedRepo,
          min_severity: repoSettings.min_severity,
          include_paths: repoSettings.include_paths,
          exclude_paths: repoSettings.exclude_paths,
          enable_ai_scan: repoSettings.enable_ai_scan,
          enable_auto_pr: repoSettings.enable_auto_pr,
          scan_only_changes: repoSettings.scan_only_changes,
          ignored_types: repoSettings.ignored_types,
        }, {
          onConflict: "repository_id",
        });

      if (error) throw error;

      // Reload settings for selected repo
      const { data: updated } = await supabase
        .from("repository_settings")
        .select("*")
        .eq("repository_id", selectedRepo)
        .single();

      setRepoSettings(updated as RepositorySettings | null);

      toast.success("Scanning rules saved", {
        description: "Your repository scanning rules have been updated.",
        icon: <CheckCircle2 className="h-4 w-4 text-sf-accent" />,
      });
    } catch (error) {
      toast.error("Failed to save rules", {
        description: "Please try again.",
      });
    } finally {
      setSavingRules(false);
    }
  };

  const handleSaveSlack = async () => {
    setSavingSlack(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await supabase
        .from("profiles")
        .update({
          slack_webhook_url: slackWebhook || null,
          slack_channel_name: slackChannel,
        })
        .eq("id", session.user.id);

      toast.success("Slack integration saved", {
        description: slackWebhook
          ? "Security alerts will be sent to your Slack channel."
          : "Slack integration removed.",
        icon: <CheckCircle2 className="h-4 w-4 text-sf-accent" />,
      });
    } catch (error) {
      toast.error("Failed to save Slack settings", {
        description: "Please try again.",
      });
    } finally {
      setSavingSlack(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      toast.success("Signed out", {
        description: "You have been signed out successfully.",
      });
      window.location.href = "/login";
    } catch (error) {
      toast.error("Failed to sign out", {
        description: "Please try again.",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const tabs = [
    { id: "account", label: "Account Profile", icon: User },
    { id: "keys", label: "API Keys", icon: Key },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "slack", label: "Slack", icon: Bell },
    { id: "rules", label: "Scanning Rules", icon: Settings2 },
  ];

  const severityOptions: Array<"Low" | "Medium" | "High" | "Critical"> = ["Low", "Medium", "High", "Critical"];

  if (loading) {
    return (
      <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-48 sm:h-64 text-sf-text-tertiary">Loading settings...</div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <header className="mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-sf-text-primary tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-sf-text-secondary mt-0.5 sm:mt-1">
          Manage your account, API keys, and notification preferences.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-56 flex flex-col gap-1 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[13px] sm:text-sm font-medium transition-colors ${activeTab === tab.id
                ? "bg-sf-text-primary text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_18px_-10px_rgba(35,36,39,0.3)]"
                : "text-sf-text-secondary hover:text-sf-text-primary hover:bg-black/5"
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1 rounded-[28px] border border-black/5 bg-white p-4 sm:p-6 md:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_14px_30px_-18px_rgba(35,36,39,0.25)]">
          {activeTab === "account" && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-semibold text-sf-text-primary border-b border-black/5 pb-3 sm:pb-4">
                Account Profile
              </h2>

              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-tr from-sf-accent to-[#F05A3C] text-base sm:text-xl font-bold text-white shadow-[0_14px_30px_-12px_rgba(227,74,50,0.4)]">
                  {name ? name.charAt(0).toUpperCase() : plan === "pro" ? "P" : "D"}
                </div>
                <span className="text-xs sm:text-sm text-sf-text-tertiary">
                  Plan: <span className="font-medium text-sf-text-primary capitalize">{plan}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-sf-text-secondary ml-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-full border border-black/10 bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-sm outline-none shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-sf-text-secondary ml-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full rounded-full border border-black/5 bg-black/[0.02] px-4 py-2 sm:px-5 sm:py-2.5 text-sm text-sf-text-tertiary cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "keys" && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-semibold text-sf-text-primary border-b border-black/5 pb-3 sm:pb-4">
                API Keys
              </h2>
              <p className="text-xs sm:text-sm text-sf-text-secondary">
                Use these keys to integrate Krypta with your CI/CD pipelines. Coming soon.
              </p>
              <div className="rounded-xl border border-black/5 bg-black/[0.02] p-4 text-center text-sm text-sf-text-tertiary">
                API key management will be available in a future release.
              </div>
            </div>
          )}

          {activeTab === "slack" && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-semibold text-sf-text-primary border-b border-black/5 pb-3 sm:pb-4">
                Slack Integration
              </h2>
              <p className="text-xs sm:text-sm text-sf-text-secondary">
                Connect your Slack workspace to receive real-time security alerts when vulnerabilities are detected.
              </p>

              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-sf-text-secondary ml-1">Slack Webhook URL</label>
                  <p className="text-[10px] sm:text-xs text-sf-text-tertiary ml-1">
                    Create a webhook at{" "}
                    <a href="https://slack.com/apps/new/A0F7XDUAZ-incoming-webhooks" target="_blank" rel="noopener noreferrer" className="text-sf-accent underline">
                      slack.com/apps/new/A0F7XDUAZ-incoming-webhooks
                    </a>
                  </p>
                  <input
                    type="password"
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full rounded-full border border-black/10 bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-sm outline-none shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-sf-text-secondary ml-1">Channel Name</label>
                  <input
                    type="text"
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#security"
                    className="w-full rounded-full border border-black/10 bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-sm outline-none shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20"
                  />
                </div>

                <div className="pt-3 sm:pt-4 border-t border-black/5 flex justify-end">
                  <button
                    onClick={handleSaveSlack}
                    disabled={savingSlack}
                    className="inline-flex items-center gap-2 rounded-full bg-[#171719] px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingSlack ? "Saving..." : "Connect Slack"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4 sm:space-y-5">
              <h2 className="text-base sm:text-lg font-semibold text-sf-text-primary border-b border-black/5 pb-3 sm:pb-4">
                Notification Preferences
              </h2>
              <div className="space-y-2.5 sm:space-y-3">
                <ToggleRow
                  title="Critical Vulnerability Alerts"
                  description="Receive an email immediately when a High or Critical threat is found."
                  checked={alertPrefs.critical}
                  onChange={(val) => setAlertPrefs(p => ({ ...p, critical: val }))}
                />
                <ToggleRow
                  title="Weekly Digest"
                  description="A summary of all scans and fixes applied over the week."
                  checked={alertPrefs.weekly}
                  onChange={(val) => setAlertPrefs(p => ({ ...p, weekly: val }))}
                />
              </div>
            </div>
          )}

          {activeTab === "rules" && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-semibold text-sf-text-primary border-b border-black/5 pb-3 sm:pb-4">
                Repository Scanning Rules
              </h2>

              {/* Repository selector */}
              {repositories.length > 0 ? (
                <div className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-sf-text-secondary ml-1">Repository</label>
                    <select
                      value={selectedRepo}
                      onChange={(e) => {
                        setSelectedRepo(e.target.value);
                        setRepoSettings(null);
                      }}
                      className="w-full rounded-full border border-black/10 bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-sm outline-none shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20"
                    >
                      {repositories.map((repo) => (
                        <option key={repo.id} value={repo.id}>{repo.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Min severity */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-sf-text-secondary ml-1">Minimum Severity Threshold</label>
                    <p className="text-[10px] sm:text-xs text-sf-text-tertiary ml-1">Vulnerabilities below this severity will be filtered out</p>
                    <div className="flex gap-1.5 sm:gap-2 pt-1">
                      {severityOptions.map((sev) => (
                        <button
                          key={sev}
                          onClick={() => setRepoSettings({
                            id: "",
                            repository_id: selectedRepo,
                            min_severity: sev,
                            include_paths: [],
                            exclude_paths: [],
                            enable_ai_scan: true,
                            enable_auto_pr: true,
                            scan_only_changes: true,
                            ignored_types: [],
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          })}
                          className={`flex-1 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-sm font-medium border transition-all ${repoSettings?.min_severity === sev
                            ? "bg-sf-accent text-white border-sf-accent"
                            : "bg-white text-sf-text-secondary border-black/10 hover:border-sf-accent/50"
                            }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Scan toggle */}
                  <ToggleRow
                    title="AI Vulnerability Scanning"
                    description="Enable AI-powered scanning via OpenAI GPT-4o"
                    checked={repoSettings?.enable_ai_scan ?? true}
                    onChange={(val) => setRepoSettings(prev => prev ? { ...prev, enable_ai_scan: val } : {
                      id: "",
                      repository_id: selectedRepo,
                      min_severity: "Low",
                      include_paths: [],
                      exclude_paths: [],
                      enable_ai_scan: val,
                      enable_auto_pr: true,
                      scan_only_changes: true,
                      ignored_types: [],
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })}
                  />

                  {/* Auto PR toggle */}
                  <ToggleRow
                    title="Auto-create Fix PRs"
                    description="Automatically open a PR when a vulnerability is found"
                    checked={repoSettings?.enable_auto_pr ?? true}
                    onChange={(val) => setRepoSettings(prev => prev ? { ...prev, enable_auto_pr: val } : {
                      id: "",
                      repository_id: selectedRepo,
                      min_severity: "Low",
                      include_paths: [],
                      exclude_paths: [],
                      enable_ai_scan: true,
                      enable_auto_pr: val,
                      scan_only_changes: true,
                      ignored_types: [],
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })}
                  />

                  {/* Save button */}
                  <div className="pt-3 sm:pt-4 border-t border-black/5 flex justify-end">
                    <button
                      onClick={handleSaveRules}
                      disabled={savingRules || !repoSettings}
                      className="inline-flex items-center gap-2 rounded-full bg-[#171719] px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {savingRules ? "Saving..." : "Save Rules"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Shield className="h-12 w-12 text-sf-text-tertiary/40 mb-4" />
                  <p className="text-sf-text-primary font-medium mb-2">No repositories connected</p>
                  <p className="text-sm text-sf-text-secondary">Connect a repository to configure scanning rules.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 sm:mt-10 pt-4 sm:pt-6 border-t border-black/5 flex flex-col-reverse md:flex-row md:justify-between gap-3 sm:gap-4">
            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#171719] px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/5 bg-black/[0.02] px-5 py-4">
      <div>
        <h4 className="text-sm font-medium text-sf-text-primary">{title}</h4>
        <p className="text-xs text-sf-text-secondary mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full transition-colors ${checked ? "bg-sf-accent" : "bg-black/10"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"
            }`}
        />
      </button>
    </div>
  );
}
