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
  // Resolve org timezone
  const orgSettings = await dbAdmin.organisationSettings.findUnique({
    where: { orgId },
    select: { timezone: true },
  })
  const orgTimezone = orgSettings?.timezone ?? 'UTC'

  // Resolve employee context for the viewer
  const employee = await dbAdmin.employee.findFirst({
    where: { orgId, userId, employmentStatus: 'ACTIVE' },
    select: { id: true },
  })

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
