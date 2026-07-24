/**
 * Dashboard chart queries — aggregate in SQL, not JS.
 * These return shaped data ready for chart components.
 */
import 'server-only'

import { dbAs } from '@/core/db/client'
import { TZDate } from '@date-fns/tz'
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  startOfWeek,
  addDays,
  eachDayOfInterval,
} from 'date-fns'
import { getOrgToday } from './queries'

// ─────────────────────────────────────────────
// Headcount over time (12 months)
// ─────────────────────────────────────────────

export interface HeadcountMonth {
  month: string
  active: number
  joiners: number
  leavers: number
}

export async function getHeadcountOverTime(
  orgId: string,
  userId: string,
  timezone: string
): Promise<HeadcountMonth[]> {
  const now = new TZDate(Date.now(), timezone)

  return dbAs(userId, async (tx) => {
    const months: HeadcountMonth[] = []

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')
      const monthLabel = format(monthDate, 'MMM')

      // Active count at end of month
      const [activeResult] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM employees
        WHERE org_id = ${orgId}
          AND employment_status IN ('ACTIVE', 'SUSPENDED')
          AND (start_date IS NULL OR start_date::date <= ${monthEnd}::date)
          AND (end_date IS NULL OR end_date::date > ${monthEnd}::date)
      `

      // Joiners: started this month
      const [joinersResult] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM employees
        WHERE org_id = ${orgId}
          AND start_date IS NOT NULL
          AND start_date::date >= ${monthStart}::date
          AND start_date::date <= ${monthEnd}::date
      `

      // Leavers: ended this month
      const [leaversResult] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM employees
        WHERE org_id = ${orgId}
          AND end_date IS NOT NULL
          AND end_date::date >= ${monthStart}::date
          AND end_date::date <= ${monthEnd}::date
      `

      months.push({
        month: monthLabel,
        active: Number(activeResult?.count ?? 0),
        joiners: Number(joinersResult?.count ?? 0),
        leavers: Number(leaversResult?.count ?? 0),
      })
    }

    return months
  })
}

// ─────────────────────────────────────────────
// Headcount by department
// ─────────────────────────────────────────────

export interface DepartmentCount {
  department: string
  count: number
}

export async function getHeadcountByDepartment(
  orgId: string,
  userId: string
): Promise<DepartmentCount[]> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<{ department: string; count: bigint }[]>`
      SELECT
        COALESCE(d.name, 'Unassigned') as department,
        COUNT(e.id)::bigint as count
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.org_id = ${orgId}
        AND e.employment_status = 'ACTIVE'
      GROUP BY COALESCE(d.name, 'Unassigned')
      ORDER BY count DESC
    `
    return result.map((r) => ({
      department: r.department,
      count: Number(r.count),
    }))
  })
}

// ─────────────────────────────────────────────
// Attendance this week
// ─────────────────────────────────────────────

export interface WeekdayAttendance {
  day: string
  present: number
  remote: number
  onLeave: number
  absent: number
}

export async function getAttendanceThisWeek(
  orgId: string,
  userId: string,
  timezone: string
): Promise<WeekdayAttendance[]> {
  const now = new TZDate(Date.now(), timezone)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const weekEnd = addDays(weekStart, 4) // Friday

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  return dbAs(userId, async (tx) => {
    // Total active employees
    const [totalResult] = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM employees
      WHERE org_id = ${orgId}
        AND employment_status = 'ACTIVE'
    `
    const totalActive = Number(totalResult?.count ?? 0)

    const result: WeekdayAttendance[] = []

    for (let i = 0; i < days.length; i++) {
      const dayStr = format(days[i], 'yyyy-MM-dd')

      // Office attendance
      const [officeResult] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT employee_id)::bigint as count
        FROM attendance_records
        WHERE org_id = ${orgId}
          AND date::date = ${dayStr}::date
          AND status IN ('OPEN', 'CLOSED')
          AND type = 'OFFICE'
      `

      // Remote attendance
      const [remoteResult] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT employee_id)::bigint as count
        FROM attendance_records
        WHERE org_id = ${orgId}
          AND date::date = ${dayStr}::date
          AND status IN ('OPEN', 'CLOSED')
          AND type = 'REMOTE'
      `

      // On leave
      const [leaveResult] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT lr.employee_id)::bigint as count
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.org_id = ${orgId}
          AND lr.status = 'APPROVED'
          AND lr.start_date::date <= ${dayStr}::date
          AND lr.end_date::date >= ${dayStr}::date
          AND e.employment_status = 'ACTIVE'
      `

      const present = Number(officeResult?.count ?? 0)
      const remote = Number(remoteResult?.count ?? 0)
      const onLeave = Number(leaveResult?.count ?? 0)
      const absent = Math.max(0, totalActive - present - remote - onLeave)

      result.push({
        day: dayNames[i],
        present,
        remote,
        onLeave,
        absent,
      })
    }

    return result
  })
}

// ─────────────────────────────────────────────
// Leave usage by type (current year)
// ─────────────────────────────────────────────

export interface LeaveUsageByType {
  name: string
  value: number
  colorIndex: number
}

export async function getLeaveUsageByType(
  orgId: string,
  userId: string,
  timezone: string
): Promise<LeaveUsageByType[]> {
  const now = new TZDate(Date.now(), timezone)
  const year = now.getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { name: string; total_days: number }[]
    >`
      SELECT
        lt.name,
        COALESCE(SUM(lr.total_days), 0)::float as total_days
      FROM leave_types lt
      LEFT JOIN leave_requests lr
        ON lr.leave_type_id = lt.id
        AND lr.status = 'APPROVED'
        AND lr.start_date::date >= ${yearStart}::date
        AND lr.start_date::date <= ${yearEnd}::date
      WHERE lt.org_id = ${orgId}
      GROUP BY lt.name, lt.created_at
      ORDER BY lt.created_at ASC
    `
    return result
      .filter((r) => r.total_days > 0)
      .map((r, i) => ({
        name: r.name,
        value: Number(r.total_days),
        colorIndex: i,
      }))
  })
}

// ─────────────────────────────────────────────
// Upcoming birthdays (7 days)
// ─────────────────────────────────────────────

export interface UpcomingBirthday {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: Date
  isToday: boolean
}

export async function getUpcomingBirthdays(
  orgId: string,
  userId: string,
  timezone: string
): Promise<UpcomingBirthday[]> {
  const today = getOrgToday(timezone)
  const sevenDaysLater = format(addDays(new Date(today), 7), 'yyyy-MM-dd')

  return dbAs(userId, async (tx) => {
    // Use a date range approach: find birthdays whose month-day falls within next 7 days
    const result = await tx.$queryRaw<
      { id: string; first_name: string; last_name: string; date_of_birth: Date }[]
    >`
      SELECT id, first_name, last_name, date_of_birth
      FROM employees
      WHERE org_id = ${orgId}
        AND employment_status = 'ACTIVE'
        AND date_of_birth IS NOT NULL
        AND (
          TO_CHAR(date_of_birth, 'MM-DD') >= TO_CHAR(${today}::date, 'MM-DD')
          AND TO_CHAR(date_of_birth, 'MM-DD') <= TO_CHAR(${sevenDaysLater}::date, 'MM-DD')
        )
      ORDER BY TO_CHAR(date_of_birth, 'MM-DD') ASC
      LIMIT 10
    `

    const todayDate = new Date(today)
    const todayMonth = todayDate.getMonth() + 1
    const todayDay = todayDate.getDate()

    return result.map((r) => {
      const dob = new Date(r.date_of_birth)
      return {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        dateOfBirth: r.date_of_birth,
        isToday: dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay,
      }
    })
  })
}

// ─────────────────────────────────────────────
// Upcoming work anniversaries (7 days)
// ─────────────────────────────────────────────

export interface UpcomingAnniversary {
  id: string
  firstName: string
  lastName: string
  startDate: Date
  years: number
  isToday: boolean
}

export async function getUpcomingAnniversaries(
  orgId: string,
  userId: string,
  timezone: string
): Promise<UpcomingAnniversary[]> {
  const today = getOrgToday(timezone)
  const todayDate = new Date(today)
  const currentYear = todayDate.getFullYear()
  const sevenDaysLater = format(addDays(todayDate, 7), 'yyyy-MM-dd')

  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { id: string; first_name: string; last_name: string; start_date: Date }[]
    >`
      SELECT id, first_name, last_name, start_date
      FROM employees
      WHERE org_id = ${orgId}
        AND employment_status = 'ACTIVE'
        AND start_date IS NOT NULL
        AND start_date::date < ${today}::date - INTERVAL '1 year'
        AND (
          TO_CHAR(start_date, 'MM-DD') >= TO_CHAR(${today}::date, 'MM-DD')
          AND TO_CHAR(start_date, 'MM-DD') <= TO_CHAR(${sevenDaysLater}::date, 'MM-DD')
        )
      ORDER BY TO_CHAR(start_date, 'MM-DD') ASC
      LIMIT 10
    `

    const todayMonth = todayDate.getMonth() + 1
    const todayDay = todayDate.getDate()

    return result.map((r) => {
      const sd = new Date(r.start_date)
      return {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        startDate: r.start_date,
        years: currentYear - sd.getFullYear(),
        isToday: sd.getMonth() + 1 === todayMonth && sd.getDate() === todayDay,
      }
    })
  })
}

// ─────────────────────────────────────────────
// Recent activity (audit feed)
// ─────────────────────────────────────────────

export interface RecentActivityEntry {
  id: string
  action: string
  targetType: string
  actorName: string
  createdAt: Date
}

export async function getRecentActivity(
  orgId: string,
  userId: string
): Promise<RecentActivityEntry[]> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { id: string; action: string; target_type: string; actor_name: string; created_at: Date }[]
    >`
      SELECT
        al.id,
        al.action,
        al.target_type,
        u.name as actor_name,
        al.created_at
      FROM audit_logs al
      JOIN users u ON al.actor_id = u.id
      WHERE al.org_id = ${orgId}
      ORDER BY al.created_at DESC
      LIMIT 10
    `
    return result.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      actorName: r.actor_name,
      createdAt: r.created_at,
    }))
  })
}

// ─────────────────────────────────────────────
// Employee-specific queries
// ─────────────────────────────────────────────

export interface LeaveBalanceSummary {
  leaveType: string
  allowance: number
  used: number
  pending: number
  remaining: number
}

export async function getEmployeeLeaveBalances(
  orgId: string,
  userId: string,
  employeeId: string,
  timezone: string
): Promise<LeaveBalanceSummary[]> {
  const now = new TZDate(Date.now(), timezone)
  const year = now.getFullYear()

  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { name: string; allowance: number; used: number; pending: number }[]
    >`
      SELECT
        lt.name,
        lb.allowance::float as allowance,
        lb.used::float as used,
        lb.pending::float as pending
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.org_id = ${orgId}
        AND lb.employee_id = ${employeeId}
        AND lb.year = ${year}
      ORDER BY lt.created_at ASC
    `
    return result.map((r) => ({
      leaveType: r.name,
      allowance: r.allowance,
      used: r.used,
      pending: r.pending,
      remaining: r.allowance - r.used - r.pending,
    }))
  })
}

export async function getEmployeePendingRequests(
  orgId: string,
  userId: string,
  employeeId: string
): Promise<number> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM leave_requests
      WHERE org_id = ${orgId}
        AND employee_id = ${employeeId}
        AND status = 'PENDING'
    `
    return Number(result[0]?.count ?? 0)
  })
}

export async function getEmployeeOnboardingProgress(
  orgId: string,
  userId: string,
  employeeId: string
): Promise<{ total: number; completed: number } | null> {
  return dbAs(userId, async (tx) => {
    const result = await tx.$queryRaw<
      { total: bigint; completed: bigint }[]
    >`
      SELECT
        COUNT(*)::bigint as total,
        COUNT(*) FILTER (WHERE eot.status = 'COMPLETED')::bigint as completed
      FROM employee_onboarding_tasks eot
      JOIN employee_onboardings eo ON eot.onboarding_id = eo.id
      WHERE eo.org_id = ${orgId}
        AND eo.employee_id = ${employeeId}
        AND eo.status IN ('NOT_STARTED', 'IN_PROGRESS')
    `
    if (!result[0] || Number(result[0].total) === 0) return null
    return {
      total: Number(result[0].total),
      completed: Number(result[0].completed),
    }
  })
}
