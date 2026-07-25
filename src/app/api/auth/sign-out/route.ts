import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/core/auth/supabase-server'

/**
 * Sign out.
 *
 * A route handler rather than a server action because the shell submits a real
 * form, which keeps sign-out working without JavaScript. POST only — signing
 * out is a state change, and a GET endpoint would let any <img> tag on any page
 * log the user out.
 *
 * Clearing Supabase's cookies is the whole job; the redirect afterwards is just
 * where the person lands.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()

  // 303 so the browser follows with GET rather than re-POSTing to /sign-in.
  return NextResponse.redirect(new URL('/sign-in', request.url), {
    status: 303,
  })
}
