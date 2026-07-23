import Link from "next/link";
import { Zap, GitBranch, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { signInWithGitHub, signInWithMagicLink } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string };
}) {
  const message = searchParams?.message;
  const error = searchParams?.error;

  const errorMessages: Record<string, string> = {
    github_failed: "GitHub sign-in failed. Please try again.",
    magic_link_failed: "Could not send magic link. Please try again.",
    no_email: "Please enter a valid email address.",
    auth_failed: "Authentication failed. Please try again.",
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative">
      {/* Atmosphere blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 sm:-right-40 sm:-top-40 h-[200px] w-[200px] sm:h-[500px] sm:w-[500px] rounded-full bg-gradient-to-bl from-sf-accent/15 to-transparent blur-2xl sm:blur-3xl opacity-30 sm:opacity-50" />
        <div className="absolute -bottom-20 -left-20 sm:-bottom-40 sm:-left-40 h-[180px] w-[180px] sm:h-[400px] sm:w-[400px] rounded-full bg-gradient-to-tr from-[#F05A3C]/10 to-transparent blur-2xl sm:blur-3xl opacity-20 sm:opacity-40" />
      </div>

      <div className="z-10 w-full max-w-md px-2 sm:px-0">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-10">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C] shadow-[0_14px_36px_-12px_rgba(227,74,50,0.55)]">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-semibold text-sf-text-primary">Krypta</span>
        </Link>

        {/* Card */}
        <div className="rounded-[28px] border border-black/5 bg-white px-6 py-6 sm:px-8 sm:py-10 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_20px_50px_-30px_rgba(35,36,39,0.3)]">
          <h1 className="text-xl sm:text-2xl font-semibold text-sf-text-primary text-center">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-sf-text-secondary text-center mt-1.5 sm:mt-2">
            Sign in to access your dashboard and manage repository security.
          </p>

          {/* Feedback banners */}
          {error && (
            <div className="mt-6 flex items-center gap-3 rounded-full bg-red-50 border border-red-100 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-red-600 text-sm">{errorMessages[error] ?? "Something went wrong."}</p>
            </div>
          )}

          {message === "check_email" && (
            <div className="mt-6 flex items-center gap-3 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-emerald-600 text-sm">Magic link sent! Check your email.</p>
            </div>
          )}

          {/* GitHub OAuth */}
          <form className="mt-6" action={signInWithGitHub}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#171719] text-white py-3 sm:py-3.5 text-sm font-medium transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_28px_-12px_rgba(23,23,25,0.75)] hover:shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_20px_34px_-12px_rgba(23,23,25,0.85)]"
            >
              <GitBranch className="h-4.5 w-4.5" />
              Continue with GitHub
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 sm:my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-[10px] sm:text-xs text-sf-text-tertiary uppercase tracking-wider">or</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          {/* Magic Link */}
          <form className="space-y-3 sm:space-y-4" action={signInWithMagicLink}>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block sm:mb-1.5 text-[10px] sm:text-xs font-medium text-sf-text-secondary ml-1"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                className="w-full rounded-full border border-black/10 bg-white px-4 py-2.5 sm:px-5 sm:py-3 text-sm outline-none placeholder:text-sf-text-tertiary focus:border-sf-accent/50 focus:ring-2 focus:ring-sf-accent/20 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_8px_20px_-12px_rgba(35,36,39,0.25)] transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sf-text-primary py-3 sm:py-3.5 text-sm font-medium transition-all hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_10px_22px_-12px_rgba(35,36,39,0.3)] hover:shadow-[0_16px_30px_-12px_rgba(35,36,39,0.35)]"
            >
              <Mail className="h-4 w-4" />
              Send Magic Link
            </button>
          </form>

          <p className="mt-4 sm:mt-6 text-center text-[10px] sm:text-xs text-sf-text-tertiary">
            By signing in, you agree to our{" "}
            <a href="#" className="text-sf-text-secondary hover:text-sf-text-primary underline underline-offset-2">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-sf-text-secondary hover:text-sf-text-primary underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
