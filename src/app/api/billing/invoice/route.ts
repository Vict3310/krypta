/**
 * Invoice API
 *
 * POST /api/billing/invoice — Generate a Paystack payment request for custom amount/seats
 *         (for enterprise/B2B customers who need bank transfer or invoicing)
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: Request) {
  if (!PAYSTACK_SECRET) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { tier, seats, notes, company_name, tin } = await req.json();

    const targetEmail = sessionUser.email;
    if (!targetEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Validate tier
    if (!["pro", "team"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    // Calculate amount — team is ₦15,000/seat/month
    const perSeatKobo = tier === "team" ? 1500000 : 500000; // ₦15,000 or ₦5,000
    const seatsCount = seats || 1;
    const amount = perSeatKobo * seatsCount;

    // Generate reference
    const reference = `invoice_${sessionUser.id}_${Date.now()}`;

    // Call Paystack Request Payment API
    const response = await fetch("https://api.paystack.co/request-payment", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: {
          email: targetEmail,
          first_name: "",
          last_name: "",
        },
        amount,
        reference,
        currency: "NGN",
        metadata: {
          user_id: sessionUser.id,
          tier,
          seats: seatsCount,
          company_name,
          tin,
          type: "invoice",
        },
        subaccounts: [],
        authorization_url_callback: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/callback`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Paystack] Invoice creation failed:", data);
      return NextResponse.json(
        { error: data.message || "Failed to create invoice" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentLink: data.authorization_url,
      reference: data.reference,
      amount,
      tier,
      seats: seatsCount,
    });
  } catch (error) {
    console.error("[Invoice] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
