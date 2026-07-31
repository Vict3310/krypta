import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { startVerification } from "@/lib/verification";

/**
 * POST /api/verification/start
 *
 * Initiate ownership verification for a repository via DNS TXT or file upload.
 * Returns a challenge token that the user must prove control of.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { repositoryId, method, targetUrl } = body;

    if (!repositoryId || !method || !targetUrl) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, method, targetUrl" },
        { status: 400 }
      );
    }

    if (!["dns_txt", "file_upload"].includes(method)) {
      return NextResponse.json(
        { error: "Invalid verification method. Must be 'dns_txt' or 'file_upload'." },
        { status: 400 }
      );
    }

    // Verify the repository belongs to the user
    const db = await supabase
      .from("repositories")
      .select("id, owner_id")
      .eq("id", repositoryId)
      .eq("user_id", data.user.id)
      .single();

    if (!db.data) {
      return NextResponse.json(
        { error: "Repository not found or you don't have permission" },
        { status: 404 }
      );
    }

    const result = await startVerification(repositoryId, method);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to start verification" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: result.token,
      method,
      instructions:
        method === "dns_txt"
          ? `Add a TXT record at _krypta-verify.${new URL(targetUrl).hostname} with value "${result.token}"`
          : `Create a file at ${targetUrl}/.well-known/krypta-verification.txt with content "${result.token}"`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
