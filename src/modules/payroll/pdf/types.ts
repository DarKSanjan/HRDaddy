/**
 * Types for payslip PDF generation.
 */

export interface PayslipEmployeeData {
  recordId: string
  employeeId: string
  firstName: string
  lastName: string
  jobTitle: string | null
  department: string | null
  bankName: string | null
  bankAccountLast4: string | null
  grossAmountCents: number
  netAmountCents: number
  cpfEmployeeCents: number | null
  cpfEmployerCents: number | null
  lineItems: Array<{
    id: string
    type: string
    name: string
    amountCents: number
  }>
}

export interface PayslipPdfData {
  orgName: string
  logoUrl: string | null
  periodName: string
  periodStart: Date
  periodEnd: Date
  employees: PayslipEmployeeData[]
  summary?: PayrollSummaryData
}

export interface PayrollSummaryData {
  totalEmployees: number
  totalGrossCents: number
  totalCpfEmployeeCents: number
  totalCpfEmployerCents: number
  totalNetCents: number
  employeeBreakdown: Array<{ name: string; netCents: number }>
}
