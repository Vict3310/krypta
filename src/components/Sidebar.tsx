"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Shield,
  Settings,
  Zap,
  History,
  Menu,
  X,
  CreditCard,
  Flame,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; picture?: string }; avatar_url?: string } | null>(null);

  const navLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/scans", icon: Shield, label: "Scans" },
    { href: "/dashboard/exploit-scans", icon: Flame, label: "Exploit Scans" },
    { href: "/dashboard/history", icon: History, label: "History" },
  ];

  const bottomLinks = [
    { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  ];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 rounded-full bg-sf-bg-primary text-sf-text-primary border border-black/10"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`w-64 h-screen bg-sf-bg-secondary border-r border-black/5 flex flex-col fixed left-0 top-0 z-40 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C]">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-sf-text-primary">Krypta</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              onClick={() => setIsOpen(false)}
              href={link.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-black/5 transition-colors"
            >
              <link.icon className="h-4.5 w-4.5" />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 space-y-1">
          {bottomLinks.map((link) => (
            <Link
              key={link.href}
              onClick={() => setIsOpen(false)}
              href={link.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-black/5 transition-colors"
            >
              <link.icon className="h-4.5 w-4.5" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* User profile */}
        {user && (
          <div className="p-4 border-t border-black/5">
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url || user.avatar_url ? (
                <img
                  src={user.user_metadata?.avatar_url || user.avatar_url}
                  alt="Profile"
                  className="h-9 w-9 rounded-full ring-2 ring-black/5 object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center text-white text-sm font-semibold ring-2 ring-black/5">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sf-text-primary truncate">
                  {user.email?.split("@")[0] ?? "User"}
                </p>
                <p className="text-xs text-sf-text-tertiary truncate">
                  {user.email ?? ""}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 bg-black/30 z-30"
        />
      )}
    </>
  );
}
