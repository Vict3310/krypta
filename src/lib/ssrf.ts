import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function normalizeHostname(raw: string): string {
  const trimmed = raw.trim().replace(/\.$/, "").toLowerCase();
  if (!trimmed) return trimmed;

  if (/^\d+$/.test(trimmed)) {
    return ipv4FromDecimal(trimmed) || trimmed;
  }

  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    return ipv4FromHex(trimmed) || trimmed;
  }

  if (/^0[0-7]+$/i.test(trimmed)) {
    return ipv4FromOctal(trimmed) || trimmed;
  }

  return trimmed;
}

function ipv4FromDecimal(value: string): string | null {
  try {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 4294967295) return null;
    const octets = [0, 0, 0, 0];
    let remaining = numeric;
    for (let i = 3; i >= 0; i--) {
      octets[i] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    return octets.join(".");
  } catch {
    return null;
  }
}

function ipv4FromHex(value: string): string | null {
  try {
    const numeric = Number.parseInt(value, 16);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 4294967295) return null;
    const octets = [0, 0, 0, 0];
    let remaining = numeric;
    for (let i = 3; i >= 0; i--) {
      octets[i] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    return octets.join(".");
  } catch {
    return null;
  }
}

function ipv4FromOctal(value: string): string | null {
  try {
    const numeric = parseInt(value, 8);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 4294967295) return null;
    const octets = [0, 0, 0, 0];
    let remaining = numeric;
    for (let i = 3; i >= 0; i--) {
      octets[i] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    return octets.join(".");
  } catch {
    return null;
  }
}

/**
 * Validate a user-supplied URL for outbound HTTP (exploit scans).
 * Blocks non-http(s), credentials, localhost, private, and link-local targets.
 */
export async function assertSafeTargetUrl(
  raw: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let normalized = raw.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "URLs with credentials are not allowed" };
  }

  const hostname = normalizeHostname(parsed.hostname.replace(/^\[|\]$/g, ""));

  if (
    hostname === "localhost" ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("0.")
  ) {
    return { ok: false, error: "Target host is not allowed" };
  }

  const literalIp = isIP(hostname);
  if (literalIp) {
    if (isBlockedIp(hostname)) {
      return { ok: false, error: "Target IP is not allowed" };
    }
  } else {
    try {
      const records = await lookup(hostname, { all: true, verbatim: true });
      if (!records.length) {
        return { ok: false, error: "Could not resolve target host" };
      }
      for (const record of records) {
        if (isBlockedIp(record.address)) {
          return { ok: false, error: "Target resolves to a private or reserved address" };
        }
      }
    } catch {
      return { ok: false, error: "Could not resolve target host" };
    }
  }

  return { ok: true, url: parsed.toString() };
}

export async function resolveSafeTargetUrl(
  baseUrl: string,
  relativeOrAbsolute: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const trimmedBase = baseUrl.trim();
  if (!trimmedBase) {
    return { ok: false, error: "Invalid base URL" };
  }

  let resolvedUrl: string;
  try {
    resolvedUrl = new URL(relativeOrAbsolute, trimmedBase).toString();
  } catch {
    return { ok: false, error: "Invalid request URL" };
  }

  return assertSafeTargetUrl(resolvedUrl);
}

function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isBlockedIpv4(ip);
  if (v === 6) return isBlockedIpv6(ip);
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10, multicast/broadcast
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  // IPv4-mapped
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice(7);
    if (isIP(v4) === 4) return isBlockedIpv4(v4);
  }
  return false;
}
