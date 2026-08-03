import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { getAmount, type TierId, type BillingCycle, type CurrencyCode } from "@/lib/billing";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// GET /api/billing/callback — Paystack redirect after payment
export async function GET(req: Request) {
  if (!PAYSTACK_SECRET) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/billing?error=billing_not_configured`
    );
  }

  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference");
  const transactionId = searchParams.get("transactionId");

  if (!reference && !transactionId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/billing?error=missing_reference`
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

    if (!response.ok || !data.status || data.data?.status !== "success") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/billing?error=payment_failed`
      );
    }

    // Update user's plan in Supabase — only when the charged amount matches the tier.
    const userId = data.data?.metadata?.user_id;
    if (userId) {
      const metadata = (data.data?.metadata ?? {}) as Record<string, unknown>;
      const tier: TierId = ["free", "pro", "team"].includes(metadata.tier as string) ? (metadata.tier as TierId) : "pro";
      const cycle: BillingCycle = metadata.cycle === "yearly" ? "yearly" : "monthly";
      const currency: CurrencyCode = metadata.currency === "GHS" ? "GHS" : "NGN";
      const expectedAmount = getAmount(tier, cycle, currency);
      if (Number(data.data?.amount) >= expectedAmount) {
        const db = createServiceRoleClient();
        await db.from("profiles").update({ plan: tier === "team" ? "pro" : tier }).eq("id", userId);
      } else {
        console.error(
          `[Paystack] Callback amount mismatch: charged ${data.data?.amount}, expected ${expectedAmount}. Not upgrading.`
        );
      }
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/billing?status=success`
    );
  } catch (error) {
    console.error("[Paystack] Callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/billing?error=verification_failed`
    );
  }
}
