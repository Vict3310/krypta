/**
 * Team Members API
 * Manage team members: list, invite, remove, update roles
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { randomUUID } from "crypto";

// GET - List team members
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a member
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 });
    }

    // Get members with user details
    const { data: members, error } = await supabase
      .from("team_members")
      .select(`
        *,
        profiles!user_id(full_name, avatar_url, email)
      `)
      .eq("team_id", teamId);

    if (error) throw error;

    return NextResponse.json(members);
  } catch (error) {
    console.error("List members error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

// POST - Invite member
export async function POST(request: Request) {
  try {
    const { teamId, email, role } = await request.json();

    if (!teamId || !email || !role) {
      return NextResponse.json(
        { error: "Missing required fields: teamId, email, role" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["admin", "developer", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can invite (owner or admin)
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Generate invitation token
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("team_invitations")
      .insert({
        team_id: teamId,
        email,
        role,
        invited_by: session.user.id,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (inviteError) {
      Sentry.captureException(inviteError);
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }

    // TODO: Send email invitation (integrate with Resend)
    console.log(`Invitation sent to ${email} for team ${teamId}`);

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Invite member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Remove member
export async function DELETE(request: Request) {
  try {
    const { teamId, userId } = await request.json();

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: teamId, userId" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can remove (owner or admin)
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Can't remove owner from team
    const { data: memberToRemove } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    if (memberToRemove?.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove team owner" },
        { status: 400 }
      );
    }

    // Remove member
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ message: "Member removed" });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
