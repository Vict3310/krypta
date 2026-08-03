import { createServiceRoleClient } from "@/utils/supabase/service";
import { getClientIp } from "@/lib/security";
import { sendSlackNotification } from "@/lib/slack";
import { sendSecurityAlertEmail } from "@/lib/emails";
import { Redis } from "@upstash/redis";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";
export type SecurityEventType =
  | "auth_anomaly"
  | "api_abuse"
  | "exploit_abuse"
  | "privilege_anomaly"
  | "webhook_anomaly"
  | "billing_anomaly"
  | "integrity_failure";

export interface SecurityEventRecord {
  id: string;
  event_type: string;
  severity: SecuritySeverity;
  user_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  detected_at: string;
  auto_action_taken: boolean;
}

interface MonitorPayload {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

interface SecurityActionRecord {
  id: string;
  event_id: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  performed_at: string;
  reversed_at: string | null;
}

const alertCooldownMs = new Map<string, number>();
const alertSummaryCounts = new Map<string, number>();

// ─────────────────────────────────────────────────────────────
// Durable event buckets
//
// Abuse/anomaly detection windows are backed by Redis when Upstash
// is configured (survives restarts and multi-instance deployments)
// and fall back to in-memory state locally. This prevents attackers
// from evading detection by rotating instances.
// ─────────────────────────────────────────────────────────────
let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    redis =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          })
        : null;
  }
  return redis;
}

const memoryBuckets = new Map<string, number[]>();

/** Add a timestamp to a bucket and return the pruned history within the window. */
async function addBucketEvent(
  key: string,
  ts: number,
  windowMs: number
): Promise<number[]> {
  const r = getRedis();
  if (r) {
    const zkey = `krypta:bucket:${key}`;
    // Unique member so simultaneous events don't overwrite each other.
    await r.zadd(zkey, { score: ts, member: `${ts}:${Math.random().toString(36).slice(2)}` });
    await r.zremrangebyscore(zkey, 0, ts - windowMs);
    const members = await r.zrange(zkey, 0, -1);
    return members.map((m) => Number(String(m).split(":")[0]));
  }
  const arr = (memoryBuckets.get(key) ?? []).filter((t) => t >= ts - windowMs);
  arr.push(ts);
  memoryBuckets.set(key, arr);
  return arr;
}

/** Read the pruned history of a bucket (without adding a new event). */
async function getBucketHistory(key: string, windowMs: number): Promise<number[]> {
  const r = getRedis();
  const cutoff = Date.now() - windowMs;
  if (r) {
    const zkey = `krypta:bucket:${key}`;
    await r.zremrangebyscore(zkey, 0, cutoff);
    const members = await r.zrange(zkey, 0, -1);
    return members.map((m) => Number(String(m).split(":")[0]));
  }
  return (memoryBuckets.get(key) ?? []).filter((t) => t >= cutoff);
}

function normalizeIp(ipAddress?: string | null): string {
  if (!ipAddress) return "unknown";
  return ipAddress.split(",")[0]?.trim() || "unknown";
}

function nowMs(): number {
  return Date.now();
}

async function insertSecurityEvent(payload: MonitorPayload): Promise<SecurityEventRecord | null> {
  const db = createServiceRoleClient();
  const severity = payload.severity;
  const normalizedIp = normalizeIp(payload.ipAddress);

  try {
    const { data, error } = await db
      .from("security_events")
      .insert({
        event_type: payload.eventType,
        severity,
        user_id: payload.userId || null,
        ip_address: normalizedIp,
        metadata: payload.metadata || {},
        auto_action_taken: false,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[Security Monitor] Failed to record event", error);
      return null;
    }

    await maybeSendAdminAlert({
      eventType: payload.eventType,
      severity,
      userId: payload.userId || null,
      ipAddress: normalizedIp,
      metadata: payload.metadata || {},
      eventId: data.id,
    });

    return data as SecurityEventRecord;
  } catch (error) {
    console.error("[Security Monitor] Event insert failed", error);
    return null;
  }
}

async function maybeSendAdminAlert(payload: {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId: string | null;
  ipAddress: string;
  metadata: Record<string, unknown>;
  eventId: string;
}) {
  if (payload.severity === "low") return;

  const dedupeKey = `${payload.eventType}:${payload.userId || "anon"}:${payload.ipAddress}`;
  const now = nowMs();
  const lastAt = alertCooldownMs.get(dedupeKey);
  const suppressWindowMs = payload.severity === "critical" ? 30_000 : 60_000;

  if (lastAt && now - lastAt < suppressWindowMs) {
    const count = (alertSummaryCounts.get(dedupeKey) || 0) + 1;
    alertSummaryCounts.set(dedupeKey, count);
    return;
  }

  alertCooldownMs.set(dedupeKey, now);
  alertSummaryCounts.delete(dedupeKey);

  const message = [
    `Event: ${payload.eventType}`,
    `Severity: ${payload.severity.toUpperCase()}`,
    `User: ${payload.userId || "unknown"}`,
    `IP: ${payload.ipAddress}`,
    `Details: ${JSON.stringify(payload.metadata)}`,
  ].join("\n");

  const slackWebhook = process.env.SLACK_ADMIN_WEBHOOK_URL;
  if (slackWebhook) {
    await sendSlackNotification({
      webhookUrl: slackWebhook,
      title: `Security ${payload.severity.toUpperCase()} Alert`,
      description: message,
      severity: payload.severity,
      repoName: String(payload.metadata.repository || "platform"),
      vulnerabilityType: payload.eventType.replace(/_/g, " "),
    });
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (payload.severity === "high" || payload.severity === "critical") {
    if (adminEmail) {
      await sendSecurityAlertEmail({
        to: adminEmail,
        subject: `Krypta security ${payload.severity} alert: ${payload.eventType}`,
        body: message,
      });
    }
  }
}

async function recordAutomaticAction(payload: {
  eventId: string;
  severity: SecuritySeverity;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  reason: string;
}) {
  if (payload.severity !== "high" && payload.severity !== "critical") return;

  const db = createServiceRoleClient();
  const actionType = payload.severity === "critical" ? "suspend_account" : "revoke_session";

  try {
    if (payload.severity === "critical" && payload.userId) {
      await db.from("profiles").update({
        suspended: true,
        suspended_at: new Date().toISOString(),
        suspension_reason: payload.reason,
      }).eq("id", payload.userId);
    }

    if (payload.metadata?.apiKeyId) {
      await db.from("api_keys").update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_until: payload.severity === "critical"
          ? null
          : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        revoked_reason: payload.reason,
      }).eq("id", String(payload.metadata.apiKeyId));
    }

    if (payload.severity === "critical" && payload.userId) {
      await db.from("exploit_scan_jobs").update({
        status: "paused",
      }).eq("user_id", payload.userId).in("status", ["pending", "running", "queued"]);
    }

    await db.from("security_actions").insert({
      event_id: payload.eventId,
      action_type: actionType,
      target_type: payload.userId ? "user" : "system",
      target_id: payload.userId || null,
      reason: payload.reason,
    });
  } catch (error) {
    console.error("[Security Monitor] Automatic action failed", error);
  }
}

async function updateEventAutoAction(eventId: string, taken: boolean) {
  const db = createServiceRoleClient();
  try {
    await db.from("security_events").update({ auto_action_taken: taken }).eq("id", eventId);
  } catch (error) {
    console.error("[Security Monitor] Failed to update event state", error);
  }
}

export async function recordAuthAnomaly(params: {
  eventType: "login_failure" | "login_success_after_failures" | "impossible_travel";
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedIp = normalizeIp(params.ipAddress);
  const now = nowMs();
  const bucketKey = `${normalizedIp}:${params.userId || "anon"}`;
  const nextHistory = await addBucketEvent(`auth:${bucketKey}`, now, 5 * 60_000);

  const failureCount = nextHistory.length;
  let severity: SecuritySeverity = "low";

  if (params.eventType === "impossible_travel") {
    severity = "critical";
  } else if (params.eventType === "login_success_after_failures") {
    severity = "high";
  } else if (failureCount > 10) {
    severity = failureCount > 20 ? "critical" : "high";
  } else {
    severity = "medium";
  }

  const event = await insertSecurityEvent({
    eventType: "auth_anomaly",
    severity,
    userId: params.userId || null,
    ipAddress: normalizedIp,
    metadata: {
      ...params.metadata,
      authEventType: params.eventType,
      failureCount,
    },
  });

  if (event && severity === "high") {
    await recordAutomaticAction({
      eventId: event.id,
      severity,
      userId: params.userId || null,
      metadata: { apiKeyId: params.metadata?.apiKeyId },
      reason: `Suspicious authentication activity (${params.eventType})`,
    });
    await updateEventAutoAction(event.id, true);
  }
}

export async function recordApiAbuse(params: {
  userId?: string | null;
  apiKeyId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedIp = normalizeIp(params.ipAddress);
  const key = `${params.userId || "anon"}:${params.apiKeyId || "anon"}`;
  const now = nowMs();
  const nextHistory = await addBucketEvent(`api:${key}`, now, 60 * 60_000);

  const average = nextHistory.length > 1 ? nextHistory.length / 2 : nextHistory.length;
  const currentVolume = (params.metadata?.requestCount as number | undefined) || 1;
  const severity = currentVolume > average * 50 ? "high" : "medium";

  const event = await insertSecurityEvent({
    eventType: "api_abuse",
    severity,
    userId: params.userId || null,
    ipAddress: normalizedIp,
    metadata: {
      ...params.metadata,
      averageRequestRate: Math.max(1, average),
      currentRequestCount: currentVolume,
    },
  });

  if (event && severity === "high") {
    await recordAutomaticAction({
      eventId: event.id,
      severity,
      userId: params.userId || null,
      metadata: { apiKeyId: params.apiKeyId || params.metadata?.apiKeyId },
      reason: "API usage spike exceeded expected profile",
    });
    await updateEventAutoAction(event.id, true);
  }
}

export async function recordExploitAbuse(params: {
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedIp = normalizeIp(params.ipAddress);
  const key = `${params.userId || "anon"}:${normalizedIp}`;
  await addBucketEvent(`exploit:${key}`, nowMs(), 10 * 60_000);

  const distinctDomains = Number(params.metadata?.distinctDomains || 1);
  const severity = distinctDomains > 10 ? "high" : "medium";

  const event = await insertSecurityEvent({
    eventType: "exploit_abuse",
    severity,
    userId: params.userId || null,
    ipAddress: normalizedIp,
    metadata: {
      ...params.metadata,
      distinctDomains,
    },
  });

  if (event && severity === "high") {
    await recordAutomaticAction({
      eventId: event.id,
      severity,
      userId: params.userId || null,
      reason: "Exploit engine abuse patterns detected",
    });
    await updateEventAutoAction(event.id, true);
  }
}

export async function recordPrivilegeAnomaly(params: {
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedIp = normalizeIp(params.ipAddress);
  const key = `${params.userId || "anon"}:${normalizedIp}`;
  const now = nowMs();
  const nextHistory = await addBucketEvent(`priv:${key}`, now, 5 * 60_000);

  const severity = nextHistory.length > 5 ? "high" : "medium";

  const event = await insertSecurityEvent({
    eventType: "privilege_anomaly",
    severity,
    userId: params.userId || null,
    ipAddress: normalizedIp,
    metadata: {
      ...params.metadata,
      resourceAccessCount: nextHistory.length,
    },
  });

  if (event && severity === "high") {
    await recordAutomaticAction({
      eventId: event.id,
      severity,
      userId: params.userId || null,
      reason: "Cross-user resource access attempt detected",
    });
    await updateEventAutoAction(event.id, true);
  }
}

export async function recordWebhookAnomaly(params: {
  eventType?: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedIp = normalizeIp(params.ipAddress);
  const key = `${params.eventType || "webhook"}:${normalizedIp}`;
  const now = nowMs();
  const nextHistory = await addBucketEvent(`webhook:${key}`, now, 5 * 60_000);

  const failureCount = nextHistory.length;
  const severity = failureCount > 5 ? "high" : "medium";

  const event = await insertSecurityEvent({
    eventType: "webhook_anomaly",
    severity,
    ipAddress: normalizedIp,
    metadata: {
      ...params.metadata,
      failureCount,
      provider: params.metadata?.provider || "unknown",
    },
  });

  if (event && severity === "high") {
    await recordAutomaticAction({
      eventId: event.id,
      severity,
      reason: "Repeated webhook signature failures detected",
    });
    await updateEventAutoAction(event.id, true);
  }
}

export async function recordBillingAnomaly(params: {
  userId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedIp = normalizeIp(params.ipAddress);
  const severity = (params.metadata?.planCycleCount as number | undefined) && (params.metadata?.planCycleCount as number) > 3
    ? "high"
    : "medium";

  const event = await insertSecurityEvent({
    eventType: "billing_anomaly",
    severity,
    userId: params.userId || null,
    ipAddress: normalizedIp,
    metadata: params.metadata || {},
  });

  if (event && severity === "high") {
    await recordAutomaticAction({
      eventId: event.id,
      severity,
      userId: params.userId || null,
      reason: "Billing anomaly suggests account abuse",
    });
    await updateEventAutoAction(event.id, true);
  }
}

export async function recordIntegrityFailure(params: { message: string; metadata?: Record<string, unknown> }) {
  const event = await insertSecurityEvent({
    eventType: "integrity_failure",
    severity: "critical",
    ipAddress: "internal",
    metadata: params.metadata || { message: params.message },
  });

  if (event) {
    await recordAutomaticAction({
      eventId: event.id,
      severity: "critical",
      reason: params.message,
    });
    await updateEventAutoAction(event.id, true);
    await setExploitEngineKillSwitch(false, params.message);
  }
}

export async function getRecentSecurityEvents(limit = 50): Promise<SecurityEventRecord[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("security_events")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Security Monitor] Could not fetch security events", error);
    return [];
  }

  return (data || []) as SecurityEventRecord[];
}

export async function getRecentSecurityActions(limit = 50): Promise<SecurityActionRecord[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("security_actions")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Security Monitor] Could not fetch security actions", error);
    return [];
  }

  return (data || []) as SecurityActionRecord[];
}

export async function setExploitEngineKillSwitch(enabled: boolean, reason: string) {
  const db = createServiceRoleClient();
  try {
    const { data: existing } = await db
      .from("security_settings")
      .select("value")
      .eq("key", "exploit_engine_enabled")
      .maybeSingle();

    if (existing) {
      await db.from("security_settings").update({
        value: enabled ? "true" : "false",
        updated_at: new Date().toISOString(),
        note: reason,
      }).eq("key", "exploit_engine_enabled");
    } else {
      await db.from("security_settings").insert({
        key: "exploit_engine_enabled",
        value: enabled ? "true" : "false",
        updated_at: new Date().toISOString(),
        note: reason,
      });
    }
  } catch (error) {
    console.error("[Security Monitor] Could not set kill switch", error);
  }
}

export async function isExploitEngineEnabled(): Promise<boolean> {
  const db = createServiceRoleClient();
  try {
    const { data } = await db
      .from("security_settings")
      .select("value")
      .eq("key", "exploit_engine_enabled")
      .maybeSingle();

    if (data?.value === "false") return false;
  } catch {
    // fall back to env var
  }

  return process.env.KRYPTA_EXPLOIT_ENGINE_ENABLED !== "false";
}

export async function runIntegrityMonitor() {
  const db = createServiceRoleClient();
  try {
    const { data, error } = await db.rpc("check_security_integrity");
    if (error) {
      await recordIntegrityFailure({
        message: "Integrity monitor could not verify security policy state",
        metadata: { error: error.message },
      });
      return false;
    }

    const policiesPresent = Boolean(data && Array.isArray(data) ? data.length : data);
    if (!policiesPresent) {
      await recordIntegrityFailure({
        message: "RLS policy checks failed",
        metadata: { result: data },
      });
      return false;
    }

    return true;
  } catch (error) {
    await recordIntegrityFailure({
      message: "Integrity monitor failed",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return false;
  }
}

export async function requireAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const db = createServiceRoleClient();
  const { data } = await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return Boolean(data?.is_admin);
}

export async function suspendAccount(userId: string, reason: string, adminUserId?: string | null) {
  const db = createServiceRoleClient();
  await db.from("profiles").update({
    suspended: true,
    suspended_at: new Date().toISOString(),
    suspension_reason: reason,
  }).eq("id", userId);

  const event = await insertSecurityEvent({
    eventType: "privilege_anomaly",
    severity: "critical",
    userId,
    metadata: { adminUserId, reason, action: "manual_suspension" },
  });

  if (event) {
    await db.from("security_actions").insert({
      event_id: event.id,
      action_type: "manual_suspend",
      target_type: "user",
      target_id: userId,
      reason,
    });
  }
}

export async function unsuspendAccount(userId: string, reason: string) {
  const db = createServiceRoleClient();
  await db.from("profiles").update({
    suspended: false,
    suspended_at: null,
    suspension_reason: reason,
  }).eq("id", userId);
}

export async function revokeApiKey(apiKeyId: string, reason: string, userId?: string | null) {
  const db = createServiceRoleClient();
  await db.from("api_keys").update({
    is_active: false,
    revoked_at: new Date().toISOString(),
    revoked_reason: reason,
    revoked_by: userId || null,
  }).eq("id", apiKeyId);
}

export async function recordAuthFailure(ipAddress?: string | null, userId?: string | null) {
  const normalizedIp = normalizeIp(ipAddress);
  const bucketKey = `${normalizedIp}:${userId || "anon"}`;
  const nextHistory = await addBucketEvent(`auth:${bucketKey}`, nowMs(), 5 * 60_000);

  const failureCount = nextHistory.length;
  if (failureCount > 10) {
    await recordAuthAnomaly({
      eventType: "login_failure",
      userId,
      ipAddress: normalizedIp,
      metadata: { failureCount },
    });
  }
}

export async function recordAuthSuccess(userId?: string | null, ipAddress?: string | null, metadata?: Record<string, unknown>) {
  const normalizedIp = normalizeIp(ipAddress);
  const bucketKey = `${normalizedIp}:${userId || "anon"}`;
  const nextHistory = await getBucketHistory(`auth:${bucketKey}`, 5 * 60_000);
  if (nextHistory.length > 0) {
    await recordAuthAnomaly({
      eventType: "login_success_after_failures",
      userId,
      ipAddress: normalizedIp,
      metadata: { previousFailures: nextHistory.length, ...metadata },
    });
  }
}

export function getRequestIp(request: Request): string {
  return getClientIp(request);
}
