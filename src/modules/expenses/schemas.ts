/**
 * Expenses module schemas — Zod validation for all inputs.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// Category schemas
// ─────────────────────────────────────────────

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
})

export const updateExpenseCategorySchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1, 'Category name is required').max(100).optional(),
  isArchived: z.boolean().optional(),
})

// ─────────────────────────────────────────────
// Expense claim schemas
// ─────────────────────────────────────────────

export const submitExpenseClaimSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amountCents: z.coerce.number().int().min(1, 'Amount must be greater than zero'),
  currency: z.string().min(1, 'Currency is required').max(3),
  description: z.string().min(1, 'Description is required').max(1000),
  expenseDate: z.string().min(1, 'Expense date is required'),
  receiptDocumentId: z.string().optional(),
})

export const approveExpenseClaimSchema = z.object({
  claimId: z.string().min(1),
  note: z.string().optional(),
})

export const rejectExpenseClaimSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().min(1, 'Rejection reason is required'),
})

export const withdrawExpenseClaimSchema = z.object({
  claimId: z.string().min(1),
})

export const reimburseExpenseClaimSchema = z.object({
  claimId: z.string().min(1),
})

// ─────────────────────────────────────────────
// Query schemas
// ─────────────────────────────────────────────

export const expenseListParamsSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>
export type SubmitExpenseClaimInput = z.infer<typeof submitExpenseClaimSchema>
export type ApproveExpenseClaimInput = z.infer<typeof approveExpenseClaimSchema>
export type RejectExpenseClaimInput = z.infer<typeof rejectExpenseClaimSchema>
export type WithdrawExpenseClaimInput = z.infer<typeof withdrawExpenseClaimSchema>
export type ReimburseExpenseClaimInput = z.infer<typeof reimburseExpenseClaimSchema>
export type ExpenseListParams = z.infer<typeof expenseListParamsSchema>
