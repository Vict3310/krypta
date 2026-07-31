import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

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

    // Update user's plan in Supabase
    const userId = data.data?.metadata?.user_id;
    if (userId) {
      const db = createServiceRoleClient();
      await db.from("profiles").update({ plan: "pro" }).eq("id", userId);
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
