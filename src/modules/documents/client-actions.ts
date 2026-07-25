'use server'

/**
 * Client-callable server actions for the documents module, used by employee profile tabs.
 */
import { getOrgContext, requirePermission } from '@/core/auth'
import { listDocuments } from './queries'
import { hasPermission } from '@/core/permissions'
import type { ActionResult } from '@/modules/employees/actions'

export async function fetchEmployeeDocuments(
  orgSlug: string,
  employeeId: string
): Promise<ActionResult & { data?: { documents: unknown[] } }> {
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)

  // Check if viewer can see all docs or only their own
  const canViewAll = hasPermission(membership.role, enabledModules, 'document.view_all')
  const canViewOwn = hasPermission(membership.role, enabledModules, 'document.view_own')

  if (!canViewAll && !canViewOwn) {
    return { success: false, error: 'Permission denied' }
  }

  const { userId } = await requirePermission(org.id, canViewAll ? 'document.view_all' : 'document.view_own')

  const { documents } = await listDocuments(userId, org.id, {
    employeeId,
    pageSize: 50,
  }, { viewAll: canViewAll, excludeSensitive: !canViewAll })

  return { success: true, data: { documents } }
}
