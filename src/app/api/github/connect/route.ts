import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyViaGitHubApp } from "@/lib/verification";

export async function POST(request: Request) {
  console.log("[API /github/connect] === Connect endpoint started ===");

  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !data?.user) {
    console.error("[API /github/connect] Not authenticated:", sessionError?.message);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = data.user;

  console.log("[API /github/connect] Authenticated user:", {
    userId: user.id,
    email: user.email,
  });

  try {
    const body = await request.json();
    const { repoFullName, githubRepoId, defaultBranch } = body;

    console.log("[API /github/connect] Request body:", { repoFullName, githubRepoId, defaultBranch });

    if (!repoFullName || !githubRepoId || !defaultBranch) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [owner, repoName] = repoFullName.split("/");
    console.log("[API /github/connect] Parsed owner:", owner, "repo:", repoName);

    // Insert into DB
    const { data, error: insertError } = await supabase
      .from("repositories")
      .insert({
        user_id: user.id,
        github_repo_id: githubRepoId,
        full_name: repoFullName,
        default_branch: defaultBranch,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[API /github/connect] DB insert error:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
      });

      // If duplicate key, the repo is already connected — just return it
      if (insertError.code === "23505") {
        console.log("[API /github/connect] Repo already connected");
        return NextResponse.json({ message: "Already connected", repo: data });
      }

      return NextResponse.json(
        { error: "Failed to save repository", details: insertError.message },
        { status: 500 }
      );
    }

    console.log("[API /github/connect] ✅ Repository connected:", {
      id: data.id,
      full_name: data.full_name,
      user_id: data.user_id,
    });

    // Auto-verify via GitHub App — installing the GitHub App on a repo
    // already proves the user has admin access to it.
    const verificationResult = await verifyViaGitHubApp(data.id);
    if (verificationResult.success) {
      console.log("[API /github/connect] ✅ Auto-verified via GitHub App:", data.id);
    } else {
      console.warn("[API /github/connect] ⚠️ Verification failed (non-fatal):", verificationResult.error);
    }

    return NextResponse.json({
      message: "Repository connected successfully",
      repo: data,
    });
  } catch (e) {
    console.error("[API /github/connect] Unexpected error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
