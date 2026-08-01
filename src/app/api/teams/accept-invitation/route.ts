/**
 * Accept Team Invitation API
 * Handles accepting team invitations via token
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized - please log in first" }, { status: 401 });
    }

    // Find valid invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("team_invitations")
      .select(`
        *,
        teams(name, slug)
      `)
      .eq("token", token)
      .eq("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", invitation.team_id)
      .eq("user_id", sessionUser.id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "You are already a member of this team" },
        { status: 409 }
      );
    }

    // Add user to team
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: invitation.team_id,
        user_id: sessionUser.id,
        role: invitation.role,
      });

    if (memberError) {
      Sentry.captureException(memberError);
      return NextResponse.json({ error: "Failed to join team" }, { status: 500 });
    }

    // Mark invitation as accepted
    await supabase
      .from("team_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return NextResponse.json({
      message: "Successfully joined team",
      team: invitation.teams,
      role: invitation.role,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Accept invitation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
