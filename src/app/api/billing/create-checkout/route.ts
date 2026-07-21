/**
 * Paystack Checkout API Route
 * Creates a checkout session and returns the authorization URL
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { apiLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const { success } = await apiLimiter(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { email, plan, amount } = await req.json();

    if (!email || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      return NextResponse.json({ error: "Paystack not configured" }, { status: 500 });
    }

    // Create Paystack checkout session
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Convert to kobo (Paystack uses smallest currency unit)
        currency: "NGN",
        metadata: {
          plan,
          custom_fields: [
            {
              display_name: "Plan Type",
              variable_name: "plan_type",
              value: plan,
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!data.status || !data.data?.authorization_url) {
      throw new Error("Failed to create Paystack session");
    }

    return NextResponse.json({
      authorizationUrl: data.data.authorization_url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
