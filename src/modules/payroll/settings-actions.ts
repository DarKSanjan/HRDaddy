'use server'

import '@/modules/register'

import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { setPayrollComplexity, type PayrollComplexity } from './settings'

export interface ToggleResult {
  success: boolean
  error?: string
}

/**
 * Toggle payroll complexity mode between "simple" and "advanced".
 * Requires the same permission that gates Settings > Organisation (department.manage).
 */
export async function togglePayrollComplexity(
  orgSlug: string,
  complexity: PayrollComplexity
): Promise<ToggleResult> {
  if (complexity !== 'simple' && complexity !== 'advanced') {
    return { success: false, error: 'Invalid complexity mode.' }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  await dbAs(userId, async (tx) => {
    await setPayrollComplexity(org.id, complexity, tx)

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'payroll.toggle_complexity',
      targetType: 'organisation_module',
      targetId: org.id,
      after: { payrollComplexity: complexity },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/settings`)
  revalidatePath(`/${orgSlug}/payroll`)
  revalidatePath(`/${orgSlug}/employees`)

  return { success: true }
}
