export function sanitizePromptContent(value: unknown, maxLength = 12000): string {
  if (value == null) return "";

  const text = String(value)
    .replace(/\u0000/g, "")
    .replace(/\r/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}\n…` : text;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get("x-real-ip") || "unknown";
}
