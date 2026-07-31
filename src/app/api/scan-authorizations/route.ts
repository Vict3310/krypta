import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

/**
 * POST /api/scan-authorizations
 *
 * Create a scan authorization (user confirms ownership/authorization
 * to scan a target). Returns 201 on success, 409 if already authorized.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { targetUrl, targetType, tosVersion } = body;

    if (!targetUrl || !targetType) {
      return NextResponse.json(
        { error: "Missing required fields: targetUrl, targetType" },
        { status: 400 }
      );
    }

    if (!["github_repo", "live_url"].includes(targetType)) {
      return NextResponse.json(
        { error: "Invalid targetType. Must be 'github_repo' or 'live_url'." },
        { status: 400 }
      );
    }

    const db = createServiceRoleClient();
    const tosVersionVal = tosVersion || "1.0";

    // Check for existing active authorization (not expired)
    const existing = await db
      .from("scan_authorizations")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("target_url", targetUrl)
      .eq("target_type", targetType)
      .is("expires_at", null)
      .or(`expires_at.gt.${new Date().toISOString()}`)
      .single();

    if (existing.data) {
      return NextResponse.json(
        { error: "Already authorized", authorizationId: existing.data.id },
        { status: 409 }
      );
    }

    // Create authorization with 90-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const { data: auth, error: authError } = await db
      .from("scan_authorizations")
      .insert({
        user_id: data.user.id,
        target_url: targetUrl,
        target_type: targetType,
        tos_version: tosVersionVal,
        authorized_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (authError || !auth) {
      return NextResponse.json(
        { error: "Failed to create scan authorization", details: authError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      authorization: auth,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
