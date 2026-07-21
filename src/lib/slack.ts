/**
 * Slack Notifications
 * Sends formatted security alerts to Slack via Incoming Webhooks
 */

export interface SlackAlertParams {
  webhookUrl: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  repoName: string;
  vulnerabilityType: string;
}

const severityColors: Record<string, string> = {
  critical: "#FF0000",
  high: "#FF4500",
  medium: "#FFA500",
  low: "#FFD700",
};

const severityEmojis: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

export async function sendSlackNotification(params: SlackAlertParams): Promise<boolean> {
  try {
    const { webhookUrl, title, description, severity, repoName, vulnerabilityType } = params;

    const payload = {
      attachments: [
        {
          color: severityColors[severity] || severityColors.medium,
          author_name: `Krypta Security Alert`,
          title: `${severityEmojis[severity] || "⚠️"} ${title}`,
          text: description,
          fields: [
            {
              title: "Repository",
              value: repoName,
              short: true,
            },
            {
              title: "Type",
              value: vulnerabilityType,
              short: true,
            },
            {
              title: "Severity",
              value: severity.toUpperCase(),
              short: true,
            },
          ],
          footer: "Krypta AI Security Engine",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Slack webhook error:", response.statusText);
      return false;
    }

    console.log("Slack notification sent");
    return true;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}
