/**
 * REST API - API Keys Management
 * Create, list, and revoke API keys
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { randomBytes } from "crypto";

// GET /api/v1/api-keys - List API keys
export async function GET(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: apiKeys, error } = await supabase
      .from("api_keys")
      .select("id, name, created_at, last_used_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: apiKeys });
  } catch (error) {
    Sentry.captureException(error);
    console.error("List API keys error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST /api/v1/api-keys - Create new API key
export async function POST(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Generate API key
    const apiKey = `krypta_sk_${randomBytes(32).toString("hex")}`;
    const keyHash = btoa(apiKey); // In production, use SHA-256

    const { data: apiKeyRecord, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: auth.user.id,
        name,
        key_hash: keyHash,
      })
      .select("id, name, created_at")
      .single();

    if (error) throw error;

    // Return the full API key (only shown once)
    return NextResponse.json(
      {
        message: "API key created successfully",
        api_key: apiKey,
        key_info: apiKeyRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/api-keys/[id] - Revoke API key
export async function DELETE(request: Request, context: any) {
  try {
    const { id } = context.params;
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.user.id);

    if (error) throw error;

    return NextResponse.json({ message: "API key revoked" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
