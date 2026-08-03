import { NextResponse } from "next/server";
import { getGitHubUserRepositories } from "@/lib/github";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Missing username parameter" }, { status: 400 });
  }

  console.log("[API /github/repos] Fetching repos for:", username);

  try {
    const repos = await getGitHubUserRepositories(username);
    console.log("[API /github/repos] Found", repos.length, "repos");
    return NextResponse.json({ repos });
  } catch (e) {
    console.error("[API /github/repos] Error:", (e as Error).message);
    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 });
  }
}
