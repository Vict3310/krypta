"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("API Error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[200px] p-8">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 text-sm mb-4">
          An error occurred while processing your request.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
