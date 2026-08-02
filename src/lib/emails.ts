import { SendByte } from '@sendbyte/node';

const FROM = 'Krypta Security <hello@krypta.dev>';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://krypta.dev';

function getClient() {
  const key = process.env.SENDBYTE_API_KEY;
  if (!key) throw new Error('SENDBYTE_API_KEY not configured');
  return new SendByte(key);
}

export async function sendSecurityAlertEmail(params: {
  to: string;
  subject: string;
  body: string;
}) {
  try {
    await getClient().emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:40px;border-radius:12px;border:1px solid #333;">
          <h2 style="color:#ef4444;margin-bottom:20px;">Security Alert</h2>
          <p style="color:#a1a1aa;font-size:16px;line-height:1.5;white-space:pre-wrap;">${params.body}</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[Email] sendSecurityAlertEmail failed:', (error as Error).message);
    return false;
  }
}

export async function sendCriticalVulnerabilityEmail(
  userEmail: string,
  repoName: string,
  vulnerabilityType: string
) {
  try {
    await getClient().emails.send({
      from: FROM,
      to: userEmail,
      subject: `Critical Vulnerability Detected in ${repoName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:40px;border-radius:12px;border:1px solid #333;">
          <h2 style="color:#ef4444;margin-bottom:20px;">Critical Vulnerability Alert</h2>
          <p style="color:#a1a1aa;font-size:16px;line-height:1.5;">
            Krypta's AI Engine has detected a <strong>${vulnerabilityType}</strong> in your repository <strong>${repoName}</strong>.
          </p>
          <p style="color:#a1a1aa;font-size:16px;line-height:1.5;margin-bottom:30px;">
            We have generated a plain-English explanation and automatically created a Pull Request with the fix.
          </p>
          <a href="${DASHBOARD_URL}/dashboard/scans" style="display:inline-block;background:#10b981;color:#000;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:6px;">
            Review &amp; Execute Fix
          </a>
          <hr style="border-color:#333;margin-top:40px;margin-bottom:20px;" />
          <p style="color:#666;font-size:12px;">
            You are receiving this because you have Critical Vulnerability Alerts enabled in your Krypta settings.
          </p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[Email] sendCriticalVulnerabilityEmail failed:', (error as Error).message);
    return false;
  }
}
