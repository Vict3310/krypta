/**
 * Health Check Endpoint
 * Returns service status, uptime, and dependency health
 */
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

// Track server start time for uptime calculation
const serverStartTime = Date.now();

export async function GET() {
  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - serverStartTime) / 1000)}s`,
  };

  // Check database connectivity
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("repositories").select("id").limit(1);

    if (error) {
      health["database"] = "unhealthy";
      health["status"] = "degraded";
      return NextResponse.json(health, { status: 503 });
    }

    health["database"] = "healthy";
  } catch (err) {
    health["database"] = "unhealthy";
    health["status"] = "degraded";
    return NextResponse.json(health, { status: 503 });
  }

  return NextResponse.json(health);
}
