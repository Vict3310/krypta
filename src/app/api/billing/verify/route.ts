import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { requireUser } from "@/lib/auth";
import { apiLimiter } from "@/lib/rate-limit";
import { getAmount, type TierId, type BillingCycle, type CurrencyCode } from "@/lib/billing";
import { getClientIp } from "@/lib/security";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// GET /api/billing/verify — Verify a Paystack transaction
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const { success: rateLimitOk } = await apiLimiter(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  if (!PAYSTACK_SECRET) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");
  const transactionId = searchParams.get("transactionId");

  if (!reference && !transactionId) {
    return NextResponse.json(
      { error: "Missing reference or transactionId" },
      { status: 400 }
    );
  }

  try {
    const verifyUrl = transactionId
      ? `https://api.paystack.co/transaction/${transactionId}/verify`
      : `https://api.paystack.co/transaction/verify/${reference}`;

    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // Check if payment was successful
    if (data.data?.status === "success") {
      const metadata = (data.data?.metadata ?? {}) as Record<string, unknown>;

      // Only the account that initiated the transaction may claim the upgrade.
      if (metadata.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: "This transaction belongs to a different account" },
          { status: 403 }
        );
      }

      // Validate the charged amount matches the requested tier.
      const tier: TierId = ["free", "pro", "team"].includes(metadata.tier as string) ? (metadata.tier as TierId) : "pro";
      const cycle: BillingCycle = metadata.cycle === "yearly" ? "yearly" : "monthly";
      const currency: CurrencyCode = metadata.currency === "GHS" ? "GHS" : "NGN";
      const expectedAmount = getAmount(tier, cycle, currency);
      if (Number(data.data?.amount) < expectedAmount) {
        return NextResponse.json(
          { error: "Transaction amount does not match the selected plan" },
          { status: 400 }
        );
      }

      // Update the session user's plan
      const db = createServiceRoleClient();
      await db.from("profiles").update({ plan: tier === "team" ? "pro" : tier }).eq("id", auth.user.id);

      return NextResponse.json({
        verified: true,
        data: data.data,
      });
    }

    return NextResponse.json({ verified: false });
  } catch (error) {
    console.error("[Paystack] Verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
