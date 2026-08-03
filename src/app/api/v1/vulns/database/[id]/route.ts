/**
 * REST API - Vulnerability database entry details
 * GET /api/v1/vulns/database/[id]
 * PATCH /api/v1/vulns/database/[id]
 * DELETE /api/v1/vulns/database/[id]
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServiceRoleClient();

    const { data: vuln, error } = await supabase
      .from("vulnerability_database")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !vuln) {
      return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
    }

    return NextResponse.json({ data: vuln });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get vulnerability error:", error);
    return NextResponse.json({ error: "Failed to fetch vulnerability" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { severity, status, notes } = body;

    const supabase = createServiceRoleClient();

    const { data: vuln, error } = await supabase
      .from("vulnerability_database")
      .update({
        severity: severity || undefined,
        status: status || undefined,
        notes: notes || undefined,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: vuln });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Update vulnerability error:", error);
    return NextResponse.json({ error: "Failed to update vulnerability" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("vulnerability_database")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Vulnerability removed" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Delete vulnerability error:", error);
    return NextResponse.json({ error: "Failed to delete vulnerability" }, { status: 500 });
  }
}
