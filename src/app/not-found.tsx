import Link from "next/link";
import { Zap, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 relative">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-emerald-500/10 to-orange-500/10 blur-[120px] rounded-full opacity-50"></div>
      </div>

      <div className="z-10 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] mb-8">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-8xl font-extrabold text-white tracking-tighter mb-4">404</h1>
        <p className="text-xl text-gray-400 mb-2">Page not found</p>
        <p className="text-gray-500 text-sm max-w-sm mb-10">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="flex items-center space-x-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        >
          <Home className="w-4 h-4" />
          <span>Go Home</span>
        </Link>
      </div>
    </main>
  );
}
