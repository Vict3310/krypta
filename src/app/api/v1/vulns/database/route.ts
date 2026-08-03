/**
 * REST API - Private Vulnerability Database
 * Track known vulnerabilities across organization
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { validateApiKey } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/utils/supabase/service";

// GET /api/v1/vulns/database - List all known vulnerabilities
export async function GET(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const severity = searchParams.get("severity");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const supabase = createServiceRoleClient();

    let query = supabase
      .from("vulnerability_database")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (severity) {
      query = query.eq("severity", severity);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,cve_id.ilike.%${search}%`
      );
    }

    const { data: vulns, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: vulns,
      pagination: {
        limit,
        offset,
        total: count,
        has_more: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("List vulnerability database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vulnerabilities" },
      { status: 500 }
    );
  }
}

// POST /api/v1/vulns/database - Add vulnerability to database
export async function POST(request: Request) {
  try {
    const auth = await validateApiKey(request);
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const {
      cve_id,
      title,
      description,
      severity,
      category,
      affected_versions,
      patch_level,
      references,
      affected_files,
    } = body;

    // Validate required fields
    if (!title || !severity || !category) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: title, severity, category",
        },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ["low", "medium", "high", "critical"];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: "Invalid severity. Must be: low, medium, high, critical" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "authentication",
      "authorization",
      "injection",
      "cryptographic",
      "data-exposure",
      "configuration",
      "dependency",
      "other",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: vuln, error } = await supabase
      .from("vulnerability_database")
      .insert({
        cve_id: cve_id || null,
        title,
        description,
        severity,
        category,
        affected_versions: affected_versions || [],
        patch_level: patch_level || null,
        references: references || [],
        affected_files: affected_files || [],
        is_internal: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        message: "Vulnerability added to database",
        vulnerability: vuln,
      },
      { status: 201 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Add vulnerability error:", error);
    return NextResponse.json(
      { error: "Failed to add vulnerability" },
      { status: 500 }
    );
  }
}
