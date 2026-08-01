/**
 * Dashboard context resolver — fetches org settings and employee context.
 * Lives in core/ so it can use dbAdmin legally.
 */
import 'server-only'

import { dbAdmin } from '@/core/db/admin'

export interface DashboardContext {
  orgTimezone: string
  employeeId: string | undefined
  managedEmployeeIds: string[] | undefined
}

/**
 * Resolve the dashboard context for a user in an org.
 * Fetches timezone, employee link, and manager's direct reports.
 */
export async function resolveDashboardContext(
  orgId: string,
  userId: string,
  role: string
): Promise<DashboardContext> {
  // Parallelize the two independent lookups
  const [orgSettings, employee] = await Promise.all([
    dbAdmin.organisationSettings.findUnique({
      where: { orgId },
      select: { timezone: true },
    }),
    dbAdmin.employee.findUnique({
      where: { orgId_userId: { orgId, userId }, employmentStatus: 'ACTIVE' },
      select: { id: true },
    }),
  ])

  const orgTimezone = orgSettings?.timezone ?? 'UTC'

  // For managers, get their direct reports
  let managedEmployeeIds: string[] | undefined
  if (role === 'MANAGER' && employee) {
    const reports = await dbAdmin.employee.findMany({
      where: { orgId, managerId: employee.id, employmentStatus: 'ACTIVE' },
      select: { id: true },
    })
    managedEmployeeIds = reports.map((r) => r.id)
  }

  return {
    orgTimezone,
    employeeId: employee?.id,
    managedEmployeeIds,
  }
}
