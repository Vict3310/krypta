import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getRecentSecurityActions,
  getRecentSecurityEvents,
  isExploitEngineEnabled,
  requireAdminUser,
  revokeApiKey,
  setExploitEngineKillSwitch,
  suspendAccount,
  unsuspendAccount,
} from "@/lib/security-monitor";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const isAdmin = await requireAdminUser(auth.user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [events, actions, exploitEngineEnabled] = await Promise.all([
    getRecentSecurityEvents(100),
    getRecentSecurityActions(100),
    isExploitEngineEnabled(),
  ]);

  return NextResponse.json({ events, actions, exploitEngineEnabled });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const isAdmin = await requireAdminUser(auth.user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const reason = String(body?.reason || "Admin action");

  try {
    switch (action) {
      case "toggle-exploit-engine": {
        await setExploitEngineKillSwitch(Boolean(body?.enabled), reason);
        return NextResponse.json({ success: true });
      }
      case "suspend-account": {
        if (!body?.userId) {
          return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }
        await suspendAccount(String(body.userId), reason, auth.user.id);
        return NextResponse.json({ success: true });
      }
      case "unsuspend-account": {
        if (!body?.userId) {
          return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }
        await unsuspendAccount(String(body.userId), reason);
        return NextResponse.json({ success: true });
      }
      case "revoke-api-key": {
        if (!body?.apiKeyId) {
          return NextResponse.json({ error: "Missing apiKeyId" }, { status: 400 });
        }
        await revokeApiKey(String(body.apiKeyId), reason, auth.user.id);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Admin Security] Action failed", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
