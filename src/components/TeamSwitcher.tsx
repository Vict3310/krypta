"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  ChevronDown,
  Plus,
  Settings,
  Loader2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Team, TeamMember } from "@/lib/types";
import Link from "next/link";

interface TeamSwitcherProps {
  currentTeamId?: string;
  onChange?: (teamId: string) => void;
}

export function TeamSwitcher({ currentTeamId, onChange }: TeamSwitcherProps) {
  const [teams, setTeams] = useState<Array<Team & { team_members: TeamMember[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/teams/list?details=true`);
      if (!response.ok) throw new Error("Failed to load teams");

      const data = await response.json();
      setTeams(data);

      // Set default team if none selected
      if (!currentTeamId && data.length > 0) {
        const defaultTeam = data.find((t: Team & { team_members: TeamMember[] }) => t.team_members?.[0]?.role === "owner");
        onChange?.(defaultTeam?.id || data[0].id);
      }
    } catch (error) {
      console.error("Failed to load teams:", error);
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, onChange, supabase]);

  const currentTeam = teams.find(t => t.id === currentTeamId) || teams[0];

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5">
        <Loader2 className="h-4 w-4 animate-spin text-sf-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors w-full text-left"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center">
          <Users className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sf-text-primary truncate">
            {currentTeam?.name || "My Team"}
          </p>
          <p className="text-xs text-sf-text-tertiary truncate">
            {currentTeam?.slug || "personal"}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-sf-text-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl border border-black/10 shadow-xl z-50 overflow-hidden">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-sf-text-tertiary uppercase tracking-wider">
                Your Teams
              </p>
              {teams.map((team: Team & { team_members: TeamMember[] }) => {
                const member = team.team_members?.[0];
                const isOwner = member?.role === "owner";
                return (
                  <button
                    key={team.id}
                    onClick={() => {
                      onChange?.(team.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${currentTeamId === team.id
                      ? "bg-sf-accent/10 text-sf-accent"
                      : "hover:bg-black/5 text-sf-text-primary"
                      }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sf-accent to-[#F05A3C] flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-xs text-sf-text-tertiary">@{team.slug}</p>
                    </div>
                    {isOwner && (
                      <span className="text-xs font-medium bg-sf-accent/10 text-sf-accent px-2 py-0.5 rounded-full">
                        Owner
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="border-t border-black/10 mt-2 pt-2">
                <Link
                  href="/dashboard/settings?tab=teams"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sf-text-secondary hover:bg-black/5 hover:text-sf-text-primary transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Manage Teams
                </Link>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // TODO: Open create team modal
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sf-accent hover:bg-sf-accent/5 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create New Team
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
