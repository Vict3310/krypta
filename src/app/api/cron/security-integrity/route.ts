import { NextResponse } from "next/server";
import { verifyBearerSecret } from "@/lib/auth";
import { runIntegrityMonitor } from "@/lib/security-monitor";

export async function POST(req: Request) {
  if (!verifyBearerSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await runIntegrityMonitor();
  return NextResponse.json({ ok });
}
