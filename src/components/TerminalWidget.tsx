"use client";

import { useEffect, useState, useRef } from "react";
import { Terminal } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

export function TerminalWidget() {
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] KRYPTA ENGINE ONLINE",
    "[SYSTEM] LISTENING FOR WEBHOOK EVENTS...",
  ]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Safety timeout: if Supabase doesn't connect in 3s, show static content
    const timeout = setTimeout(() => {
      setError(true);
      setConnected(true); // prevent spinner
    }, 3000);

    const supabase = createClient();
    const channel: RealtimeChannel = supabase
      .channel("realtime_terminal")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scans" },
        (payload) => {
          setLogs((prev) => [
            ...prev,
            `[SYSTEM] NEW SCAN ON ${payload.new.branch || "main"}`,
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vulnerabilities" },
        (payload) => {
          setLogs((prev) => [
            ...prev,
            `${payload.new.severity.toUpperCase()}: ${payload.new.vulnerability_type}`,
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vulnerabilities" },
        (payload) => {
          if (payload.new.status === "fixed") {
            setLogs((prev) => [
              ...prev,
              `FIX APPLIED: Patch committed via PR`,
            ]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scans" },
        (payload) => {
          if (payload.new.status === "clean") {
            setLogs((prev) => [...prev, `SCAN COMPLETE: Repository is secure.`]);
          } else if (payload.new.status === "vulnerable") {
            setLogs((prev) => [...prev, `SCAN COMPLETE: Review required.`]);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
          setConnected(true);
          clearTimeout(timeout);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-64 rounded-2xl border border-white/5 bg-[#171719] p-4 font-mono text-sm shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_20px_40px_-20px_rgba(23,23,25,0.8)] flex flex-col">
      <div className="flex items-center gap-2 text-white/40 mb-4 border-b border-white/5 pb-2">
        <Terminal className="h-3.5 w-3.5" />
        <span className="text-[10px] tracking-widest uppercase">Live Activity</span>
        {error && (
          <span className="ml-auto text-[10px] text-amber-400/60">demo mode</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar flex flex-col-reverse">
        {logs.map((log, i) => {
          const isFix = log.includes("✓ FIX APPLIED") || log.includes("✓ SCAN COMPLETE");
          const isAlert = log.includes("⚠") || log.match(/^(CRITICAL|HIGH):/);
          return (
            <div
              key={i}
              className={`flex items-start ${isFix
                ? "text-emerald-400 font-medium"
                : isAlert
                  ? "text-white/70"
                  : "text-white/40"
                }`}
            >
              <span className="mr-2 opacity-40 shrink-0">{">"}</span>
              <span className="truncate">{log}</span>
            </div>
          );
        })}
        {connected && !error && (
          <div className="flex items-start text-emerald-400">
            <span className="mr-2 opacity-40 shrink-0">{">"}</span>
            <span className="w-2 h-4 bg-emerald-400 animate-pulse mt-0.5" />
          </div>
        )}
        {error && (
          <div className="flex items-start text-white/30">
            <span className="mr-2 opacity-40 shrink-0">{">"}</span>
            <span>Waiting for scan events...</span>
          </div>
        )}
      </div>
    </div>
  );
}
