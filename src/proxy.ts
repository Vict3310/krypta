import { randomBytes } from 'node:crypto'
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { apiLimiter } from '@/lib/rate-limit'

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'

  // Nonce-based strict CSP. In production there is no 'unsafe-inline'/'unsafe-eval':
  // only scripts carrying the per-request nonce (applied automatically by Next.js)
  // plus the explicit third-party hosts below may execute.
  // In development React needs 'unsafe-eval' for enhanced error stacks.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://vercel.live',
    'https://static.cloudflareinsights.com',
    ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
  ].join(' ')

  const csp = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    img-src 'self' data: blob: https:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://api.paystack.co https://sentry.io https://*.sentry.io https://cloudflareinsights.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `

  return csp.replace(/\s{2,}/g, ' ').trim()
}

export default async function proxy(request: NextRequest) {
  // Per-request nonce for strict CSP. Nonces require dynamic rendering — the
  // root layout sets `export const dynamic = 'force-dynamic'`.
  const nonce = randomBytes(16).toString('base64url')
  const cspHeader = buildCspHeader(nonce)

  // Next.js reads the nonce from the CSP header present in the REQUEST during
  // SSR (and applies it to its injected scripts), while the browser enforces
  // the CSP from the RESPONSE header — so set it in both places.
  request.headers.set('x-nonce', nonce)
  request.headers.set('Content-Security-Policy', cspHeader)

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const limiterKey = `${request.nextUrl.pathname}:${ip}`

  const result = await apiLimiter(limiterKey)
  if (!result.success) {
    return new Response('Too Many Requests', { status: 429 })
  }

  // Supabase auth middleware
  const response = await updateSession(request)
  response.headers.set('Content-Security-Policy', cspHeader)

  return response
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback|api/webhooks/.*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

// Note: auth/callback and webhook routes are excluded from the proxy
// so that Supabase can set session cookies without proxy interference,
// and so webhooks don't trigger auth redirects. Prefetch requests are
// excluded per Next.js CSP guidance (they are re-fetched on navigation).
