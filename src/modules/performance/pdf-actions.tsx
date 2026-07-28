'use server'

import '@/modules/register'

/**
 * Performance Review PDF export server actions.
 * Generates review PDFs using @react-pdf/renderer.
 */
import { getOrgContext, requirePermission, verifySession } from '@/core/auth'
import { getOrgBranding } from '@/core/org/queries'
import { dbAs } from '@/core/db'
import { getEmployeeIdForUser } from '@/core/employees'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReviewDocument } from './pdf/review-document'
import { getPerformanceAutoMetrics } from './queries'
import type { ReviewPdfData, ReviewEmployeeData, ReviewSummaryData } from './pdf/types'

export interface PdfActionResult {
  success: boolean
  error?: string
  data?: { buffer: number[]; fileName: string }
}

/**
 * Generate a PDF for the whole performance cycle (all published reviews).
 * Requires performance.review.view_all permission.
 */
export async function downloadCyclePdf(
  orgSlug: string,
  cycleId: string
): Promise<PdfActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'performance.review.view_all')

  const result = await dbAs(session.userId, async (tx) => {
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, orgId: org.id },
      select: { id: true, name: true, startDate: true, endDate: true },
    })
    if (!cycle) return null

    const reviews = await tx.performanceReview.findMany({
      where: { orgId: org.id, cycleId, status: 'PUBLISHED' },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        reviewer: { select: { firstName: true, lastName: true } },
        competencyScores: { select: { competency: true, score: true } },
      },
      orderBy: { employee: { lastName: 'asc' } },
    })

    return { cycle, reviews }
  })

  if (!result) {
    return { success: false, error: 'Performance cycle not found' }
  }

  if (result.reviews.length === 0) {
    return { success: false, error: 'No published reviews for this cycle' }
  }

  const branding = await getOrgBranding(org.id)

  // Fetch auto-metrics for each reviewed employee
  const employees: ReviewEmployeeData[] = await Promise.all(
    result.reviews.map(async (r) => {
      const metrics = await getPerformanceAutoMetrics(
        session.userId,
        org.id,
        r.employee.id,
        result.cycle.startDate,
        result.cycle.endDate
      )
      return {
        reviewId: r.id,
        employeeId: r.employee.id,
        firstName: r.employee.firstName,
        lastName: r.employee.lastName,
        jobTitle: r.employee.jobTitle?.name ?? null,
        department: r.employee.department?.name ?? null,
        overallScore: r.overallScore!,
        strengths: r.strengths,
        improvements: r.improvements,
        goals: r.goals,
        selfAssessment: r.selfAssessment,
        reviewerName: r.reviewer
          ? `${r.reviewer.firstName} ${r.reviewer.lastName}`
          : null,
        publishedAt: r.publishedAt,
        acknowledgedAt: r.acknowledgedAt,
        competencyScores: r.competencyScores.map((cs) => ({
          competency: cs.competency,
          score: cs.score,
        })),
        autoMetrics: {
          attendanceReliability: metrics.attendanceReliability,
          lateArrivals: metrics.lateArrivals,
          leaveDaysTaken: metrics.leaveDaysTaken,
          totalHoursWorked: metrics.totalHoursWorked,
          overtimeHours: metrics.overtimeHours,
        },
      }
    })
  )

  // Compute summary
  const scores = employees.map((e) => e.overallScore)
  const averageScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const s of scores) {
    distribution[s] = (distribution[s] ?? 0) + 1
  }

  const summary: ReviewSummaryData = {
    totalReviewed: employees.length,
    averageScore,
    distribution,
    aggregateMetrics: {
      totalLeaveDays: employees.reduce((sum, e) => sum + e.autoMetrics.leaveDaysTaken, 0),
      averageAttendance: employees.length > 0
        ? Math.round(
            employees.reduce((sum, e) => sum + e.autoMetrics.attendanceReliability, 0) /
              employees.length
          )
        : 0,
      totalOvertimeHours: Math.round(
        employees.reduce((sum, e) => sum + e.autoMetrics.overtimeHours, 0) * 10
      ) / 10,
      averageHoursWorked: employees.length > 0
        ? Math.round(
            (employees.reduce((sum, e) => sum + e.autoMetrics.totalHoursWorked, 0) /
              employees.length) *
              10
          ) / 10
        : 0,
    },
  }

  const pdfData: ReviewPdfData = {
    orgName: org.name,
    logoUrl: branding.logoSignedUrl,
    cycleName: result.cycle.name,
    cycleStart: result.cycle.startDate,
    cycleEnd: result.cycle.endDate,
    employees,
    summary,
  }

  const buffer = await renderToBuffer(<ReviewDocument data={pdfData} />)
  const fileName = `performance-${result.cycle.name.replace(/\s+/g, '-').toLowerCase()}.pdf`

  return {
    success: true,
    data: { buffer: Array.from(new Uint8Array(buffer)), fileName },
  }
}

/**
 * Generate a PDF for a single employee's review.
 * Accessible by performance.review.view_all OR the employee viewing their own published review.
 */
export async function downloadEmployeeCyclePdf(
  orgSlug: string,
  reviewId: string
): Promise<PdfActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  // Try admin permission first; if not, check own review access
  let hasAdminAccess = false
  try {
    await requirePermission(org.id, 'performance.review.view_all')
    hasAdminAccess = true
  } catch {
    await requirePermission(org.id, 'performance.review.view_own')
  }

  const review = await dbAs(session.userId, async (tx) => {
    return tx.performanceReview.findFirst({
      where: { id: reviewId, orgId: org.id },
      include: {
        cycle: { select: { name: true, startDate: true, endDate: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        reviewer: { select: { firstName: true, lastName: true } },
        competencyScores: { select: { competency: true, score: true } },
      },
    })
  })

  if (!review) {
    return { success: false, error: 'Review not found' }
  }

  // If non-admin, verify this is the caller's own published review
  if (!hasAdminAccess) {
    const employeeId = await getEmployeeIdForUser(org.id, session.userId)
    if (!employeeId || employeeId !== review.employee.id) {
      return { success: false, error: 'You do not have permission to access this review' }
    }
    if (review.status !== 'PUBLISHED') {
      return { success: false, error: 'This review has not been published yet' }
    }
  }

  // Non-admin can't download unpublished reviews either
  if (review.status !== 'PUBLISHED' && !hasAdminAccess) {
    return { success: false, error: 'This review has not been published yet' }
  }

  const branding = await getOrgBranding(org.id)

  const metrics = await getPerformanceAutoMetrics(
    session.userId,
    org.id,
    review.employee.id,
    review.cycle.startDate,
    review.cycle.endDate
  )

  const employee: ReviewEmployeeData = {
    reviewId: review.id,
    employeeId: review.employee.id,
    firstName: review.employee.firstName,
    lastName: review.employee.lastName,
    jobTitle: review.employee.jobTitle?.name ?? null,
    department: review.employee.department?.name ?? null,
    overallScore: review.overallScore!,
    strengths: review.strengths,
    improvements: review.improvements,
    goals: review.goals,
    selfAssessment: review.selfAssessment,
    reviewerName: review.reviewer
      ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
      : null,
    publishedAt: review.publishedAt,
    acknowledgedAt: review.acknowledgedAt,
    competencyScores: review.competencyScores.map((cs) => ({
      competency: cs.competency,
      score: cs.score,
    })),
    autoMetrics: {
      attendanceReliability: metrics.attendanceReliability,
      lateArrivals: metrics.lateArrivals,
      leaveDaysTaken: metrics.leaveDaysTaken,
      totalHoursWorked: metrics.totalHoursWorked,
      overtimeHours: metrics.overtimeHours,
    },
  }

  const pdfData: ReviewPdfData = {
    orgName: org.name,
    logoUrl: branding.logoSignedUrl,
    cycleName: review.cycle.name,
    cycleStart: review.cycle.startDate,
    cycleEnd: review.cycle.endDate,
    employees: [employee],
  }

  const buffer = await renderToBuffer(<ReviewDocument data={pdfData} />)
  const fileName = `review-${review.employee.firstName}-${review.employee.lastName}-${review.cycle.name.replace(/\s+/g, '-').toLowerCase()}.pdf`

  return {
    success: true,
    data: { buffer: Array.from(new Uint8Array(buffer)), fileName },
  }
}
