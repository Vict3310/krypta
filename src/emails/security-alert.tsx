import {
  Html,
  Head,
  Font,
  Preview,
  Heading,
  Row,
  Section,
  Text,
  Button,
  Tailwind,
  Container,
} from "@react-email/components";

interface SecurityAlertEmailProps {
  severity?: string;
  vulnType?: string;
  repoName?: string;
  filePath?: string;
  description?: string;
  scanDate?: string;
  dashboardUrl?: string;
}

export default function SecurityAlertEmail({
  severity = "Critical",
  vulnType = "Vulnerability",
  repoName = "unknown",
  filePath = "N/A",
  description = "",
  scanDate = new Date().toISOString(),
  dashboardUrl = "https://krypta.app",
}: SecurityAlertEmailProps) {
  const severityColor =
    severity === "Critical" ? "#dc2626" : severity === "High" ? "#ea580c" : "#f59e0b";

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>Krypta Security Alert — {severity} Severity</Preview>
      <Tailwind>
        <Section className="bg-gray-50">
          <Container className="max-w-lg mx-auto bg-white rounded-lg p-8 shadow-sm">
            <Section className="text-center mb-6">
              <Text className="text-lg font-semibold text-gray-900 tracking-tight m-0">
                Krypta Security Alert
              </Text>
            </Section>

            <Section className="mb-6">
              <Row>
                <Section
                  className={`text-white text-sm font-bold px-3 py-1 rounded-full`}
                  style={{ backgroundColor: severityColor }}
                >
                  {severity.toUpperCase()}
                </Section>
              </Row>
            </Section>

            <Section className="mb-6">
              <Text className="text-gray-900 text-base font-semibold mb-2">
                {vulnType}
              </Text>
              <Text className="text-gray-600 text-sm leading-relaxed mb-3">
                {description}
              </Text>
            </Section>

            <Section className="mb-6">
              <Row>
                <Text className="text-xs text-gray-500 font-mono mb-1">
                  Repository:
                </Text>
              </Row>
              <Row>
                <Text className="text-sm text-gray-900 font-medium mb-3">
                  {repoName}
                </Text>
              </Row>
              <Row>
                <Text className="text-xs text-gray-500 font-mono mb-1">
                  File:
                </Text>
              </Row>
              <Row>
                <Text className="text-sm text-gray-900 font-mono mb-3">
                  {filePath}
                </Text>
              </Row>
              <Row>
                <Text className="text-xs text-gray-500 font-mono mb-1">
                  Detected:
                </Text>
              </Row>
              <Row>
                <Text className="text-sm text-gray-900">
                  {new Date(scanDate).toLocaleString()}
                </Text>
              </Row>
            </Section>

            <Section className="text-center mb-6">
              <Button
                href={dashboardUrl}
                className="bg-[#e34a32] text-white px-6 py-3 rounded-lg font-medium text-sm"
              >
                View in Dashboard
              </Button>
            </Section>

            <Section className="border-t border-gray-100 pt-4">
              <Text className="text-xs text-gray-400 text-center">
                This is an automated security alert from Krypta.
              </Text>
            </Section>
          </Container>
        </Section>
      </Tailwind>
    </Html>
  );
}
