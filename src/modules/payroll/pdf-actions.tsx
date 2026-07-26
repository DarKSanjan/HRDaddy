'use server'

import '@/modules/register'

/**
 * Payroll PDF export server actions.
 * Generates payslip PDFs using @react-pdf/renderer.
 */
import { getOrgContext, requirePermission, verifySession } from '@/core/auth'
import { getOrgBranding } from '@/core/org/queries'
import { dbAs } from '@/core/db'
import { getEmployeeIdForUser } from '@/core/employees'
import { renderToBuffer } from '@react-pdf/renderer'
import { PayslipDocument } from './pdf/payslip-document'
import type { PayslipPdfData, PayslipEmployeeData, PayrollSummaryData } from './pdf/types'

export interface PdfActionResult {
  success: boolean
  error?: string
  data?: { buffer: number[]; fileName: string }
}

/**
 * Generate a PDF for the whole payroll period (all employees).
 * Requires payroll.view_all permission.
 */
export async function downloadPeriodPdf(
  orgSlug: string,
  periodId: string
): Promise<PdfActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'payroll.view_all')

  const result = await dbAs(session.userId, async (tx) => {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, orgId: org.id },
      select: { id: true, name: true, startDate: true, endDate: true },
    })
    if (!period) return null

    const records = await tx.payrollRecord.findMany({
      where: { periodId, orgId: org.id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: { select: { name: true } },
            department: { select: { name: true } },
            bankName: true,
            bankAccountNumber: true,
          },
        },
        lineItems: { select: { id: true, type: true, name: true, amountCents: true } },
      },
      orderBy: { employee: { lastName: 'asc' } },
    })

    return { period, records }
  })

  if (!result) {
    return { success: false, error: 'Payroll period not found' }
  }

  const branding = await getOrgBranding(org.id)

  const employees: PayslipEmployeeData[] = result.records.map((r) => ({
    recordId: r.id,
    employeeId: r.employee.id,
    firstName: r.employee.firstName,
    lastName: r.employee.lastName,
    jobTitle: r.employee.jobTitle?.name ?? null,
    department: r.employee.department?.name ?? null,
    bankName: r.employee.bankName ?? null,
    bankAccountLast4: r.employee.bankAccountNumber
      ? `•••• ${r.employee.bankAccountNumber.slice(-4)}`
      : null,
    grossAmountCents: r.grossAmountCents,
    netAmountCents: r.netAmountCents,
    cpfEmployeeCents: r.cpfEmployeeCents,
    cpfEmployerCents: r.cpfEmployerCents,
    lineItems: r.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      name: li.name,
      amountCents: li.amountCents,
    })),
  }))

  if (employees.length === 0) {
    return { success: false, error: 'No payroll records for this period' }
  }

  // Compute summary for the period cover page (Section 4)
  const summary: PayrollSummaryData = {
    totalEmployees: employees.length,
    totalGrossCents: employees.reduce((sum, e) => sum + e.grossAmountCents, 0),
    totalCpfEmployeeCents: employees.reduce((sum, e) => sum + (e.cpfEmployeeCents ?? 0), 0),
    totalCpfEmployerCents: employees.reduce((sum, e) => sum + (e.cpfEmployerCents ?? 0), 0),
    totalNetCents: employees.reduce((sum, e) => sum + e.netAmountCents, 0),
    employeeBreakdown: employees.map((e) => ({
      name: `${e.firstName} ${e.lastName}`,
      netCents: e.netAmountCents,
    })),
  }

  const pdfData: PayslipPdfData = {
    orgName: org.name,
    logoUrl: branding.logoSignedUrl,
    periodName: result.period.name,
    periodStart: result.period.startDate,
    periodEnd: result.period.endDate,
    employees,
    summary,
  }

  const buffer = await renderToBuffer(<PayslipDocument data={pdfData} />)
  const fileName = `payroll-${result.period.name.replace(/\s+/g, '-').toLowerCase()}.pdf`

  return {
    success: true,
    data: { buffer: Array.from(new Uint8Array(buffer)), fileName },
  }
}

/**
 * Generate a PDF for a single employee's payroll record.
 * Accessible by payroll.view_all OR the employee viewing their own payslip.
 */
export async function downloadEmployeePdf(
  orgSlug: string,
  recordId: string
): Promise<PdfActionResult> {
  const session = await verifySession()
  const { org } = await getOrgContext(orgSlug)

  // Try admin permission first; if not, check own payslip access
  let hasAdminAccess = false
  try {
    await requirePermission(org.id, 'payroll.view_all')
    hasAdminAccess = true
  } catch {
    await requirePermission(org.id, 'payroll.view_own')
  }

  const record = await dbAs(session.userId, async (tx) => {
    return tx.payrollRecord.findFirst({
      where: { id: recordId, orgId: org.id },
      include: {
        period: { select: { name: true, startDate: true, endDate: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: { select: { name: true } },
            department: { select: { name: true } },
            bankName: true,
            bankAccountNumber: true,
          },
        },
        lineItems: { select: { id: true, type: true, name: true, amountCents: true } },
      },
    })
  })

  if (!record) {
    return { success: false, error: 'Payroll record not found' }
  }

  // If non-admin, verify this is the caller's own record
  if (!hasAdminAccess) {
    const employeeId = await getEmployeeIdForUser(org.id, session.userId)
    if (!employeeId || employeeId !== record.employee.id) {
      return { success: false, error: 'You do not have permission to access this payslip' }
    }
    // Non-admin can only download published payslips
    if (!record.isPublished) {
      return { success: false, error: 'This payslip has not been published yet' }
    }
  }

  const branding = await getOrgBranding(org.id)

  const employee: PayslipEmployeeData = {
    recordId: record.id,
    employeeId: record.employee.id,
    firstName: record.employee.firstName,
    lastName: record.employee.lastName,
    jobTitle: record.employee.jobTitle?.name ?? null,
    department: record.employee.department?.name ?? null,
    bankName: record.employee.bankName ?? null,
    bankAccountLast4: record.employee.bankAccountNumber
      ? `•••• ${record.employee.bankAccountNumber.slice(-4)}`
      : null,
    grossAmountCents: record.grossAmountCents,
    netAmountCents: record.netAmountCents,
    cpfEmployeeCents: record.cpfEmployeeCents,
    cpfEmployerCents: record.cpfEmployerCents,
    lineItems: record.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      name: li.name,
      amountCents: li.amountCents,
    })),
  }

  const pdfData: PayslipPdfData = {
    orgName: org.name,
    logoUrl: branding.logoSignedUrl,
    periodName: record.period.name,
    periodStart: record.period.startDate,
    periodEnd: record.period.endDate,
    employees: [employee],
  }

  const buffer = await renderToBuffer(<PayslipDocument data={pdfData} />)
  const fileName = `payslip-${record.employee.firstName}-${record.employee.lastName}-${record.period.name.replace(/\s+/g, '-').toLowerCase()}.pdf`

  return {
    success: true,
    data: { buffer: Array.from(new Uint8Array(buffer)), fileName },
  }
}
