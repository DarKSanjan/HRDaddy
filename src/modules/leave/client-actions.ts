'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Client-callable server actions for the leave module, used by employee profile tabs.
 */
import { getOrgContext, verifySession } from '@/core/auth'
import { hasPermission } from '@/core/permissions'
import { getEmployeeBalances, listOwnLeaveRequests } from './queries'
import type { ActionResult } from '@/modules/employees/actions'

export async function fetchEmployeeLeave(
  orgSlug: string,
  employeeId: string
): Promise<ActionResult & { data?: { balances: unknown[]; requests: unknown[] } }> {
  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)

  const canViewAll = hasPermission(membership.role, enabledModules, 'leave.balance.view_all')
  const canViewOwn = hasPermission(membership.role, enabledModules, 'leave.balance.view_own')

  if (!canViewAll && !canViewOwn) {
    return { success: false, error: 'Permission denied' }
  }

  const balances = await getEmployeeBalances(
    session.userId,
    org.id,
    employeeId,
    new Date().getFullYear()
  )

  // Use listOwnLeaveRequests which accepts employeeId filter directly
  const { requests } = await listOwnLeaveRequests(session.userId, org.id, employeeId, {
    page: 1,
    pageSize: 20,
  })

  // Map to a simpler format for the client component
  const mappedBalances = balances.map((b) => ({
    id: b.id,
    leaveType: { id: b.leaveTypeId, name: b.leaveTypeName },
    entitled: b.allowance,
    used: b.used,
    pending: b.pending,
    balance: b.available,
  }))

  const mappedRequests = requests.map((r) => ({
    id: r.id,
    leaveType: { name: r.leaveTypeName },
    startDate: r.startDate,
    endDate: r.endDate,
    days: r.totalDays,
    status: r.status,
    reason: r.reason,
  }))

  return { success: true, data: { balances: mappedBalances, requests: mappedRequests } }
}
