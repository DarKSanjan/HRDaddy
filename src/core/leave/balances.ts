import 'server-only'

import type { Prisma } from '@prisma/client'
import { sgAnnualLeaveEntitlement } from '@/core/calendar'
import { dbAdmin } from '@/core/db/admin'

/**
 * Leave balance provisioning.
 *
 * Two gaps this closes. Nothing created LeaveBalance rows at all — policies
 * were seeded during org setup but no employee ever received a balance, so the
 * request flow had nothing to read. And sgAnnualLeaveEntitlement existed with
 * passing tests but was never called, so entitlement never varied with tenure
 * even though Singapore annual leave is service-based.
 */

/** Completed years of service as at the given instant. */
export function completedYearsOfService(startDate: Date, asAt: Date): number {
  let years = asAt.getUTCFullYear() - startDate.getUTCFullYear()
  const beforeAnniversary =
    asAt.getUTCMonth() < startDate.getUTCMonth() ||
    (asAt.getUTCMonth() === startDate.getUTCMonth() &&
      asAt.getUTCDate() < startDate.getUTCDate())
  if (beforeAnniversary) years -= 1
  return Math.max(0, years)
}

/**
 * Allowance for one policy in one leave year.
 *
 * Entitlement is measured at the **end** of the leave year, so someone who
 * crosses an anniversary mid-year gets the higher figure for that year rather
 * than being frozen at their January tenure. Pro-rating applies in the year of
 * joining, by the fraction of the year actually worked.
 */
export function entitlementForYear(
  policy: { defaultAllowance: number; serviceBased: boolean },
  employeeStartDate: Date | null,
  year: number
): number {
  if (!policy.serviceBased) return policy.defaultAllowance
  if (!employeeStartDate) return 0

  const yearEnd = new Date(Date.UTC(year, 11, 31))
  if (employeeStartDate > yearEnd) return 0

  const full = sgAnnualLeaveEntitlement(
    completedYearsOfService(employeeStartDate, yearEnd)
  )
  if (full === 0) return 0

  // Joined during this year — pro-rate by days actually employed.
  if (employeeStartDate.getUTCFullYear() === year) {
    const yearStart = Date.UTC(year, 0, 1)
    const totalDays = (yearEnd.getTime() - yearStart) / 86_400_000 + 1
    const workedDays =
      (yearEnd.getTime() - employeeStartDate.getTime()) / 86_400_000 + 1
    // Half-day granularity, matching how leave is booked.
    return Math.round((full * workedDays) / totalDays * 2) / 2
  }

  return full
}

/**
 * Create or refresh every leave balance for one employee in one year.
 *
 * Idempotent, and never lowers `used` or `pending` — it only restates the
 * allowance, so re-running after a start-date correction is safe.
 */
export async function ensureLeaveBalances(
  tx: Prisma.TransactionClient,
  orgId: string,
  employeeId: string,
  year: number
): Promise<number> {
  const employee = await tx.employee.findFirst({
    where: { id: employeeId, orgId },
    select: { startDate: true },
  })
  if (!employee) return 0

  const policies = await tx.leavePolicy.findMany({
    where: { orgId },
    select: { leaveTypeId: true, defaultAllowance: true, serviceBased: true },
  })

  for (const policy of policies) {
    const allowance = entitlementForYear(
      {
        defaultAllowance: Number(policy.defaultAllowance),
        serviceBased: policy.serviceBased,
      },
      employee.startDate,
      year
    )

    await tx.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: policy.leaveTypeId,
          year,
        },
      },
      create: { orgId, employeeId, leaveTypeId: policy.leaveTypeId, year, allowance },
      update: { allowance },
    })
  }

  return policies.length
}

/**
 * ensureLeaveBalances, run in its own service-role transaction rather than a
 * caller-supplied one.
 *
 * Allowance is computed entirely server-side from leave policy + tenure —
 * never user input — but `leave_balances` INSERT/UPDATE is restricted to
 * OWNER/HR_ADMIN under RLS (see 00020_role_aware_rls). A regular employee
 * provisioning their own balance on first view of their leave page would
 * fail that check if run inside their own RLS-scoped transaction. This is
 * the entry point for that "provision on first read" path.
 */
export async function provisionLeaveBalances(
  orgId: string,
  employeeId: string,
  year: number
): Promise<number> {
  return dbAdmin.$transaction((tx) => ensureLeaveBalances(tx, orgId, employeeId, year))
}
