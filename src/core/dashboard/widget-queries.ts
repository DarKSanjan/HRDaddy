/**
 * Dashboard widget queries for assets, expenses, and performance modules.
 * Same pattern as queries.ts / chart-queries.ts: org-scoped, RLS-respecting via dbAs.
 */
import 'server-only'

import { dbAs } from '@/core/db/client'
import { TZDate } from '@date-fns/tz'
import { subMonths, startOfMonth, endOfMonth, format, addDays } from 'date-fns'

// ─────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────

export interface AssetStatusBreakdown {
  available: number
  assigned: number
  inMaintenance: number
}

export async function getAssetStatusBreakdown(
  orgId: string,
  userId: string
): Promise<AssetStatusBreakdown> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { status: string; count: bigint }[]
    >`
      SELECT status, COUNT(*)::bigint as count
      FROM assets
      WHERE org_id = ${orgId}
        AND status IN ('AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE')
      GROUP BY status
    `

    const counts: AssetStatusBreakdown = { available: 0, assigned: 0, inMaintenance: 0 }
    for (const r of result) {
      if (r.status === 'AVAILABLE') counts.available = Number(r.count)
      else if (r.status === 'ASSIGNED') counts.assigned = Number(r.count)
      else if (r.status === 'IN_MAINTENANCE') counts.inMaintenance = Number(r.count)
    }
    return counts
  })
}

export async function getMyAssignedAssetCount(
  orgId: string,
  userId: string,
  employeeId: string
): Promise<number> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM assets a
      JOIN asset_assignments aa ON a.current_assignment_id = aa.id
      WHERE a.org_id = ${orgId}
        AND aa.employee_id = ${employeeId}
        AND a.status = 'ASSIGNED'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getPendingAssetRequestCount(
  orgId: string,
  userId: string
): Promise<number> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM asset_requests
      WHERE org_id = ${orgId}
        AND status = 'PENDING'
    `
    return Number(result[0]?.count ?? 0)
  })
}

// ─────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────

export interface PendingExpenseSummary {
  count: number
  totalAmountCents: number
}

export async function getPendingExpenseClaims(
  orgId: string,
  userId: string
): Promise<PendingExpenseSummary> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { count: bigint; total_amount: bigint }[]
    >`
      SELECT
        COUNT(*)::bigint as count,
        COALESCE(SUM(amount_cents), 0)::bigint as total_amount
      FROM expense_claims
      WHERE org_id = ${orgId}
        AND status = 'SUBMITTED'
    `
    return {
      count: Number(result[0]?.count ?? 0),
      totalAmountCents: Number(result[0]?.total_amount ?? 0),
    }
  })
}

export interface MyExpenseSummary {
  submittedCount: number
  pendingAmountCents: number
}

export async function getMyExpenseSummary(
  orgId: string,
  userId: string,
  employeeId: string,
  timezone: string
): Promise<MyExpenseSummary> {
  const now = new TZDate(Date.now(), timezone)
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')

  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { count: bigint; pending_amount: bigint }[]
    >`
      SELECT
        COUNT(*)::bigint as count,
        COALESCE(SUM(CASE WHEN status IN ('SUBMITTED', 'APPROVED') THEN amount_cents ELSE 0 END), 0)::bigint as pending_amount
      FROM expense_claims
      WHERE org_id = ${orgId}
        AND employee_id = ${employeeId}
        AND created_at >= ${monthStart}::date
    `
    return {
      submittedCount: Number(result[0]?.count ?? 0),
      pendingAmountCents: Number(result[0]?.pending_amount ?? 0),
    }
  })
}

export interface ExpenseMonthData {
  month: string
  amount: number
}

export async function getExpenseTrend(
  orgId: string,
  userId: string,
  timezone: string
): Promise<ExpenseMonthData[]> {
  const now = new TZDate(Date.now(), timezone)
  const monthStart = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { month_start: Date; total_cents: bigint }[]
    >`
      WITH months AS (
        SELECT generate_series(
          ${monthStart}::date,
          ${monthEnd}::date,
          '1 month'::interval
        )::date AS month_start
      )
      SELECT
        m.month_start,
        COALESCE(SUM(ec.amount_cents), 0)::bigint as total_cents
      FROM months m
      LEFT JOIN expense_claims ec
        ON ec.org_id = ${orgId}
          AND ec.status = 'APPROVED'
          AND ec.expense_date >= m.month_start
          AND ec.expense_date < (m.month_start + INTERVAL '1 month')::date
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `

    return result.map((r) => ({
      month: format(new Date(r.month_start), 'MMM'),
      amount: Number(r.total_cents) / 100,
    }))
  })
}

// ─────────────────────────────────────────────
// Performance
// ─────────────────────────────────────────────

export interface ActiveCycleInfo {
  id: string
  name: string
  status: string
  totalReviews: number
  submittedReviews: number
}

export async function getActiveCycleInfo(
  orgId: string,
  userId: string
): Promise<ActiveCycleInfo | null> {
  return dbAs(userId, async (tx) => {
    const cycle = await tx.performanceCycle.findFirst({
      where: { orgId, status: 'ACTIVE' },
      include: {
        reviews: { select: { status: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    if (!cycle) return null

    return {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      totalReviews: cycle.reviews.length,
      submittedReviews: cycle.reviews.filter(
        (r) => r.status === 'SUBMITTED' || r.status === 'PUBLISHED'
      ).length,
    }
  })
}

export async function getMyPendingReviewCount(
  orgId: string,
  userId: string,
  employeeId: string
): Promise<number> {
  return dbAs(userId, async (tx) => {
    // Count reviews where the employee is either the subject or the reviewer
    // and the review is still PENDING
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM performance_reviews pr
      JOIN performance_cycles pc ON pr.cycle_id = pc.id
      WHERE pr.org_id = ${orgId}
        AND pc.status = 'ACTIVE'
        AND pr.status = 'PENDING'
        AND (pr.employee_id = ${employeeId} OR pr.reviewer_id = ${employeeId})
    `
    return Number(result[0]?.count ?? 0)
  })
}

// ─────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────

import type { OrgRole } from '@prisma/client'

export interface UpcomingCalendarItem {
  date: Date
  label: string
  type: 'holiday' | 'birthday' | 'anniversary' | 'event' | 'performance' | 'payroll' | 'leave'
}

export async function getUpcomingCalendarItems(
  orgId: string,
  userId: string,
  role: OrgRole,
  timezone: string
): Promise<UpcomingCalendarItem[]> {
  const now = new TZDate(Date.now(), timezone)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = addDays(start, 14)

  const items: UpcomingCalendarItem[] = []

  const holidays = await dbAs(userId, async (tx) => {
    return tx.holiday.findMany({
      where: { orgId, date: { gte: start, lte: end } },
      select: { date: true, name: true },
      orderBy: { date: 'asc' },
    })
  })

  for (const h of holidays) {
    items.push({ date: h.date, label: h.name, type: 'holiday' })
  }

  const myLeave = await dbAs(userId, async (tx) => {
    const emp = await tx.employee.findFirst({
      where: { orgId, userId },
      select: { id: true },
    })
    if (!emp) return []
    return tx.leaveRequest.findMany({
      where: {
        employeeId: emp.id,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { leaveType: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
      take: 3,
    })
  })

  for (const lr of myLeave) {
    items.push({ date: lr.startDate, label: lr.leaveType.name, type: 'leave' })
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime())
  return items.slice(0, 5)
}
