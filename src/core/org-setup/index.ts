/**
 * Organisation setup service — lives in core because it uses dbAdmin
 * for pre-RLS operations (creating the org itself).
 */
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

    // 4. Create organisation_modules rows
    for (const moduleId of step3.modules) {
      await tx.organisationModule.create({
        data: {
          orgId: org.id,
          moduleId,
          enabled: true,
        },
      })
    }

    // 5. Seed departments
    for (const dept of step4.departments) {
      await tx.department.create({
        data: {
          orgId: org.id,
          name: dept.name,
        },
      })
    }

    // 6. Seed job titles
    for (const jt of step4.jobTitles) {
      await tx.jobTitle.create({
        data: {
          orgId: org.id,
          name: jt.title,
        },
      })
    }

    // 7. Seed leave types (if leave module is selected)
    if (step3.modules.includes('leave')) {
      for (const lt of step4.leaveTypes) {
        const leaveType = await tx.leaveType.create({
          data: {
            orgId: org.id,
            name: lt.name,
          },
        })
        // Create a matching policy with the default allowance
        await tx.leavePolicy.create({
          data: {
            orgId: org.id,
            leaveTypeId: leaveType.id,
            defaultAllowance: lt.daysPerYear,
          },
        })
      }
    }

    // 8. Create invitations
    for (const inv of invitations) {
      const token = crypto.randomUUID()
      await tx.invitation.create({
        data: {
          orgId: org.id,
          email: inv.email,
          role: inv.role,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })
    }

    // 9. Delete setup progress
    await tx.orgSetupProgress.delete({
      where: { userId },
    })

    return org
  })

  return { org: newOrg }
}
