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
import { getComplianceProvider } from './compliance'
import type { StatutoryContributionContext } from './compliance'
import { MOM_OT_CAP_HOURS } from './compliance/sg'
import { resolveShift, computeShiftMetrics } from '../attendance/shift-helpers'
import { getPayrollComplexity } from './settings'
import { computeEmployeeBasePay } from './compute'
import { momPayslipSchema } from './schemas'
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

    // Get org settings for compliance provider and working days
    const orgSettings = await tx.organisationSettings.findUnique({
      where: { orgId: org.id },
    })
    const countryCode = orgSettings?.countryCode ?? 'SG'
    const workingDays: number[] = (orgSettings?.workingDays as number[]) ?? [1, 2, 3, 4, 5]
    const workingHoursStart = orgSettings?.workingHoursStart ?? '09:00'
    const workingHoursEnd = orgSettings?.workingHoursEnd ?? '17:00'
    const timezone = (orgSettings?.timezone as string) ?? 'UTC'

    const compliance = getComplianceProvider(countryCode)

    // Get payroll complexity setting for this org
    const payrollComplexity = await getPayrollComplexity(org.id)
    const isSimpleMode = payrollComplexity === 'simple'

    // Get all active employees with their details + shift info
    const employees = await tx.employee.findMany({
      where: { orgId: org.id, employmentStatus: 'ACTIVE' },
      select: {
        id: true,
        dateOfBirth: true,
        compensationAmountCents: true,
        isWorkman: true,
        residencyStatus: true,
        prStartDate: true,
        prArrangement: true,
        payType: true,
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

    // Delete existing records for this period (reprocessing)
    await tx.payrollRecord.deleteMany({
      where: { periodId, orgId: org.id },
    })

    // Compute payroll for each employee
    for (const emp of employees) {
      if (!emp.compensationAmountCents || !emp.dateOfBirth) continue

      // In simple mode: skip shift/OT/hourly logic; flat salary for all
      let baseCents: number
      let overtimePayCents = 0
      const lineItems: Array<{ type: 'EARNING' | 'ALLOWANCE' | 'DEDUCTION' | 'OVERTIME'; name: string; amountCents: number }> = []

      if (isSimpleMode) {
        // Simple mode: everyone treated as flat salaried
        const basePayResult = computeEmployeeBasePay({
          isSimpleMode: true,
          payType: emp.payType as 'SALARIED' | 'HOURLY',
          compensationAmountCents: emp.compensationAmountCents,
          attendanceMinutes: 0,
        })
        baseCents = basePayResult.baseCents
        for (const li of basePayResult.lineItems) {
          lineItems.push({ type: li.type as 'EARNING', name: li.name, amountCents: li.amountCents })
        }
      } else {
        // Advanced mode: full shift/OT/hourly computation

        // Resolve effective shift
        const shift = resolveShift({
          employeeShift: emp.shiftTemplate
            ? {
                startMinutes: emp.shiftTemplate.startMinutes,
                endMinutes: emp.shiftTemplate.endMinutes,
                standardMinutesPerDay: emp.shiftTemplate.standardMinutesPerDay,
                overtimeMultiplier: Number(emp.shiftTemplate.overtimeMultiplier),
                restDayMultiplier: Number(emp.shiftTemplate.restDayMultiplier),
              }
            : null,
          employmentTypeShift: emp.employmentType?.defaultShiftTemplate
            ? {
                startMinutes: emp.employmentType.defaultShiftTemplate.startMinutes,
                endMinutes: emp.employmentType.defaultShiftTemplate.endMinutes,
                standardMinutesPerDay: emp.employmentType.defaultShiftTemplate.standardMinutesPerDay,
                overtimeMultiplier: Number(emp.employmentType.defaultShiftTemplate.overtimeMultiplier),
                restDayMultiplier: Number(emp.employmentType.defaultShiftTemplate.restDayMultiplier),
              }
            : null,
          orgWorkingHoursStart: workingHoursStart,
          orgWorkingHoursEnd: workingHoursEnd,
        })

        // Get attendance records for this period
        const attendanceRecords = await tx.attendanceRecord.findMany({
          where: {
            orgId: org.id,
            employeeId: emp.id,
            date: { gte: period.startDate, lte: period.endDate },
            status: { in: ['CLOSED', 'CORRECTED'] },
          },
          select: {
            clockIn: true,
            clockOut: true,
            durationMinutes: true,
            date: true,
          },
        })

        // Compute gross pay based on pay type
        const totalMinutesWorked = attendanceRecords.reduce(
          (sum, r) => sum + (r.durationMinutes ?? 0), 0
        )
        const basePayResult = computeEmployeeBasePay({
          isSimpleMode: false,
          payType: emp.payType as 'SALARIED' | 'HOURLY',
          compensationAmountCents: emp.compensationAmountCents,
          attendanceMinutes: totalMinutesWorked,
        })
        baseCents = basePayResult.baseCents
        for (const li of basePayResult.lineItems) {
          lineItems.push({ type: li.type as 'EARNING', name: li.name, amountCents: li.amountCents })
        }

        // Compute overtime for salaried employees
        let weekdayOtMinutes = 0
        let restDayOtMinutes = 0

        for (const record of attendanceRecords) {
          if (!record.clockOut || record.durationMinutes === null) continue
          const dayOfWeek = record.date.getDay()
          const metrics = computeShiftMetrics({
            shift,
            clockIn: record.clockIn,
            clockOut: record.clockOut,
            durationMinutes: record.durationMinutes,
            dayOfWeek,
            workingDays,
            timezone,
          })
          if (metrics.isRestDay) {
            restDayOtMinutes += record.durationMinutes // All rest-day work counts
          } else {
            weekdayOtMinutes += metrics.overtimeMinutes
          }
        }

        // OT line item(s) for salaried employees
        if (emp.payType === 'SALARIED' && (weekdayOtMinutes > 0 || restDayOtMinutes > 0)) {
          const hourlyRateCents = compliance.hourlyRateFromMonthlyCents(emp.compensationAmountCents)

          // Weekday OT: hourlyRate × overtimeMultiplier × hours
          if (weekdayOtMinutes > 0) {
            const weekdayOtHours = weekdayOtMinutes / 60
            const weekdayOtCents = Math.round(hourlyRateCents * shift.overtimeMultiplier * weekdayOtHours)

            // Check MOM 72-hour cap — flag but don't truncate pay
            const totalOtHours = (weekdayOtMinutes + restDayOtMinutes) / 60
            const otCapExceeded = totalOtHours > MOM_OT_CAP_HOURS

            // Gate behind statutory eligibility
            const isStatutory = compliance.isOvertimeEligible(emp.compensationAmountCents, emp.isWorkman)

            lineItems.push({
              type: 'OVERTIME',
              name: isStatutory
                ? `Overtime Pay (Weekday)${otCapExceeded ? ' [72hr cap exceeded]' : ''}`
                : 'Overtime Pay (Weekday) [Non-statutory]',
              amountCents: weekdayOtCents,
            })
            overtimePayCents += weekdayOtCents
        }

        // Rest-day OT: hourlyRate × restDayMultiplier × hours
        // Note: This is a configurable approximation, not MOM-exact for rest day pay.
        // MOM uses lump-sum-per-day rules — org should verify manually.
        if (restDayOtMinutes > 0) {
          const restDayOtHours = restDayOtMinutes / 60
          const restDayOtCents = Math.round(hourlyRateCents * shift.restDayMultiplier * restDayOtHours)

          lineItems.push({
            type: 'OVERTIME',
            name: 'Overtime Pay (Rest Day) [Verify against MOM rest-day rules]',
            amountCents: restDayOtCents,
          })
          overtimePayCents += restDayOtCents
        }
      }
      } // end advanced mode

      const grossCents = baseCents + overtimePayCents

      // OT pay classifies as OW when paid within the normal payroll run
      // (i.e. same period or by 14th of following month). Since we process
      // and pay within the period, this is OW.
      const owCents = grossCents

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

      const cpfInput: StatutoryContributionContext = {
        employee: {
          dateOfBirth: emp.dateOfBirth,
          residencyStatus: emp.residencyStatus ?? null,
          prStartDate: emp.prStartDate ?? null,
          prArrangement: emp.prArrangement ?? null,
        },
        grossWageCents: owCents,
        bonusWageCents: 0, // AW/bonus handled separately during bonus processing
        payPeriodEndDate: period.endDate,
        yearToDate: {
          regularWageCents: ytdOwCents,
          totalWageCents: ytdOwCents,
        },
      }

      const cpfResult = compliance.computeStatutoryContribution(cpfInput)

      const netCents = grossCents - cpfResult.employeeCents

      const record = await tx.payrollRecord.create({
        data: {
          orgId: org.id,
          periodId,
          employeeId: emp.id,
          grossAmountCents: grossCents,
          netAmountCents: netCents,
          // Column names predate multi-country support; values are now populated
          // generically via the compliance provider's StatutoryContributionResult.
          cpfTotalCents: cpfResult.totalCents,
          cpfEmployeeCents: cpfResult.employeeCents,
          cpfEmployerCents: cpfResult.employerCents,
          ytdOwCents: cpfResult.details.cappedRegularWageCents ?? 0,
          isPublished: false,
        },
      })

      // Create line items
      for (const li of lineItems) {
        await tx.payrollLineItem.create({
          data: {
            recordId: record.id,
            orgId: org.id,
            type: li.type,
            name: li.name,
            amountCents: li.amountCents,
          },
        })
      }
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
              select: {
                id: true,
                firstName: true,
                lastName: true,
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

    // Load org settings for OT computation
    const orgSettings = await tx.organisationSettings.findUnique({
      where: { orgId: org.id },
    })
    const workingDays: number[] = (orgSettings?.workingDays as number[]) ?? [1, 2, 3, 4, 5]
    const workingHoursStart = orgSettings?.workingHoursStart ?? '09:00'
    const workingHoursEnd = orgSettings?.workingHoursEnd ?? '17:00'
    const timezone = (orgSettings?.timezone as string) ?? 'UTC'

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

      const overtimeItems = record.lineItems.filter((li) => li.type === 'OVERTIME')
      const overtimePayCents = overtimeItems.reduce((sum, li) => sum + li.amountCents, 0)

      // Compute actual overtime hours from attendance
      const shift = resolveShift({
        employeeShift: record.employee.shiftTemplate
          ? {
              startMinutes: record.employee.shiftTemplate.startMinutes,
              endMinutes: record.employee.shiftTemplate.endMinutes,
              standardMinutesPerDay: record.employee.shiftTemplate.standardMinutesPerDay,
              overtimeMultiplier: Number(record.employee.shiftTemplate.overtimeMultiplier),
              restDayMultiplier: Number(record.employee.shiftTemplate.restDayMultiplier),
            }
          : null,
        employmentTypeShift: record.employee.employmentType?.defaultShiftTemplate
          ? {
              startMinutes: record.employee.employmentType.defaultShiftTemplate.startMinutes,
              endMinutes: record.employee.employmentType.defaultShiftTemplate.endMinutes,
              standardMinutesPerDay: record.employee.employmentType.defaultShiftTemplate.standardMinutesPerDay,
              overtimeMultiplier: Number(record.employee.employmentType.defaultShiftTemplate.overtimeMultiplier),
              restDayMultiplier: Number(record.employee.employmentType.defaultShiftTemplate.restDayMultiplier),
            }
          : null,
        orgWorkingHoursStart: workingHoursStart,
        orgWorkingHoursEnd: workingHoursEnd,
      })

      const attendanceRecords = await tx.attendanceRecord.findMany({
        where: {
          orgId: org.id,
          employeeId: record.employee.id,
          date: { gte: period.startDate, lte: period.endDate },
          status: { in: ['CLOSED', 'CORRECTED'] },
        },
        select: { clockIn: true, clockOut: true, durationMinutes: true, date: true },
      })

      let totalOvertimeMinutes = 0
      for (const att of attendanceRecords) {
        const metrics = computeShiftMetrics({
          shift,
          clockIn: att.clockIn,
          clockOut: att.clockOut,
          durationMinutes: att.durationMinutes,
          dayOfWeek: att.date.getDay(),
          workingDays,
          timezone,
        })
        if (metrics.isRestDay) {
          totalOvertimeMinutes += att.durationMinutes ?? 0
        } else {
          totalOvertimeMinutes += metrics.overtimeMinutes
        }
      }
      const overtimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10

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
        overtimeHours,
        overtimePayCents,
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
