import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// GET /api/billing/verify — Verify a Paystack transaction
export async function GET(req: Request) {
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
      const userId = data.data?.metadata?.user_id;
      const planId = data.data?.metadata?.plan;

      if (userId) {
        // Update user's plan in Supabase
        const db = createServiceRoleClient();
        await db.from("profiles").update({ plan: "pro" }).eq("id", userId);
      }

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
