import 'server-only'

import { cache } from 'react'
import { createSupabaseServer } from './supabase-server'
import { dbAdmin } from '@/core/db/admin'

/**
 * Where a visitor to "/" belongs.
 *
 * Kept in the kernel because it needs dbAdmin: the caller's memberships have to
 * be read before an organisation context exists, so there is nothing for RLS to
 * scope against yet. Routing decisions live here rather than in the page so the
 * page has no reason to reach for the RLS-bypassing client.
 */
export type HomeDestination =
  | { kind: 'sign-in' }
  | { kind: 'onboarding' }
  | { kind: 'dashboard'; orgSlug: string }

export const resolveHomeDestination = cache(
  async (): Promise<HomeDestination> => {
    const supabase = await createSupabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { kind: 'sign-in' }

    const membership = await dbAdmin.organisationMembership.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { organisation: { select: { slug: true } } },
    })

    // Signed in but not yet in an organisation — the setup wizard is the only
    // meaningful destination. Sending them to /sign-in instead produced an
    // infinite bounce, because the proxy redirects authenticated visitors away
    // from the auth pages.
    if (!membership) return { kind: 'onboarding' }

    return { kind: 'dashboard', orgSlug: membership.organisation.slug }
  }
)

export function destinationToPath(dest: HomeDestination): string {
  switch (dest.kind) {
    case 'sign-in':
      return '/sign-in'
    case 'onboarding':
      return '/onboarding'
    case 'dashboard':
      return `/${dest.orgSlug}/dashboard`
  }
}
