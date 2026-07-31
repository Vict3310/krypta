import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyViaDnsTxt } from "@/lib/verification";

/**
 * POST /api/verification/dns-txt
 *
 * Verify ownership via DNS TXT record.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { repositoryId, targetUrl } = body;

    if (!repositoryId || !targetUrl) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, targetUrl" },
        { status: 400 }
      );
    }

    // Verify the repository belongs to the user
    const dbRepo = await supabase
      .from("repositories")
      .select("id")
      .eq("id", repositoryId)
      .eq("user_id", data.user.id)
      .single();

    if (!dbRepo.data) {
      return NextResponse.json(
        { error: "Repository not found or you don't have permission" },
        { status: 404 }
      );
    }

    const result = await verifyViaDnsTxt(repositoryId, targetUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "DNS TXT verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Repository verified via DNS TXT record",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
