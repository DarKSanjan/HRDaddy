/**
 * Performance module utility functions — pure logic, safe for client and server.
 */
import type { PerformanceCycleStatus, OrgRole } from '@prisma/client'

/**
 * Authorization rule for submitReview: OWNER/HR_ADMIN may submit for anyone;
 * MANAGER may only submit for their own direct reports. Any other role is
 * unauthorized (in practice this path is already gated by the
 * performance.review.submit permission, which only OWNER/HR_ADMIN/MANAGER
 * hold — this function is the second, per-employee check on top of that).
 */
export function canSubmitReviewAs(
  role: OrgRole,
  callerEmployeeId: string | null,
  employeeManagerId: string | null
): boolean {
  if (role === 'OWNER' || role === 'HR_ADMIN') return true
  if (role === 'MANAGER') {
    return callerEmployeeId != null && callerEmployeeId === employeeManagerId
  }
  return false
}

export interface CycleItemBase {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: PerformanceCycleStatus
  createdAt: Date
  totalReviews: number
  submittedReviews: number
}

/**
 * Compute the next quarter's suggested cycle name and date range.
 */
export function suggestNextCycle(existingCycles: CycleItemBase[]): {
  name: string
  startDate: Date
  endDate: Date
} {
  if (existingCycles.length > 0) {
    // Base on the latest cycle's end date
    const sorted = [...existingCycles].sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    )
    const lastEnd = new Date(sorted[0].endDate)
    const nextStart = new Date(lastEnd)
    nextStart.setDate(nextStart.getDate() + 1)
    return buildQuarterFromDate(nextStart)
  }
  // No existing cycles — base on today
  return buildQuarterFromDate(new Date())
}

function buildQuarterFromDate(date: Date): {
  name: string
  startDate: Date
  endDate: Date
} {
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()
  const quarter = Math.floor(month / 3) + 1
  const startMonth = (quarter - 1) * 3
  const startDate = new Date(year, startMonth, 1)
  const endDate = new Date(year, startMonth + 3, 0) // last day of quarter

  return {
    name: `Q${quarter} ${year}`,
    startDate,
    endDate,
  }
}

/**
 * Compute the overall score from competency scores (rounded average).
 * Exported for use in actions and tests.
 */
export function computeOverallScore(scores: number[]): number {
  if (scores.length === 0) return 0
  const sum = scores.reduce((a, b) => a + b, 0)
  return Math.round(sum / scores.length)
}
