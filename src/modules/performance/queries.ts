/**
 * Performance module queries — data fetching with role-scoped access.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import { getOrgSettings } from '@/core/employees'
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
  competencyScores: Array<{
    competency: PerformanceCompetency
    score: number
  }>
  cycleName?: string
}

export interface AutoMetrics {
  attendanceReliability: number // percentage 0–100
  daysPresent: number
  expectedWorkdays: number
  lateArrivals: number
  leaveDaysTaken: number
  totalHoursWorked: number
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
      competencyScores: r.competencyScores.map((cs) => ({
        competency: cs.competency,
        score: cs.score,
      })),
      cycleName: r.cycle.name,
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

  // Count expected workdays in range
  const expectedWorkdays = countWorkdays(startDate, endDate, workingDays)

  return dbAs(userId, async (tx) => {
    // Attendance records in range (CLOSED/CORRECTED status only)
    const attendanceRecords = await tx.attendanceRecord.findMany({
      where: {
        orgId,
        employeeId,
        date: { gte: startDate, lte: endDate },
        status: { in: ['CLOSED', 'CORRECTED'] },
      },
      select: { clockIn: true, durationMinutes: true },
    })

    const daysPresent = attendanceRecords.length
    const totalMinutes = attendanceRecords.reduce(
      (sum, r) => sum + (r.durationMinutes ?? 0),
      0
    )
    const totalHoursWorked = Math.round((totalMinutes / 60) * 10) / 10

    // Late arrivals
    const [configHour, configMinute] = workingHoursStart.split(':').map(Number)
    const configStartMinutes = configHour * 60 + configMinute
    const lateArrivals = attendanceRecords.filter((r) => {
      const min = r.clockIn.getHours() * 60 + r.clockIn.getMinutes()
      return min > configStartMinutes
    }).length

    // Leave days in range (APPROVED leave requests overlapping the range)
    const leaveRequests = await tx.leaveRequest.findMany({
      where: {
        orgId,
        employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
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
    }
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
