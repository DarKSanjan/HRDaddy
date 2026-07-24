/**
 * Employee resolution helpers — resolves the employee record for a user
 * within an org context. Uses dbAdmin because it's called before RLS
 * scope exists (we need to know WHO the employee is to scope further queries).
 *
 * Located in src/core/ to satisfy the ESLint boundary rule for dbAdmin access.
 */
import { dbAdmin } from '@/core/db/admin'

/**
 * Get the employee record ID for a user within an org.
 * Returns null if no employee record exists.
 */
export async function getEmployeeIdForUser(
  orgId: string,
  userId: string
): Promise<string | null> {
  const employee = await dbAdmin.employee.findFirst({
    where: { orgId, userId },
    select: { id: true },
  })
  return employee?.id ?? null
}

/**
 * Get org settings (timezone, working days, working hours).
 */
export async function getOrgSettings(orgId: string) {
  return dbAdmin.organisationSettings.findUnique({
    where: { orgId },
  })
}
