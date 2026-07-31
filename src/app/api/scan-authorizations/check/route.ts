import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

/**
 * GET /api/scan-authorizations/check?targetUrl=...&targetType=...
 *
 * Check if the current user has a valid (non-expired) authorization for a target.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("targetUrl");
  const targetType = searchParams.get("targetType");

  if (!targetUrl || !targetType) {
    return NextResponse.json(
      { error: "Missing query parameters: targetUrl, targetType" },
      { status: 400 }
    );
  }

  const db = createServiceRoleClient();

  const { data: auth, error } = await db
    .from("scan_authorizations")
    .select("id, tos_version, expires_at")
    .eq("user_id", data.user.id)
    .eq("target_url", targetUrl)
    .eq("target_type", targetType)
    .is("expires_at", null)
    .or(`expires_at.gt.${new Date().toISOString()}`)
    .order("authorized_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !auth) {
    return NextResponse.json({
      authorized: false,
      reason: "No valid authorization found for this target",
    });
  }

  return NextResponse.json({
    authorized: true,
    authorizationId: auth.id,
    tosVersion: auth.tos_version,
    expiresAt: auth.expires_at || "No expiry",
  });
}
