import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock');

export async function sendCriticalVulnerabilityEmail(
  userEmail: string,
  repoName: string,
  vulnerabilityType: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Krypta Security <security@krypta.dev>',
      to: [userEmail],
      subject: `🚨 Critical Vulnerability Detected in ${repoName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 40px; border-radius: 12px; border: 1px solid #333;">
          <h2 style="color: #ef4444; margin-bottom: 20px;">Critical Vulnerability Alert</h2>
          <p style="color: #a1a1aa; font-size: 16px; line-height: 1.5;">
            Krypta's AI Engine has detected a <strong>${vulnerabilityType}</strong> in your repository <strong>${repoName}</strong>.
          </p>
          <p style="color: #a1a1aa; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            We have generated a plain-English explanation and automatically created a Pull Request with the fix.
          </p>
          <a href="https://krypta.dev/dashboard/scans" style="display: inline-block; background-color: #10b981; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px;">
            Review &amp; Execute Fix
          </a>
          <hr style="border-color: #333; margin-top: 40px; margin-bottom: 20px;" />
          <p style="color: #666; font-size: 12px;">
            You are receiving this email because you have Critical Vulnerability Alerts enabled in your Krypta settings.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return false;
    }

    console.log("Email sent:", data);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
