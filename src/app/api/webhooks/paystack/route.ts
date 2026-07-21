import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import crypto from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { z } from "zod";
import { webhookLimiter } from "@/lib/rate-limit";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const PaystackWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    customer: z.object({ email: z.string().email() }).optional(),
    amount: z.number().optional(),
  }),
});

export async function POST(req: Request) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || "webhook";
  const result = await webhookLimiter(ip);
  if (!result.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const text = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!PAYSTACK_SECRET) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      Sentry.captureException(new Error("PAYSTACK_SECRET_KEY not configured"));
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify Paystack Webhook Signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(text)
      .digest("hex");

    if (hash !== signature) {
      Sentry.captureEvent({
        level: "warning",
        message: "Invalid Paystack signature",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Validate payload structure
    let parsed;
    try {
      parsed = PaystackWebhookSchema.parse(JSON.parse(text));
    } catch {
      return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 });
    }

    const event = parsed.event;
    const supabase = createServiceRoleClient();

    if (event === "subscription.create" || event === "charge.success") {
      const email = parsed.data.customer?.email;
      if (!email) return NextResponse.json({ status: "success" });

      const { data: userData } = await supabase.rpc('get_user_by_email', { p_email: email });

      if (userData && (userData as any).id) {
        await supabase
          .from("profiles")
          .update({ plan: "pro" })
          .eq("id", (userData as any).id);
        console.log(`✅ Paystack: Upgraded ${email} to Pro`);
      }
    }

    if (event === "subscription.disable") {
      const email = parsed.data.customer?.email;
      if (!email) return NextResponse.json({ status: "success" });

      const { data: userData } = await supabase.rpc('get_user_by_email', { p_email: email });

      if (userData && (userData as any).id) {
        await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", (userData as any).id);
        console.log(`ℹ️ Paystack: Cancelled ${email}`);
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Paystack Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
