import { NextResponse } from "next/server";
import { Resend } from "resend";
import SecurityAlertEmail from "@/emails/security-alert";

// POST /api/email/alert — Send security alert email
export async function POST(req: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("[Email] RESEND_API_KEY not configured");
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 503 }
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    const { severity, vulnType, repoName, filePath, description, scanDate, to, dashboardUrl } =
      await req.json();

    if (!severity || !vulnType || !repoName || !to) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build dashboard URL for this vulnerability
    const url = dashboardUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/scans`;

    const { data, error } = await resend.emails.send({
      from: "Krypta Security <alerts@krypta.app>",
      to: [to],
      subject: `[${severity}] ${vulnType} found in ${repoName}`,
      react: SecurityAlertEmail({
        severity,
        vulnType,
        repoName,
        filePath: filePath || "N/A",
        description,
        scanDate: scanDate || new Date().toISOString(),
        dashboardUrl: url,
      }),
      text: `Security Alert: ${severity} severity ${vulnType} found in ${repoName}\n\n${description}\n\nView in dashboard: ${url}`,
    });

    if (error) {
      console.error("[Email] Failed to send:", error.message);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messageId: data?.id });
  } catch (error) {
    console.error("[Email] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
