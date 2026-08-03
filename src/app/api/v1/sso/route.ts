/**
 * REST API - SSO/SAML Configuration
 * Enterprise single sign-on setup and management
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { requireAdminUser } from "@/lib/security-monitor";
import { createServiceRoleClient } from "@/utils/supabase/service";

/**
 * SSO configuration is a global (owner-level) setting. Only admins may read
 * or modify it — a regular API-key user must never be able to reconfigure
 * (or enforce) enterprise SSO.
 */
async function requireSsoAdmin(authUserId: string): Promise<Response | null> {
  if (!(await requireAdminUser(authUserId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/v1/sso - Get SSO configuration
export async function GET(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const forbidden = await requireSsoAdmin(auth.user.id);
    if (forbidden) return forbidden;

    const supabase = createServiceRoleClient();

    const { data: ssoConfig, error } = await supabase
      .from("sso_configurations")
      .select("*")
      .eq("team_id", "owner")
      .single();

    if (error && error.code !== "PGRST116") throw error;

    // Don't return sensitive data
    const { key_secret, ...safeConfig } = ssoConfig || {};

    return NextResponse.json({
      data: safeConfig,
      sso_enabled: !!ssoConfig,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Get SSO config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch SSO configuration" },
      { status: 500 }
    );
  }
}

// POST /api/v1/sso - Configure SSO
export async function POST(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const forbidden = await requireSsoAdmin(auth.user.id);
    if (forbidden) return forbidden;

    const body = await request.json();
    const {
      provider,
      sso_url,
      certificate,
      issuer,
      entity_id,
      callback_url,
      domains,
      enabled,
    } = body;

    // Validate required fields based on provider
    if (!provider || !["saml", "oauth2"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid or missing provider" },
        { status: 400 }
      );
    }

    if (provider === "saml" && (!sso_url || !certificate)) {
      return NextResponse.json(
        { error: "SAML configuration requires sso_url and certificate" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Generate callback URL if not provided
    const generatedCallbackUrl = callback_url ||
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/sso/callback`;

    // Generate provider config
    const provider_config = {
      provider,
      sso_url,
      issuer,
      entity_id,
      domains: domains || [],
      enforced: false,
    };

    // Generate certificate if SAML
    const certificate_data = certificate
      ? { certificate, key_secret: randomKey(64) }
      : null;

    // Upsert SSO configuration
    const { data: ssoConfig, error } = await supabase
      .from("sso_configurations")
      .upsert({
        team_id: "owner",
        provider,
        sso_url,
        certificate_data,
        provider_config,
        callback_url: generatedCallbackUrl,
        enforced: false,
        enabled: enabled ?? true,
      }, {
        onConflict: "team_id",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        message: "SSO configuration saved",
        config: {
          ...ssoConfig,
          callback_url: generatedCallbackUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Configure SSO error:", error);
    return NextResponse.json(
      { error: "Failed to configure SSO" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/sso/enforce - Enable/disable SSO enforcement
export async function PATCH(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const forbidden = await requireSsoAdmin(auth.user.id);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { enforced } = body;

    if (typeof enforced !== "boolean") {
      return NextResponse.json(
        { error: "Invalid value for enforced" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: ssoConfig, error } = await supabase
      .from("sso_configurations")
      .update({ enforced })
      .eq("team_id", "owner")
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: `SSO ${enforced ? "enforced" : "enforcement removed"}`,
      config: ssoConfig,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Enforce SSO error:", error);
    return NextResponse.json(
      { error: "Failed to update SSO enforcement" },
      { status: 500 }
    );
  }
}

// Helper functions
import { randomBytes } from "crypto";

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

function randomKey(length: number): string {
  return randomBytes(length / 2).toString("hex");
}
