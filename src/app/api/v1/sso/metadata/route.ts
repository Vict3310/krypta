/**
 * REST API - SSO / SAML metadata
 * POST /api/v1/sso/metadata
 */
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { requireAdminUser } from "@/lib/security-monitor";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function POST(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!(await requireAdminUser(auth.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data: ssoConfig } = await supabase
      .from("sso_configurations")
      .select("*")
      .eq("team_id", "owner")
      .single();

    if (!ssoConfig) {
      return NextResponse.json({ error: "SSO not configured" }, { status: 404 });
    }

    const metadataXml = generateSAMLMetadata({
      entity_id: ssoConfig.provider_config?.entity_id ||
        `${process.env.NEXT_PUBLIC_APP_URL}/saml/metadata`,
      callback_url: ssoConfig.callback_url,
      certificate: ssoConfig.certificate_data?.certificate,
    });

    const response = NextResponse.json({ metadata: metadataXml });
    response.headers.set("Content-Type", "application/saml-metadata+xml");
    return response;
  } catch (error) {
    Sentry.captureException(error);
    console.error("Generate metadata error:", error);
    return NextResponse.json({ error: "Failed to generate metadata" }, { status: 500 });
  }
}

function generateSAMLMetadata({ entity_id, callback_url, certificate }: {
  entity_id: string;
  callback_url: string;
  certificate?: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor entityID="${entity_id}"
  xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <EntityID>${entity_id}</EntityID>
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${callback_url}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${callback_url}"
      index="0"/>
    ${certificate ? `<KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${certificate}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>` : ""}
  </SPSSODescriptor>
</EntityDescriptor>`;
}