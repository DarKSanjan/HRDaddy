'use server'

import '@/modules/register'

/**
 * Performance module server actions.
 * Uses dbAs (RLS-scoped) for all mutations except where noted.
 * The settings toggle uses dbAdmin via the settings layer (core).
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import { getEmployeeIdForUser } from '@/core/employees'
import { dbAs } from '@/core/db'
import { getNotificationAdapter } from '@/core/notifications'
import { getReviewComplexity } from './settings'
import { computeOverallScore, canSubmitReviewAs } from './utils'
import type { PerformanceCompetency } from '@prisma/client'

export interface ActionResult {
  success: boolean
  error?: string
}

const ALL_COMPETENCIES: PerformanceCompetency[] = [
  'JOB_KNOWLEDGE',
  'QUALITY_OF_WORK',
  'COMMUNICATION',
  'TEAMWORK',
  'INITIATIVE',
  'RELIABILITY',
]

// ─────────────────────────────────────────────
// Create cycle
// ─────────────────────────────────────────────

export async function createCycle(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'performance.cycle.manage')

  const name = formData.get('name') as string | null
  const startDateStr = formData.get('startDate') as string | null
  const endDateStr = formData.get('endDate') as string | null

  if (!name?.trim() || !startDateStr || !endDateStr) {
    return { success: false, error: 'Name, start date, and end date are required.' }
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: 'Invalid date format.' }
  }
  if (endDate <= startDate) {
    return { success: false, error: 'End date must be after start date.' }
  }

  await dbAs(userId, async (tx) => {
    // Get all active employees to create one review row per employee
    const activeEmployees = await tx.employee.findMany({
      where: { orgId: org.id, employmentStatus: 'ACTIVE' },
      select: { id: true },
    })

    // Create cycle + review rows
    const createdCycle = await tx.performanceCycle.create({
      data: {
        orgId: org.id,
        name: name.trim(),
        startDate,
        endDate,
        status: 'DRAFT',
        reviews: {
          create: activeEmployees.map((emp) => ({
            orgId: org.id,
            employeeId: emp.id,
            status: 'PENDING',
          })),
        },
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.cycle.create',
      targetType: 'performance_cycle',
      targetId: createdCycle.id,
      after: { name: name.trim(), startDate, endDate },
    }, tx)

    return createdCycle
  })

  revalidatePath(`/${orgSlug}/performance`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Open / Close cycle
// ─────────────────────────────────────────────

export async function openCycle(
  orgSlug: string,
  cycleId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'performance.cycle.manage')

  const result = await dbAs(userId, async (tx) => {
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, orgId: org.id },
    })
    if (!cycle) return { error: 'Cycle not found.', cycle: null }
    if (cycle.status !== 'DRAFT') return { error: 'Only DRAFT cycles can be opened.', cycle: null }

    await tx.performanceCycle.update({
      where: { id: cycleId },
      data: { status: 'ACTIVE' },
    })

    // Fetch pending reviews grouped by manager for notification
    const pendingReviews = await tx.performanceReview.findMany({
      where: { cycleId, orgId: org.id, status: 'PENDING' },
      select: {
        employee: {
          select: {
            managerId: true,
            manager: { select: { userId: true } },
          },
        },
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.cycle.open',
      targetType: 'performance_cycle',
      targetId: cycleId,
      after: { status: 'ACTIVE' },
    }, tx)

    return { error: null, cycle, pendingReviews }
  })

  if (result.error) return { success: false, error: result.error }

  // Send one notification per manager about their pending reviews
  if (result.pendingReviews && result.cycle) {
    const managerCounts = new Map<string, number>()
    for (const r of result.pendingReviews) {
      const managerUserId = r.employee.manager?.userId
      if (!managerUserId) continue
      managerCounts.set(managerUserId, (managerCounts.get(managerUserId) ?? 0) + 1)
    }

    const notifier = getNotificationAdapter()
    const endFormatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(result.cycle.endDate)

    for (const [managerUserId, count] of managerCounts) {
      await notifier.send({
        orgId: org.id,
        userId: managerUserId,
        title: 'Performance reviews to complete',
        message: `You have ${count} performance review${count === 1 ? '' : 's'} to complete for ${result.cycle.name}, due by ${endFormatted}.`,
        link: `/${orgSlug}/performance`,
      })
    }
  }

  revalidatePath(`/${orgSlug}/performance`)
  return { success: true }
}

export async function closeCycle(
  orgSlug: string,
  cycleId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'performance.cycle.manage')

  const result = await dbAs(userId, async (tx) => {
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, orgId: org.id },
    })
    if (!cycle) return { error: 'Cycle not found.' }
    if (cycle.status !== 'ACTIVE') return { error: 'Only ACTIVE cycles can be closed.' }

    await tx.performanceCycle.update({
      where: { id: cycleId },
      data: { status: 'CLOSED' },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.cycle.close',
      targetType: 'performance_cycle',
      targetId: cycleId,
      after: { status: 'CLOSED' },
    }, tx)
    return { error: null }
  })

  if (result.error) return { success: false, error: result.error }

  revalidatePath(`/${orgSlug}/performance`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Submit review
// ─────────────────────────────────────────────

export async function submitReview(
  orgSlug: string,
  reviewId: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId, role } = await requirePermission(org.id, 'performance.review.submit')

  // Manager authorization check: MANAGER role must be the employee's actual manager
  const callerEmployeeId = await getEmployeeIdForUser(org.id, userId)

  // Parse form input based on complexity mode
  const complexity = await getReviewComplexity(org.id)
  const strengths = (formData.get('strengths') as string) || null
  const improvements = (formData.get('improvements') as string) || null
  const goals = (formData.get('goals') as string) || null

  let overallScore: number
  let competencyData: Array<{ competency: PerformanceCompetency; score: number }> | null = null

  if (complexity === 'advanced') {
    // Parse 6 competency scores
    const scores: Array<{ competency: PerformanceCompetency; score: number }> = []
    for (const comp of ALL_COMPETENCIES) {
      const raw = formData.get(`competency_${comp}`)
      const val = Number(raw)
      if (!raw || isNaN(val) || val < 1 || val > 5) {
        return { success: false, error: `Invalid score for ${comp}. Must be 1–5.` }
      }
      scores.push({ competency: comp, score: val })
    }
    overallScore = computeOverallScore(scores.map((s) => s.score))
    competencyData = scores
  } else {
    // Simple mode: one overall score
    const rawScore = formData.get('overallScore')
    const val = Number(rawScore)
    if (!rawScore || isNaN(val) || val < 1 || val > 5) {
      return { success: false, error: 'Overall score is required (1–5).' }
    }
    overallScore = val
  }

  const result = await dbAs(userId, async (tx) => {
    // Load the review + cycle + employee's managerId
    const review = await tx.performanceReview.findFirst({
      where: { id: reviewId, orgId: org.id },
      include: {
        cycle: { select: { status: true } },
        employee: { select: { managerId: true } },
      },
    })
    if (!review) return { error: 'Review not found.', employeeId: null }
    if (review.cycle.status !== 'ACTIVE') {
      return { error: 'Cannot submit reviews for a non-active cycle.', employeeId: null }
    }
    if (review.status !== 'PENDING') {
      return { error: 'This review has already been submitted.', employeeId: null }
    }

    // Manager auth check
    if (!canSubmitReviewAs(role, callerEmployeeId, review.employee.managerId)) {
      return { error: 'You can only submit reviews for your direct reports.', employeeId: null }
    }

    // Update the review
    await tx.performanceReview.update({
      where: { id: reviewId },
      data: {
        overallScore,
        strengths,
        improvements,
        goals,
        reviewerId: callerEmployeeId,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // Write competency scores in advanced mode
    if (competencyData) {
      await tx.performanceCompetencyScore.deleteMany({ where: { reviewId } })
      await tx.performanceCompetencyScore.createMany({
        data: competencyData.map((s) => ({
          reviewId,
          competency: s.competency,
          score: s.score,
        })),
      })
    }

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.review.submit',
      targetType: 'performance_review',
      targetId: reviewId,
      after: { overallScore, complexity },
    }, tx)

    return { error: null, employeeId: review.employeeId }
  })

  if (result.error) return { success: false, error: result.error }

  revalidatePath(`/${orgSlug}/performance`)
  if (result.employeeId) {
    revalidatePath(`/${orgSlug}/employees/${result.employeeId}`)
  }
  return { success: true }
}

// ─────────────────────────────────────────────
// Publish review
// ─────────────────────────────────────────────

export async function publishReview(
  orgSlug: string,
  reviewId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'performance.cycle.manage')

  const result = await dbAs(userId, async (tx) => {
    const review = await tx.performanceReview.findFirst({
      where: { id: reviewId, orgId: org.id },
    })
    if (!review) return { error: 'Review not found.', employeeId: null }
    if (review.status !== 'SUBMITTED') {
      return { error: 'Only submitted reviews can be published.', employeeId: null }
    }

    await tx.performanceReview.update({
      where: { id: reviewId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.review.publish',
      targetType: 'performance_review',
      targetId: reviewId,
      after: { status: 'PUBLISHED' },
    }, tx)
    return { error: null, employeeId: review.employeeId }
  })

  if (result.error) return { success: false, error: result.error }

  revalidatePath(`/${orgSlug}/performance`)
  if (result.employeeId) {
    revalidatePath(`/${orgSlug}/employees/${result.employeeId}`)
  }
  return { success: true }
}

// ─────────────────────────────────────────────
// Submit self-assessment
// ─────────────────────────────────────────────

export async function submitSelfAssessment(
  orgSlug: string,
  reviewId: string,
  text: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'performance.review.view_own')

  // Ownership check: the review must belong to the caller's employee record
  const callerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!callerEmployeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const result = await dbAs(userId, async (tx) => {
    const review = await tx.performanceReview.findFirst({
      where: { id: reviewId, orgId: org.id, employeeId: callerEmployeeId },
      include: { cycle: { select: { status: true } } },
    })
    if (!review) return { error: 'Review not found or not yours.' }
    if (review.cycle.status === 'CLOSED') {
      return { error: 'Cannot submit self-assessment for a closed cycle.' }
    }

    await tx.performanceReview.update({
      where: { id: reviewId },
      data: { selfAssessment: text },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.self_assessment.submit',
      targetType: 'performance_review',
      targetId: reviewId,
      after: { selfAssessment: text.substring(0, 100) },
    }, tx)
    return { error: null }
  })

  if (result.error) return { success: false, error: result.error }

  revalidatePath(`/${orgSlug}/employees/${callerEmployeeId}`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Acknowledge review
// ─────────────────────────────────────────────

export async function acknowledgeReview(
  orgSlug: string,
  reviewId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'performance.review.view_own')

  const callerEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (!callerEmployeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const result = await dbAs(userId, async (tx) => {
    const review = await tx.performanceReview.findFirst({
      where: { id: reviewId, orgId: org.id, employeeId: callerEmployeeId },
    })
    if (!review) return { error: 'Review not found or not yours.' }
    if (review.status !== 'PUBLISHED') {
      return { error: 'Only published reviews can be acknowledged.' }
    }
    if (!review.acknowledgedAt) {
      await tx.performanceReview.update({
        where: { id: reviewId },
        data: { acknowledgedAt: new Date() },
      })
    }

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'performance.review.acknowledge',
      targetType: 'performance_review',
      targetId: reviewId,
      after: { acknowledgedAt: new Date().toISOString() },
    }, tx)
    return { error: null }
  })

  if (result.error) return { success: false, error: result.error }

  revalidatePath(`/${orgSlug}/employees/${callerEmployeeId}`)
  return { success: true }
}
