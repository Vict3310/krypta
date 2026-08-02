import { NextResponse } from "next/server";
import { SendByte } from "@sendbyte/node";
import { render } from "@react-email/render";
import SecurityAlertEmail from "@/emails/security-alert";

const FROM = "Krypta Security <hello@krypta.dev>";

export async function POST(req: Request) {
  const apiKey = process.env.SENDBYTE_API_KEY;

  if (!apiKey) {
    console.error("[Email] SENDBYTE_API_KEY not configured");
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  try {
    const { severity, vulnType, repoName, filePath, description, scanDate, to, dashboardUrl } =
      await req.json();

    if (!severity || !vulnType || !repoName || !to) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const url = dashboardUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/scans`;

    const html = await render(
      SecurityAlertEmail({ severity, vulnType, repoName, filePath: filePath || "N/A", description, scanDate: scanDate || new Date().toISOString(), dashboardUrl: url })
    );

    const sendbyte = new SendByte(apiKey);
    const { id } = await sendbyte.emails.send({
      from: FROM,
      to,
      subject: `[${severity}] ${vulnType} found in ${repoName}`,
      html,
      text: `Security Alert: ${severity} severity ${vulnType} found in ${repoName}\n\n${description}\n\nView in dashboard: ${url}`,
    });

    return NextResponse.json({ messageId: id });
  } catch (error) {
    console.error("[Email] Error:", (error as Error).message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
