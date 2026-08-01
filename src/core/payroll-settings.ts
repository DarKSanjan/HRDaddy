/**
 * Payroll module settings — reads/writes to OrganisationModule.settings JSON
 * for the "payroll" moduleId row.
 *
 * Lives in src/core because it needs dbAdmin access (OrganisationModule is
 * org-level config not subject to per-user RLS).
 */
import 'server-only'
import { Prisma } from '@prisma/client'
import { dbAdmin } from '@/core/db/admin'

export type PayrollComplexity = 'simple' | 'advanced'

interface PayrollModuleSettings {
  payrollComplexity: PayrollComplexity
}

/**
 * Get the payroll complexity mode for an org.
 * Defaults to "advanced" for all orgs (preserves existing OT behaviour).
 */
export async function getPayrollComplexity(orgId: string): Promise<PayrollComplexity> {
  const row = await dbAdmin.organisationModule.findUnique({
    where: { orgId_moduleId: { orgId, moduleId: 'payroll' } },
    select: { settings: true },
  })

  if (!row) return 'advanced'

  const settings = row.settings as Partial<PayrollModuleSettings> | null
  return settings?.payrollComplexity ?? 'advanced'
}

/**
 * Set the payroll complexity mode for an org.
 * Upserts the OrganisationModule row for "payroll".
 */
export async function setPayrollComplexity(
  orgId: string,
  complexity: PayrollComplexity,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? dbAdmin
  const existing = await client.organisationModule.findUnique({
    where: { orgId_moduleId: { orgId, moduleId: 'payroll' } },
    select: { settings: true },
  })

  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const newSettings = { ...currentSettings, payrollComplexity: complexity }

  await client.organisationModule.upsert({
    where: { orgId_moduleId: { orgId, moduleId: 'payroll' } },
    update: { settings: newSettings },
    create: {
      orgId,
      moduleId: 'payroll',
      enabled: true,
      settings: newSettings,
    },
  })
}
