/**
 * Organisation setup service — lives in core because it uses dbAdmin
 * for pre-RLS operations (creating the org itself).
 */
import { randomUUID } from 'crypto'
import { dbAdmin } from '@/core/db/admin'
import type { WizardData } from '@/app/(auth)/onboarding/schemas'
import { RESERVED_SLUGS } from '@/app/(auth)/onboarding/schemas'

export interface SetupResult {
  org: { id: string; name: string; slug: string }
}

export interface SlugCheckResult {
  available: boolean
  reason?: string
}

/**
 * Check if a slug is available (not reserved and not taken).
 */
export async function checkSlugAvailable(slug: string): Promise<SlugCheckResult> {
  const normalized = slug.toLowerCase().trim()

  if (normalized.length < 3) {
    return { available: false, reason: 'Slug must be at least 3 characters' }
  }

  if (RESERVED_SLUGS.has(normalized)) {
    return { available: false, reason: 'This slug is reserved' }
  }

  const existing = await dbAdmin.organisation.findUnique({
    where: { slug: normalized },
    select: { id: true },
  })

  if (existing) {
    return { available: false, reason: 'This slug is already taken' }
  }

  return { available: true }
}

/**
 * Get the user's current org setup progress.
 */
export async function getOrgSetupProgress(userId: string) {
  return dbAdmin.orgSetupProgress.findUnique({
    where: { userId },
  })
}

/**
 * Save org setup progress (upsert).
 */
export async function saveOrgSetupProgress(userId: string, step: number, data: unknown) {
  await dbAdmin.orgSetupProgress.upsert({
    where: { userId },
    create: { userId, step, data: data as object },
    update: { step, data: data as object },
  })
}

/**
 * Commit the full organisation creation in a single transaction.
 * Returns the new org or throws.
 */
export async function commitOrgSetup(
  userId: string,
  wizardData: WizardData
): Promise<SetupResult> {
  const { step2, step3, step4, step5 } = wizardData

  if (!step2 || !step3 || !step4) {
    throw new Error('Incomplete wizard data')
  }

  const invitations = step5?.invitations ?? []

  const newOrg = await dbAdmin.$transaction(async (tx) => {
    // 1. Create Organisation
    const org = await tx.organisation.create({
      data: {
        name: step2.legalName,
        slug: step2.slug,
      },
    })

    // 2. Create OrganisationSettings
    await tx.organisationSettings.create({
      data: {
        orgId: org.id,
        timezone: step2.timezone,
        currency: step2.currency,
        workingDays: step2.workingDays,
        workingHoursStart: step2.workingHoursStart,
        workingHoursEnd: step2.workingHoursEnd,
        leaveYearStart: step2.leaveYearStart,
      },
    })

    // 3. Create membership as OWNER
    await tx.organisationMembership.create({
      data: {
        userId,
        orgId: org.id,
        role: 'OWNER',
        isActive: true,
      },
    })

    // Steps 4-8 use createMany rather than a create() per row.
    //
    // The per-row version issued one round trip each — modules, departments,
    // job titles, a leave type *and* a policy per leave type, then one per
    // invitation. Against the Singapore pooler that is 30-40 sequential
    // round trips, which overran Prisma's 5s interactive-transaction budget
    // and failed with "a query cannot be executed on an expired transaction".
    // Batched, it is six.

    // 4. Enabled modules
    await tx.organisationModule.createMany({
      data: step3.modules.map((moduleId) => ({
        orgId: org.id,
        moduleId,
        enabled: true,
      })),
    })

    // 5. Departments
    if (step4.departments.length > 0) {
      await tx.department.createMany({
        data: step4.departments.map((dept) => ({
          orgId: org.id,
          name: dept.name,
        })),
      })
    }

    // 6. Job titles
    if (step4.jobTitles.length > 0) {
      await tx.jobTitle.createMany({
        data: step4.jobTitles.map((jt) => ({
          orgId: org.id,
          name: jt.title,
        })),
      })
    }

    // 7. Leave types and their policies, when the leave module is on.
    // Ids are generated here so the policies can reference their types
    // without reading the rows back.
    if (step3.modules.includes('leave') && step4.leaveTypes.length > 0) {
      const withIds = step4.leaveTypes.map((lt) => ({
        id: randomUUID(),
        ...lt,
      }))

      await tx.leaveType.createMany({
        data: withIds.map((lt) => ({
          id: lt.id,
          orgId: org.id,
          name: lt.name,
        })),
      })

      await tx.leavePolicy.createMany({
        data: withIds.map((lt) => ({
          orgId: org.id,
          leaveTypeId: lt.id,
          defaultAllowance: lt.daysPerYear,
        })),
      })
    }

    // 8. Invitations
    if (invitations.length > 0) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await tx.invitation.createMany({
        data: invitations.map((inv) => ({
          orgId: org.id,
          email: inv.email,
          role: inv.role,
          token: randomUUID(),
          expiresAt,
        })),
      })
    }

    // 9. Drop the wizard progress row — the organisation now exists.
    await tx.orgSetupProgress.delete({
      where: { userId },
    })

    return org
  }, {
    // Headroom for slow links. The work is now batched, so this is a safety
    // net rather than the thing making it fit.
    timeout: 30_000,
    maxWait: 10_000,
  })

  return { org: newOrg }
}
