import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiLimiter } from "@/lib/rate-limit";
import { sendSecurityAlert } from "@/lib/emails";
import { getClientIp } from "@/lib/security";

// POST /api/email/alert — Send a security alert email.
// Protected: the recipient must be the authenticated user's own email address.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { success: rateLimitOk } = await apiLimiter(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  if (!process.env.SENDBYTE_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  try {
    const { severity, vulnType, repoName, filePath, description, scanDate, to, dashboardUrl } =
      await req.json();

    if (!severity || !vulnType || !repoName || !to) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // No open relay — alerts may only be sent to the session user's own email.
    if (String(to).trim().toLowerCase() !== (auth.user.email ?? "").trim().toLowerCase()) {
      return NextResponse.json(
        { error: "You can only send alerts to your own email address" },
        { status: 403 }
      );
    }

    const url = dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL || ""}/dashboard/scans`;

    const messageId = await sendSecurityAlert({
      to: String(to),
      severity,
      vulnType,
      repoName,
      filePath,
      description,
      scanDate,
      dashboardUrl: url,
    });

    return NextResponse.json({ messageId });
  } catch (error) {
    console.error("[Email] Error:", (error as Error).message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
