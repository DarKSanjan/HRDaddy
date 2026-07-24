/**
 * Payroll module schemas — Zod validation for all inputs.
 * Includes MOM-mandated payslip validation requiring all 12 items.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// Action Input Schemas
// ─────────────────────────────────────────────

export const processPayrollSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
})

export const submitForReviewSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
})

export const approvePayrollSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
})

export const publishPayrollSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
})

export const markAsPaidSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
})

export const reopenPayrollSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
  reason: z.string().min(1, 'Reason for reopening is required'),
})

// ─────────────────────────────────────────────
// Query Params Schemas
// ─────────────────────────────────────────────

export const payrollListParamsSchema = z.object({
  status: z.enum(['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'PAID', 'ARCHIVED', 'REOPENED']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

// ─────────────────────────────────────────────
// MOM-Mandated Payslip Validation (12 Items)
// ─────────────────────────────────────────────

const allowanceItemSchema = z.object({
  name: z.string().min(1, 'Allowance name is required'),
  amountCents: z.number().int().min(0),
})

const deductionItemSchema = z.object({
  name: z.string().min(1, 'Deduction name is required'),
  amountCents: z.number().int().min(0),
})

const additionalPaymentSchema = z.object({
  name: z.string().min(1, 'Payment name is required'),
  amountCents: z.number().int().min(0),
})

/**
 * MOM Employment Act requires these 12 items on every payslip.
 * A payslip CANNOT be published unless all 12 items validate.
 *
 * 1. Full name of employer
 * 2. Full name of employee
 * 3. Date of payment
 * 4. Basic salary (for the salary period)
 * 5. Start of salary period
 * 6. End of salary period
 * 7. Allowances paid (itemised)
 * 8. Any additional payments (bonus, rest day pay etc.)
 * 9. Deductions (itemised)
 * 10. Overtime hours worked
 * 11. Overtime pay
 * 12. Start/end of overtime payment period (if differs from salary period)
 * 13. Net salary paid
 */
export const momPayslipSchema = z.object({
  // Item 1: Employer name
  employerName: z.string().min(1, 'Employer name is required (MOM Item 1)'),

  // Item 2: Employee name
  employeeName: z.string().min(1, 'Employee name is required (MOM Item 2)'),

  // Item 3: Date of payment
  dateOfPayment: z.string().min(1, 'Date of payment is required (MOM Item 3)'),

  // Item 4: Basic salary
  basicSalaryCents: z.number().int().min(0, 'Basic salary must be non-negative (MOM Item 4)'),

  // Item 5: Start of salary period
  salaryPeriodStart: z.string().min(1, 'Salary period start is required (MOM Item 5)'),

  // Item 6: End of salary period
  salaryPeriodEnd: z.string().min(1, 'Salary period end is required (MOM Item 6)'),

  // Item 7: Allowances (can be empty array but must be present)
  allowances: z.array(allowanceItemSchema).default([]),

  // Item 8: Additional payments (can be empty array but must be present)
  additionalPayments: z.array(additionalPaymentSchema).default([]),

  // Item 9: Deductions (can be empty array but must be present)
  deductions: z.array(deductionItemSchema).default([]),

  // Item 10: Overtime hours
  overtimeHours: z.number().min(0, 'Overtime hours must be non-negative (MOM Item 10)'),

  // Item 11: Overtime pay
  overtimePayCents: z.number().int().min(0, 'Overtime pay must be non-negative (MOM Item 11)'),

  // Item 12: Overtime period (if differs from salary period)
  overtimePeriodStart: z.string().nullable().optional(),
  overtimePeriodEnd: z.string().nullable().optional(),

  // Item 13 (computed): Net salary
  netSalaryCents: z.number().int('Net salary must be an integer (MOM Item 13)'),
})

// ─────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────

export type ProcessPayrollInput = z.infer<typeof processPayrollSchema>
export type SubmitForReviewInput = z.infer<typeof submitForReviewSchema>
export type ApprovePayrollInput = z.infer<typeof approvePayrollSchema>
export type PublishPayrollInput = z.infer<typeof publishPayrollSchema>
export type MarkAsPaidInput = z.infer<typeof markAsPaidSchema>
export type ReopenPayrollInput = z.infer<typeof reopenPayrollSchema>
export type PayrollListParams = z.infer<typeof payrollListParamsSchema>
export type MomPayslipData = z.infer<typeof momPayslipSchema>
