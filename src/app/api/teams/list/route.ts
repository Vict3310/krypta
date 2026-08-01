/**
 * List User's Teams API
 * Returns all teams the authenticated user belongs to
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get("details") === "true";

    const supabase = createServiceRoleClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (includeDetails) {
      // Get teams with full details
      const { data: teams, error } = await supabase
        .from("teams")
        .select(`
          *,
          team_members!inner(role, joined_at),
          profiles!owner_id(full_name, avatar_url)
        `)
        .or(`team_members.user_id.eq.${sessionUser.id},owner_id.eq.${sessionUser.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return NextResponse.json(teams);
    }

    // Get basic team info
    const { data: teams, error } = await supabase
      .from("team_members")
      .select(`
        team_id,
        role,
        joined_at,
        teams!inner(name, slug, avatar_url, owner_id)
      `)
      .eq("user_id", sessionUser.id)
      .order("joined_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(teams);
  } catch (error) {
    console.error("List teams error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}
