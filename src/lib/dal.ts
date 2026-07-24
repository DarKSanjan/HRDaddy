'use server'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './auth'
import { db } from './db'
import { hasPermission, type Permission } from './permissions'
import type { OrgRole } from '@prisma/client'

export interface VerifiedSession {
  userId: string
  email: string
  name: string
}

/**
 * Verify the current user session. Cached per request.
 * Redirects to sign-in if no valid session exists.
 */
export const verifySession = cache(async (): Promise<VerifiedSession> => {
  const session = await getSession()
  if (!session) {
    redirect('/sign-in')
  }
  return session
})

/**
 * Get an organisation by its slug.
 * Returns null if not found.
 */
export async function getOrgBySlug(slug: string) {
  return db.organisation.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  })
}

/**
 * Get the user's membership in an organisation.
 * Returns null if the user is not a member.
 */
export async function getOrgMembership(userId: string, orgId: string) {
  return db.organisationMembership.findUnique({
    where: {
      userId_orgId: { userId, orgId },
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  })
}

/**
 * Require that the current user has a specific permission in an org.
 * Throws a redirect to sign-in if no session, or throws an error if no permission.
 */
export async function requirePermission(
  orgId: string,
  permission: Permission
): Promise<{ userId: string; role: OrgRole }> {
  const session = await verifySession()
  const membership = await getOrgMembership(session.userId, orgId)

  if (!membership || !membership.isActive) {
    redirect('/sign-in')
  }

  if (!hasPermission(membership.role, permission)) {
    throw new Error('You do not have permission to perform this action')
  }

  return { userId: session.userId, role: membership.role }
}
