/**
 * Performance module settings — reads/writes to OrganisationModule.settings JSON
 * for the "performance" moduleId row.
 *
 * Lives in src/core because it needs dbAdmin access (OrganisationModule is
 * org-level config not subject to per-user RLS).
 */
import 'server-only'
import { Prisma } from '@prisma/client'
import { dbAdmin } from '@/core/db/admin'

export type ReviewComplexity = 'simple' | 'advanced'

interface PerformanceModuleSettings {
  reviewComplexity: ReviewComplexity
}

/**
 * Get the review complexity mode for an org.
 * Defaults to "simple" — lower-friction starting point for orgs that have
 * never done a review cycle before.
 */
export async function getReviewComplexity(orgId: string): Promise<ReviewComplexity> {
  const row = await dbAdmin.organisationModule.findUnique({
    where: { orgId_moduleId: { orgId, moduleId: 'performance' } },
    select: { settings: true },
  })

  if (!row) return 'simple'

  const settings = row.settings as Partial<PerformanceModuleSettings> | null
  return settings?.reviewComplexity ?? 'simple'
}

/**
 * Set the review complexity mode for an org.
 * Upserts the OrganisationModule row for "performance".
 */
export async function setReviewComplexity(
  orgId: string,
  complexity: ReviewComplexity,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? dbAdmin
  const existing = await client.organisationModule.findUnique({
    where: { orgId_moduleId: { orgId, moduleId: 'performance' } },
    select: { settings: true },
  })

  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const newSettings = { ...currentSettings, reviewComplexity: complexity }

  await client.organisationModule.upsert({
    where: { orgId_moduleId: { orgId, moduleId: 'performance' } },
    update: { settings: newSettings },
    create: {
      orgId,
      moduleId: 'performance',
      enabled: true,
      settings: newSettings,
    },
  })
}
