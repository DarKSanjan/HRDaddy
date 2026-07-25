import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Explicit static-asset prefix allowlist.
 * Never match on the presence of a dot — that's a vulnerability.
 */
const STATIC_PREFIXES = ['/_next/', '/favicon.ico', '/robots.txt', '/sitemap.xml']

/**
 * Unauthenticated entry points. A signed-in visitor is bounced away from these.
 */
const AUTH_PAGES = ['/sign-in', '/sign-up']

/**
 * Auth protocol endpoints. Reachable signed-in or signed-out, and NEVER
 * redirected — the email-confirmation and OAuth exchanges land here already
 * holding a session, so bouncing them breaks the flow before the handler runs.
 */
const AUTH_FLOW_PATHS = [
  '/auth/callback',
  '/auth/confirm',
  '/api/auth/sign-out',
]

function matches(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets bypass entirely — matched by explicit prefix, never by dot.
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

/**
 * Refreshes the Supabase session via cookie handling.
 * Redirects to /sign-in for protected routes when no session exists.
 */
async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth protocol endpoints pass through untouched in both directions.
  if (matches(pathname, AUTH_FLOW_PATHS)) {
    return supabaseResponse
  }

  // No session on a protected route → sign in, remembering where they were.
  if (!user && !matches(pathname, AUTH_PAGES)) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Already signed in and asking for sign-in/sign-up → send them onward.
  if (user && matches(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
