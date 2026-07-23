import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getRecentScans } from "@/lib/db";
import { CheckCircle2, ShieldAlert, History as HistoryIcon, Clock, Shield } from "lucide-react";
import Link from "next/link";
import type { Scan } from "@/lib/types";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scans = await getRecentScans(user.id, 50);

  const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
    clean: { label: "Clean", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
    fixed: { label: "Fixed", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: CheckCircle2 },
    vulnerable: { label: "Open", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ShieldAlert },
    scanning: { label: "Scanning", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: Clock },
    pending: { label: "Pending", color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20", icon: Clock },
  };

  return (
    <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col min-h-screen">
      <header className="mt-4 mb-6 sm:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">Scan History</h1>
        <p className="text-gray-400 text-xs sm:text-sm">A complete log of all security scans across your repositories.</p>
      </header>

      <div className="bg-[#ffffff03] backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex-1">
        {scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 sm:px-6 text-center">
            <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mb-3 sm:mb-4" />
            <p className="text-white font-semibold text-base sm:text-lg mb-2">No scan history yet</p>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">Connect a repository to start automated security scanning.</p>
            <Link href="/dashboard/repositories/new" className="px-4 py-2 bg-emerald-500 text-black rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-400 transition-colors">
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px] sm:min-w-0">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Repository</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Branch</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scans.map((scan) => {
                  const cfg = statusConfig[scan.status] ?? statusConfig.pending;
                  const href = `/dashboard/scans/${scan.id}`;
                  const repoName = (scan as Scan & { repositories: { full_name: string } }).repositories?.full_name ?? "Unknown";
                  return (
                    <tr key={scan.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <Link href={href} className="inline-flex items-center group">
                          <HistoryIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-gray-500 group-hover:text-gray-400" />
                          <span className="text-xs sm:text-sm text-white font-medium group-hover:underline">{repoName}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <Link href={href} className="inline-block w-full">
                          <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                            <cfg.icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5" />
                            {cfg.label}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-gray-400">{scan.branch ?? "main"}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-gray-500">{new Date(scan.triggered_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
