"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            An unexpected error occurred. Our team has been notified. If this keeps happening, please contact support.
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
