/**
 * Create Team API
 * Creates a new team/organization
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const { name, slug } = await req.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Missing required fields: name, slug" },
        { status: 400 }
      );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase alphanumeric with hyphens only" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if slug is already taken
    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Team slug already taken" },
        { status: 409 }
      );
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name,
        slug,
        owner_id: session.user.id,
      })
      .select()
      .single();

    if (teamError) {
      Sentry.captureException(teamError);
      return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
    }

    // Add owner as member
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: session.user.id,
        role: "owner",
      });

    if (memberError) {
      Sentry.captureException(memberError);
      // Rollback team creation
      await supabase.from("teams").delete().eq("id", team.id);
      return NextResponse.json({ error: "Failed to add owner to team" }, { status: 500 });
    }

    // Set as default team
    await supabase
      .from("profiles")
      .update({ default_team_id: team.id })
      .eq("id", session.user.id);

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Create team error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
