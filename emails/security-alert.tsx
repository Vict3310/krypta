import { Html, Head, FontPanel, Body, Container, Section, Text, Button, Hr, Preview } from "@react-email/components";
import { format } from "date-fns";

interface SecurityAlertEmailProps {
  severity: "Critical" | "High" | "Medium" | "Low";
  vulnType: string;
  repoName: string;
  filePath: string;
  description: string;
  scanDate: string;
  dashboardUrl: string;
}

export default function SecurityAlertEmail({
  severity,
  vulnType,
  repoName,
  filePath,
  description,
  scanDate,
  dashboardUrl,
}: SecurityAlertEmailProps) {
  const severityColor = {
    Critical: "#EF4444",
    High: "#F97316",
    Medium: "#F59E0B",
    Low: "#3B82F6",
  }[severity];

  const severityLabel = {
    Critical: "🔴 Critical",
    High: "🟠 High",
    Medium: "🟡 Medium",
    Low: "🔵 Low",
  }[severity];

  return (
    <>
      <Preview>
        {severityLabel} — {vulnType} found in {repoName}
      </Preview>
      <Html lang="en">
        <Head>
          <FontPanel />
        </Head>
        <Body style={styles.body}>
          <Container style={styles.container}>
            {/* Header */}
            <Section style={styles.header}>
              <Text style={styles.logo}>🛡️ Krypta Security</Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Alert Banner */}
            <Section style={styles.alertBanner}>
              <Text style={styles.alertText}>
                {severityLabel} Security Alert
              </Text>
            </Section>

            {/* Main Content */}
            <Text style={styles.paragraph}>
              A {severity.toLowerCase()} severity vulnerability was detected in your repository.
            </Text>

            {/* Vulnerability Details */}
            <Section style={styles.details}>
              <Text style={styles.detailsTitle}>Vulnerability Details</Text>

              <Text style={styles.detailRow}>
                <span style={styles.detailLabel}>Type:</span>{" "}
                <span style={styles.detailValue}>{vulnType}</span>
              </Text>

              <Text style={styles.detailRow}>
                <span style={styles.detailLabel}>Repository:</span>{" "}
                <span style={styles.detailValue}>{repoName}</span>
              </Text>

              <Text style={styles.detailRow}>
                <span style={styles.detailLabel}>File:</span>{" "}
                <span style={styles.detailValue}>{filePath || "N/A"}</span>
              </Text>

              <Text style={styles.detailRow}>
                <span style={styles.detailLabel}>Detected:</span>{" "}
                <span style={styles.detailValue}>{format(new Date(scanDate), "MMM d, yyyy 'at' h:mm a")}</span>
              </Text>

              {description && (
                <Text style={styles.description}>
                  {description}
                </Text>
              )}
            </Section>

            <Hr style={styles.hr} />

            {/* CTA Button */}
            <Section style={styles.ctaSection}>
              <Button style={styles.button} href={dashboardUrl}>
                View in Dashboard →
              </Button>
              <Text style={styles.subtext}>
                Sign in to Krypta to see the full details and AI-generated fix suggestions.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Footer */}
            <Section style={styles.footer}>
              <Text style={styles.footerText}>
                You received this email because security alerts are enabled for your account.
              </Text>
              <Text style={styles.footerText}>
                To change notification settings, visit your account settings in Krypta.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </>
  );
}

const styles = {
  body: {
    backgroundColor: "#F9FAFB",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "40px 20px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  header: {
    padding: "24px 32px",
    borderBottom: "1px solid #F3F4F6",
  },
  logo: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#111827",
    margin: 0,
  },
  hr: {
    margin: "0",
    borderColor: "#F3F4F6",
  },
  alertBanner: {
    backgroundColor: "#FEF3C7",
    padding: "16px 32px",
    textAlign: "center" as const,
  },
  alertText: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#92400E",
  },
  paragraph: {
    margin: "0",
    padding: "24px 32px 0",
    fontSize: "16px",
    lineHeight: "24px",
    color: "#374151",
  },
  details: {
    margin: "24px 32px",
    padding: "20px",
    backgroundColor: "#F9FAFB",
    borderRadius: "8px",
  },
  detailsTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "12px",
  },
  detailRow: {
    fontSize: "14px",
    lineHeight: "24px",
    marginBottom: "8px",
    color: "#374151",
  },
  detailLabel: {
    fontWeight: "600",
    color: "#111827",
  },
  detailValue: {
    color: "#374151",
  },
  description: {
    marginTop: "12px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "#6B7280",
    fontStyle: "italic",
  },
  ctaSection: {
    padding: "24px 32px",
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
    padding: "12px 24px",
    borderRadius: "8px",
    fontWeight: "600",
    textDecoration: "none",
    fontSize: "14px",
  },
  subtext: {
    fontSize: "12px",
    color: "#9CA3AF",
    marginTop: "12px",
  },
  footer: {
    padding: "24px 32px",
    borderTop: "1px solid #F3F4F6",
  },
  footerText: {
    fontSize: "12px",
    color: "#9CA3AF",
    margin: "4px 0",
  },
};
