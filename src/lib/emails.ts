import { SendByte } from '@sendbyte/node';
import { render } from '@react-email/render';
import SecurityAlertEmail from '@/emails/security-alert';
import { escapeHtml } from '@/lib/ownership';

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
          <p style="color:#a1a1aa;font-size:16px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.body)}</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[Email] sendSecurityAlertEmail failed:', (error as Error).message);
    return false;
  }
}

/**
 * Send a templated security alert email (used by both the API route and
 * internal scan flows). Never trust the recipient — callers must validate it.
 */
export async function sendSecurityAlert(params: {
  to: string;
  severity: string;
  vulnType: string;
  repoName: string;
  filePath?: string;
  description?: string;
  scanDate?: string;
  dashboardUrl?: string;
}): Promise<string> {
  const key = process.env.SENDBYTE_API_KEY;
  if (!key) throw new Error('SENDBYTE_API_KEY not configured');

  const url = params.dashboardUrl || `${DASHBOARD_URL}/dashboard/scans`;

  const html = await render(
    SecurityAlertEmail({
      severity: params.severity,
      vulnType: params.vulnType,
      repoName: params.repoName,
      filePath: params.filePath || 'N/A',
      description: params.description || '',
      scanDate: params.scanDate || new Date().toISOString(),
      dashboardUrl: url,
    })
  );

  const sendbyte = new SendByte(key);
  const { id } = await sendbyte.emails.send({
    from: FROM,
    to: params.to,
    subject: `[${params.severity}] ${params.vulnType} found in ${params.repoName}`,
    html,
    text: `Security Alert: ${params.severity} severity ${params.vulnType} found in ${params.repoName}\n\n${params.description || ''}\n\nView in dashboard: ${url}`,
  });
  return String(id ?? '');
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
