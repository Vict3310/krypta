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
    <main className="p-6 md:p-8 max-w-7xl mx-auto flex flex-col min-h-screen">
      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Scan History</h1>
        <p className="text-gray-400 text-sm">A complete log of all security scans across your repositories.</p>
      </header>

      <div className="bg-[#ffffff03] backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex-1">
        {scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <Shield className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-white font-semibold text-lg mb-2">No scan history yet</p>
            <p className="text-gray-400 text-sm mb-6">Connect a repository to start automated security scanning.</p>
            <Link href="/dashboard/repositories/new" className="px-4 py-2 bg-emerald-500 text-black rounded-xl text-sm font-bold hover:bg-emerald-400 transition-colors">
              Connect Repository
            </Link>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Repository</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scans.map((scan) => {
                const cfg = statusConfig[scan.status] ?? statusConfig.pending;
                return (
                  <Link key={scan.id} href={`/dashboard/scans/${scan.id}`} legacyBehavior>
                    <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <HistoryIcon className="w-4 h-4 mr-3 text-gray-500" />
                          <span className="text-sm text-white font-medium">{(scan as Scan & { repositories: { full_name: string } }).repositories?.full_name ?? "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3 mr-1.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">{scan.branch ?? "main"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(scan.triggered_at).toLocaleString()}</td>
                    </tr>
                  </Link>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
