/**
 * Data Access Layer — auth-related queries, cache()-wrapped per request.
 */
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from './supabase-server'
import { dbAdmin } from '@/core/db/admin'
import { PermissionDeniedError } from '@/core/auth/errors'
import { hasPermission } from '@/core/permissions'
import type { OrgRole } from '@prisma/client'

export interface VerifiedSession {
  userId: string
  email: string
  name: string
}

export interface OrgContext {
  org: { id: string; name: string; slug: string }
  membership: { id: string; role: OrgRole; isActive: boolean }
  enabledModules: string[]
}

/**
 * Verify the current user session. Cached per request.
 * Redirects to /sign-in when absent.
 */
export const verifySession = cache(async (): Promise<VerifiedSession> => {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Look up the application user record
  const appUser = await dbAdmin.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, isActive: true },
  })

  if (!appUser || !appUser.isActive) {
    redirect('/sign-in')
  }

  return { userId: appUser.id, email: appUser.email, name: appUser.name }
})

/**
 * Get org context. Validates the caller's active membership.
 * Returns notFound() when the org does not exist OR the caller is not a member
 * — these must be indistinguishable.
 */
export const getOrgContext = cache(
  async (slug: string): Promise<OrgContext> => {
    const session = await verifySession()

    const org = await dbAdmin.organisation.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    })

    if (!org) {
      notFound()
    }

    const membership = await dbAdmin.organisationMembership.findUnique({
      where: {
        userId_orgId: { userId: session.userId, orgId: org.id },
      },
      select: { id: true, role: true, isActive: true },
    })

    if (!membership || !membership.isActive) {
      notFound()
    }

    // Get enabled modules for this org
    const orgModules = await dbAdmin.organisationModule.findMany({
      where: { orgId: org.id, enabled: true },
      select: { moduleId: true },
    })
    const enabledModules = orgModules.map((m) => m.moduleId)

    return { org, membership, enabledModules }
  }
)

/**
 * Require the caller to have a specific permission in an org.
 * Throws PermissionDeniedError when they do not.
 */
export async function requirePermission(
  orgId: string,
  key: string
): Promise<{ userId: string; role: OrgRole }> {
  const session = await verifySession()

  const membership = await dbAdmin.organisationMembership.findUnique({
    where: {
      userId_orgId: { userId: session.userId, orgId },
    },
    select: { role: true, isActive: true },
  })

  if (!membership || !membership.isActive) {
    throw new PermissionDeniedError(key)
  }

  // Get enabled modules for this org
  const orgModules = await dbAdmin.organisationModule.findMany({
    where: { orgId, enabled: true },
    select: { moduleId: true },
  })
  const enabledModules = orgModules.map((m) => m.moduleId)

  if (!hasPermission(membership.role, enabledModules, key)) {
    throw new PermissionDeniedError(key)
  }

  return { userId: session.userId, role: membership.role }
}
