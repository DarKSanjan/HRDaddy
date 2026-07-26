'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Payroll module server actions.
 * Every mutation:
 *   1. Resolves org from slug
 *   2. Checks permission
 *   3. Validates input with Zod
 *   4. Performs mutation via dbAs (RLS-scoped)
 *   5. Writes audit entry
 *   6. Revalidates cache
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import { dbAs } from '@/core/db'
import { computeCpf } from './cpf/calculate'
import { momPayslipSchema } from './schemas'
import type { CpfComputeInput, ResidencyStatus, PrArrangement } from './cpf/types'
import {
  processPayrollSchema,
  submitForReviewSchema,
  approvePayrollSchema,
  publishPayrollSchema,
  markAsPaidSchema,
  reopenPayrollSchema,
} from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  data?: unknown
}

// ─────────────────────────────────────────────
// Process Payroll (compute CPF for all employees)
// ─────────────────────────────────────────────

export async function processPayroll(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'payroll.process')

  const raw = Object.fromEntries(formData.entries())
  const parsed = processPayrollSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { periodId } = parsed.data

  const result = await dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
    })

    if (!period) return { error: 'Payroll period not found.' }
    if (period.status !== 'DRAFT' && period.status !== 'REOPENED') {
      return { error: 'Can only process payroll in DRAFT or REOPENED status.' }
    }

    // Get all active employees with their details
    const employees = await tx.employee.findMany({
      where: { orgId: org.id, employmentStatus: 'ACTIVE' },
      select: {
        id: true,
        dateOfBirth: true,
        compensationAmountCents: true,
        residencyStatus: true,
        prStartDate: true,
        prArrangement: true,
      },
    })

    // Delete existing records for this period (reprocessing)
    await tx.payrollRecord.deleteMany({
      where: { periodId, orgId: org.id },
    })

    // Compute CPF for each employee
    for (const emp of employees) {
      if (!emp.compensationAmountCents || !emp.dateOfBirth) continue

      const owCents = emp.compensationAmountCents

      // Get YTD OW for this employee
      const ytdRecords = await tx.payrollRecord.findMany({
        where: {
          orgId: org.id,
          employeeId: emp.id,
          period: {
            startDate: {
              gte: new Date(`${period.startDate.getFullYear()}-01-01`),
            },
            endDate: { lt: period.startDate },
          },
          isPublished: true,
        },
        select: { ytdOwCents: true, cpfTotalCents: true },
      })

      const ytdOwCents = ytdRecords.reduce(
        (sum, r) => sum + (r.ytdOwCents ?? 0),
        0
      )

      const cpfInput: CpfComputeInput = {
        owCents,
        awCents: 0, // AW handled separately during bonus processing
        dateOfBirth: emp.dateOfBirth,
        payPeriodDate: period.endDate,
        residencyStatus: (emp.residencyStatus ?? 'CITIZEN') as ResidencyStatus,
        prStartDate: emp.prStartDate ?? null,
        prArrangement: (emp.prArrangement ?? null) as PrArrangement | null,
        ytdOwCents,
        ytdTotalCents: ytdOwCents,
      }

      const cpfResult = computeCpf(cpfInput)

      const grossCents = owCents
      const netCents = grossCents - cpfResult.employeeCents

      await tx.payrollRecord.create({
        data: {
          orgId: org.id,
          periodId,
          employeeId: emp.id,
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          cpfTotalCents: cpfResult.totalCents,
          cpfEmployeeCents: cpfResult.employeeCents,
          cpfEmployerCents: cpfResult.employerCents,
          ytdOwCents: cpfResult.cappedOwCents,
          isPublished: false,
        },
      })
    }

    return { success: true, recordCount: employees.length }
  })

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'payroll.process',
    targetType: 'payroll_period',
    targetId: periodId,
    after: { recordCount: result.recordCount },
  })

  revalidatePath(`/${orgSlug}/payroll`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Submit for Review (DRAFT -> UNDER_REVIEW)
// ─────────────────────────────────────────────

export async function submitForReview(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'payroll.process')

  const raw = Object.fromEntries(formData.entries())
  const parsed = submitForReviewSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { periodId } = parsed.data

  const result = await dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
    })

    if (!period) return { error: 'Payroll period not found.' }
    if (period.status !== 'DRAFT' && period.status !== 'REOPENED') {
      return { error: 'Can only submit DRAFT or REOPENED periods for review.' }
    }

    // Ensure there are records to review
    const recordCount = await tx.payrollRecord.count({
      where: { periodId, orgId: org.id },
    })
    if (recordCount === 0) {
      return { error: 'Cannot submit an empty payroll for review. Process payroll first.' }
    }

    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'UNDER_REVIEW' },
    })

    return { success: true }
  })

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'payroll.submit_for_review',
    targetType: 'payroll_period',
    targetId: periodId,
    before: { status: 'DRAFT' },
    after: { status: 'UNDER_REVIEW' },
  })

  revalidatePath(`/${orgSlug}/payroll`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Approve Payroll (UNDER_REVIEW -> APPROVED)
// ─────────────────────────────────────────────

export async function approvePayroll(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'payroll.approve')

  const raw = Object.fromEntries(formData.entries())
  const parsed = approvePayrollSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { periodId } = parsed.data

  const result = await dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
    })

    if (!period) return { error: 'Payroll period not found.' }
    if (period.status !== 'UNDER_REVIEW') {
      return { error: 'Can only approve payroll that is UNDER_REVIEW.' }
    }

    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    })

    return { success: true }
  })

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'payroll.approve',
    targetType: 'payroll_period',
    targetId: periodId,
    before: { status: 'UNDER_REVIEW' },
    after: { status: 'APPROVED' },
  })

  revalidatePath(`/${orgSlug}/payroll`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Publish Payroll (APPROVED -> PUBLISHED)
// Validates all 12 MOM items for every payslip
// ─────────────────────────────────────────────

export async function publishPayroll(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'payroll.process')

  const raw = Object.fromEntries(formData.entries())
  const parsed = publishPayrollSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { periodId } = parsed.data

  const result = await dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
      include: {
        records: {
          include: {
            employee: {
              select: { firstName: true, lastName: true },
            },
            lineItems: true,
          },
        },
      },
    })

    if (!period) return { error: 'Payroll period not found.' }
    if (period.status !== 'APPROVED') {
      return { error: 'Can only publish APPROVED payroll.' }
    }

    // Validate every record against MOM payslip schema
    const orgData = await tx.organisation.findFirst({
      where: { id: org.id },
      select: { name: true },
    })

    for (const record of period.records) {
      const allowances = record.lineItems
        .filter((li) => li.type === 'ALLOWANCE')
        .map((li) => ({ name: li.name, amountCents: li.amountCents }))

      const deductions = record.lineItems
        .filter((li) => li.type === 'DEDUCTION')
        .map((li) => ({ name: li.name, amountCents: li.amountCents }))

      const additionalPayments = record.lineItems
        .filter((li) => li.type === 'EARNING' && li.name !== 'Basic Salary')
        .map((li) => ({ name: li.name, amountCents: li.amountCents }))

      const payslipData = {
        employerName: orgData?.name ?? '',
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
        dateOfPayment: period.endDate.toISOString().slice(0, 10),
        basicSalaryCents: record.grossAmountCents,
        salaryPeriodStart: period.startDate.toISOString().slice(0, 10),
        salaryPeriodEnd: period.endDate.toISOString().slice(0, 10),
        allowances,
        additionalPayments,
        deductions,
        overtimeHours: 0,
        overtimePayCents: 0,
        overtimePeriodStart: null,
        overtimePeriodEnd: null,
        netSalaryCents: record.netAmountCents,
      }

      const validation = momPayslipSchema.safeParse(payslipData)
      if (!validation.success) {
        const empName = `${record.employee.firstName} ${record.employee.lastName}`
        const issues = validation.error.issues.map((i) => i.message).join('; ')
        return { error: `Payslip validation failed for ${empName}: ${issues}` }
      }
    }

    // Mark all records as published
    const now = new Date()
    await tx.payrollRecord.updateMany({
      where: { periodId, orgId: org.id },
      data: { isPublished: true, publishedAt: now },
    })

    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'PUBLISHED' },
    })

    return { success: true }
  })

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'payroll.publish',
    targetType: 'payroll_period',
    targetId: periodId,
    before: { status: 'APPROVED' },
    after: { status: 'PUBLISHED' },
  })

  revalidatePath(`/${orgSlug}/payroll`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Mark as Paid (PUBLISHED -> PAID)
// ─────────────────────────────────────────────

export async function markAsPaid(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'payroll.process')

  const raw = Object.fromEntries(formData.entries())
  const parsed = markAsPaidSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { periodId } = parsed.data

  const result = await dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
    })

    if (!period) return { error: 'Payroll period not found.' }
    if (period.status !== 'PUBLISHED') {
      return { error: 'Can only mark PUBLISHED payroll as paid.' }
    }

    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'PAID' },
    })

    return { success: true }
  })

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'payroll.mark_paid',
    targetType: 'payroll_period',
    targetId: periodId,
    before: { status: 'PUBLISHED' },
    after: { status: 'PAID' },
  })

  revalidatePath(`/${orgSlug}/payroll`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Reopen Payroll (PUBLISHED/PAID -> REOPENED -> DRAFT)
// Audited action requiring reason
// ─────────────────────────────────────────────

export async function reopenPayroll(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'payroll.approve')

  const raw = Object.fromEntries(formData.entries())
  const parsed = reopenPayrollSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { periodId, reason } = parsed.data

  const result = await dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
    })

    if (!period) return { error: 'Payroll period not found.' }
    if (period.status !== 'PUBLISHED' && period.status !== 'PAID') {
      return { error: 'Can only reopen PUBLISHED or PAID payroll.' }
    }

    const previousStatus = period.status

    // Mark records as unpublished
    await tx.payrollRecord.updateMany({
      where: { periodId, orgId: org.id },
      data: { isPublished: false, publishedAt: null },
    })

    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'REOPENED' },
    })

    return { success: true, previousStatus }
  })

  if ('error' in result) {
    return { success: false, error: result.error }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'payroll.reopen',
    targetType: 'payroll_period',
    targetId: periodId,
    before: { status: result.previousStatus },
    after: { status: 'REOPENED', reason },
  })

  revalidatePath(`/${orgSlug}/payroll`)
  return { success: true }
}
