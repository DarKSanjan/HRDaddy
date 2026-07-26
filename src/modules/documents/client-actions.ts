'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

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
