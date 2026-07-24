/**
 * Dashboard metric queries — aggregate in SQL, not JS.
 * All queries are org-scoped, timezone-correct, and run through dbAs (RLS).
 */
import 'server-only'

import { dbAs } from '@/core/db/client'
import { TZDate } from '@date-fns/tz'
import { startOfMonth, subMonths, addDays, format } from 'date-fns'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function getOrgToday(timezone: string): string {
  const now = new TZDate(Date.now(), timezone)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getOrgNow(timezone: string): TZDate {
  return new TZDate(Date.now(), timezone)
}

// ─────────────────────────────────────────────
// Stat tile queries
// ─────────────────────────────────────────────

export async function getActiveEmployeeCount(
  orgId: string,
  userId: string,
  managedEmployeeIds?: string[]
): Promise<number> {
  return dbAs(userId, async (tx) => {
    if (managedEmployeeIds && managedEmployeeIds.length > 0) {
      const result = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM employees
        WHERE org_id = ${orgId}
          AND employment_status = 'ACTIVE'
          AND id = ANY(${managedEmployeeIds}::text[])
      `
      return Number(result[0]?.count ?? 0)
    }
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM employees
      WHERE org_id = ${orgId}
        AND employment_status = 'ACTIVE'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getActiveEmployeeCountLastMonth(
  orgId: string,
  userId: string,
  timezone: string
): Promise<number> {
  const now = getOrgNow(timezone)
  const lastMonthEnd = startOfMonth(now)
  const lastMonthEndStr = format(lastMonthEnd, 'yyyy-MM-dd')

  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM employees
      WHERE org_id = ${orgId}
        AND employment_status = 'ACTIVE'
        AND (start_date IS NULL OR start_date::date < ${lastMonthEndStr}::date)
        AND (end_date IS NULL OR end_date::date >= ${lastMonthEndStr}::date)
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getPresentToday(
  orgId: string,
  userId: string,
  timezone: string,
  managedEmployeeIds?: string[]
): Promise<number> {
  const today = getOrgToday(timezone)

  return dbAs(userId, async (tx) => {
    if (managedEmployeeIds && managedEmployeeIds.length > 0) {
      const result = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT ar.employee_id)::bigint as count
        FROM attendance_records ar
        JOIN employees e ON ar.employee_id = e.id
        WHERE ar.org_id = ${orgId}
          AND ar.date::date = ${today}::date
          AND ar.status IN ('OPEN', 'CLOSED')
          AND e.employment_status = 'ACTIVE'
          AND ar.employee_id = ANY(${managedEmployeeIds}::text[])
      `
      return Number(result[0]?.count ?? 0)
    }
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT ar.employee_id)::bigint as count
      FROM attendance_records ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ar.org_id = ${orgId}
        AND ar.date::date = ${today}::date
        AND ar.status IN ('OPEN', 'CLOSED')
        AND e.employment_status = 'ACTIVE'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getOnLeaveToday(
  orgId: string,
  userId: string,
  timezone: string,
  managedEmployeeIds?: string[]
): Promise<number> {
  const today = getOrgToday(timezone)

  return dbAs(userId, async (tx) => {
    if (managedEmployeeIds && managedEmployeeIds.length > 0) {
      const result = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT lr.employee_id)::bigint as count
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.org_id = ${orgId}
          AND lr.status = 'APPROVED'
          AND lr.start_date::date <= ${today}::date
          AND lr.end_date::date >= ${today}::date
          AND e.employment_status = 'ACTIVE'
          AND lr.employee_id = ANY(${managedEmployeeIds}::text[])
      `
      return Number(result[0]?.count ?? 0)
    }
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT lr.employee_id)::bigint as count
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.org_id = ${orgId}
        AND lr.status = 'APPROVED'
        AND lr.start_date::date <= ${today}::date
        AND lr.end_date::date >= ${today}::date
        AND e.employment_status = 'ACTIVE'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getPendingLeaveCount(
  orgId: string,
  userId: string,
  managedEmployeeIds?: string[]
): Promise<number> {
  return dbAs(userId, async (tx) => {
    if (managedEmployeeIds && managedEmployeeIds.length > 0) {
      const result = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM leave_requests
        WHERE org_id = ${orgId}
          AND status = 'PENDING'
          AND employee_id = ANY(${managedEmployeeIds}::text[])
      `
      return Number(result[0]?.count ?? 0)
    }
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM leave_requests
      WHERE org_id = ${orgId}
        AND status = 'PENDING'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getOverdueOnboardingTaskCount(
  orgId: string,
  userId: string,
  timezone: string,
  managedEmployeeIds?: string[]
): Promise<number> {
  const today = getOrgToday(timezone)

  return dbAs(userId, async (tx) => {
    if (managedEmployeeIds && managedEmployeeIds.length > 0) {
      const result = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM employee_onboarding_tasks eot
        JOIN employee_onboardings eo ON eot.onboarding_id = eo.id
        WHERE eo.org_id = ${orgId}
          AND eo.status IN ('NOT_STARTED', 'IN_PROGRESS')
          AND eot.status IN ('PENDING', 'IN_PROGRESS')
          AND eot.due_date IS NOT NULL
          AND eot.due_date::date < ${today}::date
          AND eo.employee_id = ANY(${managedEmployeeIds}::text[])
      `
      return Number(result[0]?.count ?? 0)
    }
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM employee_onboarding_tasks eot
      JOIN employee_onboardings eo ON eot.onboarding_id = eo.id
      WHERE eo.org_id = ${orgId}
        AND eo.status IN ('NOT_STARTED', 'IN_PROGRESS')
        AND eot.status IN ('PENDING', 'IN_PROGRESS')
        AND eot.due_date IS NOT NULL
        AND eot.due_date::date < ${today}::date
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getExpiringDocumentCount(
  orgId: string,
  userId: string,
  timezone: string,
  managedEmployeeIds?: string[]
): Promise<number> {
  const today = getOrgToday(timezone)
  const thirtyDaysLater = format(addDays(new Date(today), 30), 'yyyy-MM-dd')

  return dbAs(userId, async (tx) => {
    if (managedEmployeeIds && managedEmployeeIds.length > 0) {
      const result = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM employee_documents ed
        JOIN employees e ON ed.employee_id = e.id
        WHERE ed.org_id = ${orgId}
          AND ed.is_archived = false
          AND ed.expires_at IS NOT NULL
          AND ed.expires_at::date >= ${today}::date
          AND ed.expires_at::date <= ${thirtyDaysLater}::date
          AND e.employment_status = 'ACTIVE'
          AND ed.employee_id = ANY(${managedEmployeeIds}::text[])
      `
      return Number(result[0]?.count ?? 0)
    }
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM employee_documents ed
      JOIN employees e ON ed.employee_id = e.id
      WHERE ed.org_id = ${orgId}
        AND ed.is_archived = false
        AND ed.expires_at IS NOT NULL
        AND ed.expires_at::date >= ${today}::date
        AND ed.expires_at::date <= ${thirtyDaysLater}::date
        AND e.employment_status = 'ACTIVE'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export interface PayrollStatusResult {
  name: string
  status: string
  endDate: Date
}

export async function getPayrollStatus(
  orgId: string,
  userId: string
): Promise<PayrollStatusResult | null> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { name: string; status: string; end_date: Date }[]
    >`
      SELECT name, status, end_date
      FROM payroll_periods
      WHERE org_id = ${orgId}
      ORDER BY end_date DESC
      LIMIT 1
    `
    if (!result[0]) return null
    return {
      name: result[0].name,
      status: result[0].status,
      endDate: result[0].end_date,
    }
  })
}
