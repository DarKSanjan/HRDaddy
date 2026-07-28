/**
 * Performance module queries — data fetching with role-scoped access.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import { getOrgSettings } from '@/core/employees'
import { resolveShift, computeShiftMetrics } from '../attendance/shift-helpers'
import type {
  PerformanceCycleStatus,
  PerformanceReviewStatus,
  PerformanceCompetency,
} from '@prisma/client'
export { computeOverallScore, suggestNextCycle } from './utils'
export type { CycleItemBase } from './utils'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CycleItem {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: PerformanceCycleStatus
  createdAt: Date
  totalReviews: number
  submittedReviews: number
}

export interface ReviewItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  reviewerId: string | null
  reviewerFirstName: string | null
  reviewerLastName: string | null
  overallScore: number | null
  strengths: string | null
  improvements: string | null
  goals: string | null
  selfAssessment: string | null
  status: PerformanceReviewStatus
  submittedAt: Date | null
  publishedAt: Date | null
  acknowledgedAt: Date | null
  competencyScores: Array<{
    competency: PerformanceCompetency
    score: number
  }>
  cycleName?: string
  cycleStartDate?: Date
}

export interface CalibrationManager {
  reviewerId: string
  reviewerName: string
  avgScore: number
  reviewCount: number
}

export interface CalibrationData {
  byManager: CalibrationManager[]
  orgAverage: number
}

export interface AutoMetrics {
  attendanceReliability: number // percentage 0–100
  daysPresent: number
  expectedWorkdays: number
  lateArrivals: number
  leaveDaysTaken: number
  totalHoursWorked: number
  overtimeHours: number
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

/**
 * List all cycles for an org, newest first.
 */
export async function listCycles(
  userId: string,
  orgId: string
): Promise<CycleItem[]> {
  return dbAs(userId, async (tx) => {
    const cycles = await tx.performanceCycle.findMany({
      where: { orgId },
      include: {
        reviews: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return cycles.map((c) => ({
      id: c.id,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      createdAt: c.createdAt,
      totalReviews: c.reviews.length,
      submittedReviews: c.reviews.filter(
        (r) => r.status === 'SUBMITTED' || r.status === 'PUBLISHED'
      ).length,
    }))
  })
}

/**
 * Get all reviews in a cycle with employee names and status.
 * Managers only see rows for their direct reports unless they hold view_all.
 */
export async function getCycleReviews(
  userId: string,
  orgId: string,
  cycleId: string,
  filterByManagerId?: string | null
): Promise<ReviewItem[]> {
  return dbAs(userId, async (tx) => {
    const where: Record<string, unknown> = { orgId, cycleId }
    if (filterByManagerId) {
      where.employee = { managerId: filterByManagerId }
    }

    const reviews = await tx.performanceReview.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
        competencyScores: { select: { competency: true, score: true } },
      },
      orderBy: { employee: { lastName: 'asc' } },
    })

    return reviews.map((r) => ({
      id: r.id,
      employeeId: r.employee.id,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      reviewerId: r.reviewer?.id ?? null,
      reviewerFirstName: r.reviewer?.firstName ?? null,
      reviewerLastName: r.reviewer?.lastName ?? null,
      overallScore: r.overallScore,
      strengths: r.strengths,
      improvements: r.improvements,
      goals: r.goals,
      selfAssessment: r.selfAssessment,
      status: r.status,
      submittedAt: r.submittedAt,
      publishedAt: r.publishedAt,
      acknowledgedAt: r.acknowledgedAt,
      competencyScores: r.competencyScores.map((cs) => ({
        competency: cs.competency,
        score: cs.score,
      })),
    }))
  })
}

/**
 * Get review history for a specific employee.
 * Returns PUBLISHED reviews (everyone), plus the caller's own PENDING/SUBMITTED
 * row if it's their own profile (for self-assessment).
 */
export async function getEmployeeReviewHistory(
  userId: string,
  orgId: string,
  employeeId: string,
  isOwnProfile: boolean
): Promise<ReviewItem[]> {
  return dbAs(userId, async (tx) => {
    const statusFilter: PerformanceReviewStatus[] = isOwnProfile
      ? ['PENDING', 'SUBMITTED', 'PUBLISHED']
      : ['PUBLISHED']

    const reviews = await tx.performanceReview.findMany({
      where: {
        orgId,
        employeeId,
        status: { in: statusFilter },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
        competencyScores: { select: { competency: true, score: true } },
        cycle: { select: { name: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reviews.map((r) => ({
      id: r.id,
      employeeId: r.employee.id,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      reviewerId: r.reviewer?.id ?? null,
      reviewerFirstName: r.reviewer?.firstName ?? null,
      reviewerLastName: r.reviewer?.lastName ?? null,
      overallScore: r.overallScore,
      strengths: r.strengths,
      improvements: r.improvements,
      goals: r.goals,
      selfAssessment: r.selfAssessment,
      status: r.status,
      submittedAt: r.submittedAt,
      publishedAt: r.publishedAt,
      acknowledgedAt: r.acknowledgedAt,
      competencyScores: r.competencyScores.map((cs) => ({
        competency: cs.competency,
        score: cs.score,
      })),
      cycleName: r.cycle.name,
      cycleStartDate: r.cycle.startDate,
    }))
  })
}

/**
 * Compute auto-metrics for an employee over a date range.
 * Derived from attendance and leave data — no new tables needed.
 */
export async function getPerformanceAutoMetrics(
  userId: string,
  orgId: string,
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<AutoMetrics> {
  const orgSettings = await getOrgSettings(orgId)
  const workingDays = (orgSettings?.workingDays as number[]) ?? [1, 2, 3, 4, 5]
  const workingHoursStart = orgSettings?.workingHoursStart ?? '09:00'
  const workingHoursEnd = orgSettings?.workingHoursEnd ?? '17:00'
  const timezone = (orgSettings?.timezone as string) ?? 'UTC'

  // For a cycle still in progress, don't count days that haven't happened
  // yet as "expected" — that's what was silently deflating attendance
  // reliability (e.g. 17 days present out of a full 64-day quarter reads
  // as 27%, when the employee has actually been present every day so far).
  const now = new Date()
  const effectiveEndDate = endDate.getTime() < now.getTime() ? endDate : now

  // Count expected workdays in range
  const expectedWorkdays = countWorkdays(startDate, effectiveEndDate, workingDays)

  return dbAs(userId, async (tx) => {
    // Attendance records in range (CLOSED/CORRECTED status only)
    const attendanceRecords = await tx.attendanceRecord.findMany({
      where: {
        orgId,
        employeeId,
        date: { gte: startDate, lte: effectiveEndDate },
        status: { in: ['CLOSED', 'CORRECTED'] },
      },
      select: { clockIn: true, clockOut: true, durationMinutes: true, date: true },
    })

    // Get employee shift info — same shape resolveShift() expects, matching
    // exactly how payroll and attendance resolve an employee's effective shift.
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, orgId },
      select: {
        shiftTemplate: {
          select: {
            startMinutes: true,
            endMinutes: true,
            standardMinutesPerDay: true,
            overtimeMultiplier: true,
            restDayMultiplier: true,
          },
        },
        employmentType: {
          select: {
            defaultShiftTemplate: {
              select: {
                startMinutes: true,
                endMinutes: true,
                standardMinutesPerDay: true,
                overtimeMultiplier: true,
                restDayMultiplier: true,
              },
            },
          },
        },
      },
    })

    const shift = resolveShift({
      employeeShift: employee?.shiftTemplate
        ? {
            startMinutes: employee.shiftTemplate.startMinutes,
            endMinutes: employee.shiftTemplate.endMinutes,
            standardMinutesPerDay: employee.shiftTemplate.standardMinutesPerDay,
            overtimeMultiplier: Number(employee.shiftTemplate.overtimeMultiplier),
            restDayMultiplier: Number(employee.shiftTemplate.restDayMultiplier),
          }
        : null,
      employmentTypeShift: employee?.employmentType?.defaultShiftTemplate
        ? {
            startMinutes: employee.employmentType.defaultShiftTemplate.startMinutes,
            endMinutes: employee.employmentType.defaultShiftTemplate.endMinutes,
            standardMinutesPerDay: employee.employmentType.defaultShiftTemplate.standardMinutesPerDay,
            overtimeMultiplier: Number(employee.employmentType.defaultShiftTemplate.overtimeMultiplier),
            restDayMultiplier: Number(employee.employmentType.defaultShiftTemplate.restDayMultiplier),
          }
        : null,
      orgWorkingHoursStart: workingHoursStart,
      orgWorkingHoursEnd: workingHoursEnd,
    })

    const daysPresent = attendanceRecords.length
    const totalMinutes = attendanceRecords.reduce(
      (sum, r) => sum + (r.durationMinutes ?? 0),
      0
    )
    const totalHoursWorked = Math.round((totalMinutes / 60) * 10) / 10

    // Late arrivals + overtime — same computeShiftMetrics() call payroll and
    // the attendance dashboard already use, so this report's numbers never
    // diverge from what's shown/paid elsewhere.
    let lateArrivals = 0
    let totalOvertimeMinutes = 0
    for (const r of attendanceRecords) {
      const metrics = computeShiftMetrics({
        shift,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        durationMinutes: r.durationMinutes,
        dayOfWeek: r.date.getDay(),
        workingDays,
        timezone,
      })
      if (metrics.lateMinutes > 0) lateArrivals++
      if (metrics.isRestDay) {
        totalOvertimeMinutes += r.durationMinutes ?? 0
      } else {
        totalOvertimeMinutes += metrics.overtimeMinutes
      }
    }
    const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10

    // Leave days in range (APPROVED leave requests overlapping the range,
    // not counting leave scheduled for later in the cycle that hasn't
    // happened yet)
    const leaveRequests = await tx.leaveRequest.findMany({
      where: {
        orgId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: effectiveEndDate },
        endDate: { gte: startDate },
      },
      select: { totalDays: true },
    })
    const leaveDaysTaken = leaveRequests.reduce(
      (sum, r) => sum + Number(r.totalDays),
      0
    )

    const attendanceReliability =
      expectedWorkdays > 0
        ? Math.round((daysPresent / expectedWorkdays) * 100)
        : 0

    return {
      attendanceReliability,
      daysPresent,
      expectedWorkdays,
      lateArrivals,
      leaveDaysTaken,
      totalHoursWorked,
      overtimeHours,
    }
  })
}

/**
 * Get the latest CLOSED cycle ID for an org.
 */
export async function getLatestClosedCycleId(
  userId: string,
  orgId: string
): Promise<string | null> {
  return dbAs(userId, async (tx) => {
    const cycle = await tx.performanceCycle.findFirst({
      where: { orgId, status: 'CLOSED' },
      orderBy: { endDate: 'desc' },
      select: { id: true },
    })
    return cycle?.id ?? null
  })
}

/**
 * Calibration data for a given cycle — grouped by reviewer (manager).
 */
export async function getCalibrationData(
  userId: string,
  orgId: string,
  cycleId: string
): Promise<CalibrationData> {
  return dbAs(userId, async (tx) => {
    const reviews = await tx.performanceReview.findMany({
      where: {
        orgId,
        cycleId,
        status: 'PUBLISHED',
        reviewerId: { not: null },
        overallScore: { not: null },
      },
      select: {
        overallScore: true,
        reviewerId: true,
        reviewer: { select: { firstName: true, lastName: true } },
      },
    })

    if (reviews.length === 0) {
      return { byManager: [], orgAverage: 0 }
    }

    const orgAverage =
      Math.round(
        (reviews.reduce((sum, r) => sum + r.overallScore!, 0) / reviews.length) * 10
      ) / 10

    // Group by reviewer
    const grouped = new Map<
      string,
      { name: string; scores: number[] }
    >()
    for (const r of reviews) {
      const rid = r.reviewerId!
      if (!grouped.has(rid)) {
        grouped.set(rid, {
          name: `${r.reviewer!.firstName} ${r.reviewer!.lastName}`,
          scores: [],
        })
      }
      grouped.get(rid)!.scores.push(r.overallScore!)
    }

    const byManager: CalibrationManager[] = Array.from(grouped.entries()).map(
      ([reviewerId, { name, scores }]) => ({
        reviewerId,
        reviewerName: name,
        avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        reviewCount: scores.length,
      })
    )

    byManager.sort((a, b) => b.avgScore - a.avgScore)

    return { byManager, orgAverage }
  })
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Count workdays between two dates (inclusive) based on org working days config.
 * workingDays is an array of JS day numbers (0=Sun, 1=Mon, ..., 6=Sat).
 */
function countWorkdays(start: Date, end: Date, workingDays: number[]): number {
  let count = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endNorm = new Date(end)
  endNorm.setHours(23, 59, 59, 999)

  while (current <= endNorm) {
    if (workingDays.includes(current.getDay())) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}
