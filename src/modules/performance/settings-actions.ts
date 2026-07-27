'use server'

import '@/modules/register'

import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import { setReviewComplexity, type ReviewComplexity } from './settings'

export interface ToggleResult {
  success: boolean
  error?: string
}

/**
 * Toggle performance review complexity mode between "simple" and "advanced".
 * Requires the same permission that gates Settings > Organisation (department.manage).
 */
export async function togglePerformanceReviewComplexity(
  orgSlug: string,
  complexity: ReviewComplexity
): Promise<ToggleResult> {
  if (complexity !== 'simple' && complexity !== 'advanced') {
    return { success: false, error: 'Invalid complexity mode.' }
  }

  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'department.manage')

  await setReviewComplexity(org.id, complexity)

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'performance.toggle_complexity',
    targetType: 'organisation_module',
    targetId: org.id,
    after: { reviewComplexity: complexity },
  })

  revalidatePath(`/${orgSlug}/settings`)
  revalidatePath(`/${orgSlug}/performance`)
  revalidatePath(`/${orgSlug}/employees`)

  return { success: true }
}
