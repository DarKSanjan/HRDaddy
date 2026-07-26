/**
 * Payroll module queries — data fetching with role-scoped access.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { PayrollPeriodStatus } from '@prisma/client'
import type { PayrollListParams } from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PayrollPeriodItem {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: PayrollPeriodStatus
  approvedAt: Date | null
  recordCount: number
  totalGrossCents: number
  totalNetCents: number
  totalCpfCents: number
}

export interface PayrollRecordItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  grossAmountCents: number
  netAmountCents: number
  cpfTotalCents: number | null
  cpfEmployeeCents: number | null
  cpfEmployerCents: number | null
  isPublished: boolean
}

export interface PayslipItem {
  id: string
  periodName: string
  periodStart: Date
  periodEnd: Date
  grossAmountCents: number
  netAmountCents: number
  cpfTotalCents: number | null
  cpfEmployeeCents: number | null
  cpfEmployerCents: number | null
  publishedAt: Date | null
  lineItems: Array<{
    id: string
    type: string
    name: string
    amountCents: number
  }>
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

/**
 * List payroll periods for an organisation.
 * Requires payroll.view_all permission (HR Admin / Owner).
 */
export async function getPayrollPeriods(
  userId: string,
  orgId: string,
  params: PayrollListParams
): Promise<{ periods: PayrollPeriodItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where: Record<string, unknown> = { orgId }
    if (params.status) {
      where.status = params.status
    }

    const periods = await tx.payrollPeriod.findMany({
      where,
      include: {
        records: {
          select: {
            grossAmountCents: true,
            netAmountCents: true,
            cpfTotalCents: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    })
    const total = await tx.payrollPeriod.count({ where })

    const items: PayrollPeriodItem[] = periods.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      approvedAt: p.approvedAt,
      recordCount: p.records.length,
      totalGrossCents: p.records.reduce((sum, r) => sum + r.grossAmountCents, 0),
      totalNetCents: p.records.reduce((sum, r) => sum + r.netAmountCents, 0),
      totalCpfCents: p.records.reduce((sum, r) => sum + (r.cpfTotalCents ?? 0), 0),
    }))

    return { periods: items, total }
  })
}

/**
 * Get payroll records for a specific period.
 * Requires payroll.view_all permission.
 */
export async function getPayrollRecords(
  userId: string,
  orgId: string,
  periodId: string
): Promise<{ period: { id: string; name: string; status: PayrollPeriodStatus; startDate: Date; endDate: Date } | null; records: PayrollRecordItem[] }> {
  return dbAs(userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId },
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
    })

    if (!period) return { period: null, records: [] }

    const records = await tx.payrollRecord.findMany({
      where: { periodId, orgId },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { employee: { lastName: 'asc' } },
    })

    const items: PayrollRecordItem[] = records.map((r) => ({
      id: r.id,
      employeeId: r.employee.id,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      grossAmountCents: r.grossAmountCents,
      netAmountCents: r.netAmountCents,
      cpfTotalCents: r.cpfTotalCents,
      cpfEmployeeCents: r.cpfEmployeeCents,
      cpfEmployerCents: r.cpfEmployerCents,
      isPublished: r.isPublished,
    }))

    return { period, records: items }
  })
}

/**
 * Get payslips for a specific employee (published only).
 * Employees can only see their own published payslips.
 */
export async function getPayslipsForEmployee(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<PayslipItem[]> {
  return dbAs(userId, async (tx) => {
    const records = await tx.payrollRecord.findMany({
      where: {
        orgId,
        employeeId,
        isPublished: true,
      },
      include: {
        period: {
          select: { name: true, startDate: true, endDate: true },
        },
        lineItems: {
          select: { id: true, type: true, name: true, amountCents: true },
        },
      },
      orderBy: { period: { startDate: 'desc' } },
    })

    return records.map((r) => ({
      id: r.id,
      periodName: r.period.name,
      periodStart: r.period.startDate,
      periodEnd: r.period.endDate,
      grossAmountCents: r.grossAmountCents,
      netAmountCents: r.netAmountCents,
      cpfTotalCents: r.cpfTotalCents,
      cpfEmployeeCents: r.cpfEmployeeCents,
      cpfEmployerCents: r.cpfEmployerCents,
      publishedAt: r.publishedAt,
      lineItems: r.lineItems.map((li) => ({
        id: li.id,
        type: li.type,
        name: li.name,
        amountCents: li.amountCents,
      })),
    }))
  })
}
