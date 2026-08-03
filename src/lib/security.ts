import { isIP } from "node:net";

export function sanitizePromptContent(value: unknown, maxLength = 12000): string {
  if (value == null) return "";

  const text = String(value)
    .replace(/\u0000/g, "")
    .replace(/\r/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}\n…` : text;
}

/**
 * Best-effort client IP extraction. Only trusts values that parse as a real IP
 * address, so garbage/spoofed header values collapse to "unknown" (which shares
 * a single rate-limit bucket) instead of creating unlimited fresh buckets.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && isIP(forwarded)) return forwarded;
  const real = request.headers.get("x-real-ip")?.trim();
  if (real && isIP(real)) return real;
  return "unknown";
}
