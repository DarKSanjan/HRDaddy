import { OrgRole } from '@prisma/client'
import { db } from './db'
import { getSession } from './auth'
import { Errors } from './errors'

export interface OrgContext {
  userId: string
  orgId: string
  role: OrgRole
  membershipId: string
}

/**
 * Get the organisation context from session and org slug.
 * Validates that the user is an active member of the organisation.
 */
export async function getOrgContext(orgSlug: string): Promise<OrgContext> {
  const session = await getSession()
  if (!session) {
    throw Errors.unauthorized()
  }

  const org = await db.organisation.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  })

  if (!org) {
    throw Errors.notFound('Organisation')
  }

  const membership = await db.organisationMembership.findUnique({
    where: {
      userId_orgId: {
        userId: session.userId,
        orgId: org.id,
      },
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  })

  if (!membership || !membership.isActive) {
    throw Errors.forbidden('You are not a member of this organisation')
  }

  return {
    userId: session.userId,
    orgId: org.id,
    role: membership.role,
    membershipId: membership.id,
  }
}

/**
 * Validate that the user has an active membership in the given org.
 * Returns the membership details or throws.
 */
export async function validateMembership(
  userId: string,
  orgId: string
): Promise<{ id: string; role: OrgRole }> {
  const membership = await db.organisationMembership.findUnique({
    where: {
      userId_orgId: {
        userId,
        orgId,
      },
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  })

  if (!membership || !membership.isActive) {
    throw Errors.forbidden('Membership not found or inactive')
  }

  return { id: membership.id, role: membership.role }
}
