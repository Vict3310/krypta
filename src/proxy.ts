import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { apiLimiter } from '@/lib/rate-limit'

export default async function proxy(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const limiterKey = `${request.nextUrl.pathname}:${ip}`

  const result = await apiLimiter(limiterKey)
  if (!result.success) {
    return new Response('Too Many Requests', { status: 429 })
  }

  // Supabase auth middleware
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth\\/callback|api\\/webhooks\\/github).*)',
  ],
}

// Note: auth/callback and api/webhooks/github are excluded from middleware
// so that Supabase can set session cookies without middleware interference,
// and so GitHub webhooks don't trigger auth redirects.
