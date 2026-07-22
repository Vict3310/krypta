import { NextResponse } from "next/server";
import { getGitHubUserRepositories } from "@/lib/github";

export async function GET(request: Request) {
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
    const msg = (e as Error).message;
    console.error("[API /github/repos] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
