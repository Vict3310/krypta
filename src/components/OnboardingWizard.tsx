"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  ArrowRight,
  GitBranch,
  Users,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface OnboardingWizardProps {
  userId: string;
}

type OnboardingStep = "welcome" | "github" | "team" | "customize" | "complete";

interface OnboardingData {
  githubConnected: boolean;
  teamCreated: boolean;
  firstScanCompleted: boolean;
  profileComplete: boolean;
}

export default function OnboardingWizard({ userId }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    githubConnected: false,
    teamCreated: false,
    firstScanCompleted: false,
    profileComplete: false,
  });
  const supabase = createClient();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .single();

      setOnboardingData((prev) => ({
        ...prev,
        profileComplete: !!profile?.full_name,
      }));
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    }
  }, [userId, supabase]);

  const steps = [
    {
      id: "welcome" as OnboardingStep,
      title: "Welcome to Krypta",
      description: "Let's get your security scanning set up",
      icon: Zap,
    },
    {
      id: "github" as OnboardingStep,
      title: "Connect GitHub",
      description: "Connect your repository",
      icon: GitBranch,
    },
    {
      id: "team" as OnboardingStep,
      title: "Team Setup",
      description: "Configure your team (optional)",
      icon: Users,
    },
    {
      id: "customize" as OnboardingStep,
      title: "Customize Scans",
      description: "Fine-tune your security settings",
      icon: Shield,
    },
    {
      id: "complete" as OnboardingStep,
      title: "You're All Set!",
      description: "Start scanning your code",
      icon: CheckCircle2,
    },
  ];

  function isStepComplete(step: OnboardingStep): boolean {
    switch (step) {
      case "welcome":
        return true;
      case "github":
        return onboardingData.githubConnected;
      case "team":
        return onboardingData.teamCreated;
      case "customize":
        return onboardingData.firstScanCompleted;
      case "complete":
        return true;
      default:
        return false;
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-black/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <span className="font-semibold text-sf-text-primary">Krypta</span>
            </a>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            >
              Skip to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-black/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isComplete = isStepComplete(step.id);
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${isComplete
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-sf-accent text-white"
                          : "bg-black/10 text-sf-text-tertiary"
                        }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <p
                      className={`mt-2 text-xs text-center ${isCurrent ? "font-medium text-sf-text-primary" : "text-sf-text-tertiary"
                        }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 w-12 ${isComplete ? "bg-green-500" : "bg-black/10"
                        }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {currentStep === "welcome" && (
            <WelcomeStep onComplete={() => setCurrentStep("github")} />
          )}
          {currentStep === "github" && (
            <GitHubStep
              onComplete={() =>
                setOnboardingData((prev) => ({
                  ...prev,
                  githubConnected: true,
                }))
              }
              onNext={() => setCurrentStep("team")}
            />
          )}
          {currentStep === "team" && (
            <TeamStep
              onComplete={() =>
                setOnboardingData((prev) => ({
                  ...prev,
                  teamCreated: true,
                }))
              }
              onSkip={() => setCurrentStep("customize")}
            />
          )}
          {currentStep === "customize" && (
            <CustomizeStep
              onComplete={() => setCurrentStep("complete")}
            />
          )}
          {currentStep === "complete" && (
            <CompleteStep />
          )}
        </div>
      </main>
    </div>
  );
}

function WelcomeStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center mx-auto">
          <Zap className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-sf-text-primary">
          Welcome to Krypta!
        </h1>
        <p className="text-lg text-sf-text-secondary max-w-md mx-auto">
          AI-powered security scanning that helps you find and fix vulnerabilities
          before they reach production.
        </p>
      </div>

      <div className="grid gap-4 text-left">
        {[
          {
            title: "Automatic Scanning",
            description: "Scans your code on every push and pull request",
          },
          {
            title: "AI-Powered Insights",
            description: "Plain-English explanations of security issues",
          },
          {
            title: "Auto-Fix Suggestions",
            description: "Get code suggestions to fix vulnerabilities",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="p-4 bg-white rounded-lg border border-black/10"
          >
            <h3 className="font-medium text-sf-text-primary">
              {feature.title}
            </h3>
            <p className="text-sm text-sf-text-secondary">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Let's Get Started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function GitHubStep({
  onComplete,
  onNext,
}: {
  onComplete: () => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleGitHubConnect() {
    setLoading(true);
    try {
      // Redirect to GitHub OAuth
      const redirectURL = `${window.location.origin}/auth/callback`;
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${redirectURL}&scope=repo`;
    } catch (error) {
      console.error("GitHub OAuth error:", error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <GitBranch className="h-12 w-12 text-black" />
        <h2 className="text-2xl font-bold text-sf-text-primary">
          Connect Your GitHub Account
        </h2>
        <p className="text-sf-text-secondary">
          Link your GitHub repository to start scanning for vulnerabilities.
        </p>
      </div>

      <div className="space-y-3">
        {[
          "Read-only access to your repositories",
          "Webhook configuration for automatic scans",
          "Pull request annotations",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-sm text-sf-text-secondary">{item}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={handleGitHubConnect}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <GitBranch className="h-5 w-5" />
              Connect with GitHub
            </>
          )}
        </button>

        <button
          onClick={onNext}
          className="w-full px-6 py-3 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}

function TeamStep({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleCreateTeam() {
    if (!teamName.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() }),
      });

      if (!response.ok) throw new Error("Failed to create team");

      onComplete();
    } catch (error) {
      console.error("Create team error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Users className="h-12 w-12 text-sf-accent" />
        <h2 className="text-2xl font-bold text-sf-text-primary">
          Set Up Your Team
        </h2>
        <p className="text-sf-text-secondary">
          Collaborate with your team to secure your codebase together.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="teamName"
            className="block text-sm font-medium text-sf-text-primary mb-2"
          >
            Team Name
          </label>
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., Engineering Team"
            className="w-full px-4 py-2 border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-sf-accent focus:border-transparent"
          />
        </div>

        <div className="grid gap-3 text-left">
          {[
            { title: "Shared Scans", description: "View and manage scans together" },
            { title: "Role-Based Access", description: "Control who can do what" },
            { title: "Team Invitations", description: "Invite members via email" },
          ].map((item) => (
            <div
              key={item.title}
              className="p-3 bg-black/5 rounded-lg"
            >
              <h4 className="font-medium text-sm text-sf-text-primary">
                {item.title}
              </h4>
              <p className="text-xs text-sf-text-secondary">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleCreateTeam}
          disabled={!teamName.trim() || loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create Team
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <button
          onClick={onSkip}
          className="w-full px-6 py-3 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
        >
          Skip - I'll set this up later
        </button>
      </div>
    </div>
  );
}

function CustomizeStep({ onComplete }: { onComplete: () => void }) {
  const [minSeverity, setMinSeverity] = useState<"Low" | "Medium" | "High" | "Critical">(
    "Medium"
  );
  const [enableAI, setEnableAI] = useState(true);
  const [enableAutoPR, setEnableAutoPR] = useState(false);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Shield className="h-12 w-12 text-sf-accent" />
        <h2 className="text-2xl font-bold text-sf-text-primary">
          Customize Your Scans
        </h2>
        <p className="text-sf-text-secondary">
          Fine-tune how Krypta scans your code.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-sf-text-primary mb-3">
            Minimum Severity Level
          </label>
          <div className="grid gap-2">
            {(["Low", "Medium", "High", "Critical"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setMinSeverity(level)}
                className={`p-3 border rounded-lg text-left transition-colors ${minSeverity === level
                  ? "border-sf-accent bg-sf-accent/5"
                  : "border-black/20 hover:border-black/40"
                  }`}
              >
                <span className="font-medium text-sf-text-primary">{level}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-sf-text-primary">
                AI-Powered Scanning
              </p>
              <p className="text-sm text-sf-text-secondary">
                Use AI for deeper vulnerability analysis
              </p>
            </div>
            <input
              type="checkbox"
              checked={enableAI}
              onChange={(e) => setEnableAI(e.target.checked)}
              className="h-5 w-5 rounded border-black/20 text-sf-accent focus:ring-sf-accent"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-sf-text-primary">
                Auto-Create Pull Requests
              </p>
              <p className="text-sm text-sf-text-secondary">
                Automatically create PRs with security fixes
              </p>
            </div>
            <input
              type="checkbox"
              checked={enableAutoPR}
              onChange={(e) => setEnableAutoPR(e.target.checked)}
              className="h-5 w-5 rounded border-black/20 text-sf-accent focus:ring-sf-accent"
            />
          </label>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Finish Setup
        <CheckCircle2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function CompleteStep() {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <div className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-sf-text-primary">
          You're All Set!
        </h1>
        <p className="text-lg text-sf-text-secondary max-w-md mx-auto">
          Krypta is now monitoring your repositories. Check your dashboard to
          view scan results.
        </p>
      </div>

      <div className="space-y-3">
        <a
          href="/dashboard"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sf-accent to-[#F05A3C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="/docs"
          className="w-full block px-6 py-3 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors text-center"
        >
          View Documentation
        </a>
      </div>
    </div>
  );
}
