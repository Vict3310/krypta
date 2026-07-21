"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Billing Error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          Failed to load billing information. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
