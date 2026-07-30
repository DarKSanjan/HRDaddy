/**
 * Expenses module queries — data fetching with role-scoped access.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { ExpenseClaimStatus } from '@prisma/client'
import type { ExpenseListParams } from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExpenseCategoryItem {
  id: string
  name: string
  isArchived: boolean
  createdAt: Date
  _count: { claims: number }
}

export interface ExpenseClaimItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  categoryId: string
  categoryName: string
  amountCents: number
  currency: string
  description: string
  expenseDate: Date
  status: ExpenseClaimStatus
  receiptDocumentId: string | null
  submittedAt: Date | null
  reviewedById: string | null
  reviewedAt: Date | null
  reviewNotes: string | null
  reimbursedAt: Date | null
  createdAt: Date
}

// ─────────────────────────────────────────────
// Category queries
// ─────────────────────────────────────────────

/**
 * List expense categories for an organisation.
 */
export async function listExpenseCategories(
  userId: string,
  orgId: string
): Promise<ExpenseCategoryItem[]> {
  return dbAs(userId, async (tx) => {
    const categories = await tx.expenseCategory.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { claims: true } } },
    })
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      isArchived: c.isArchived,
      createdAt: c.createdAt,
      _count: { claims: c._count.claims },
    }))
  })
}

/**
 * List active (non-archived) expense categories.
 */
export async function listActiveExpenseCategories(
  userId: string,
  orgId: string
): Promise<{ id: string; name: string }[]> {
  return dbAs(userId, async (tx) => {
    return tx.expenseCategory.findMany({
      where: { orgId, isArchived: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
  })
}

// ─────────────────────────────────────────────
// Claim queries
// ─────────────────────────────────────────────

/**
 * List own expense claims for an employee.
 */
export async function listOwnExpenseClaims(
  userId: string,
  orgId: string,
  employeeId: string,
  params: ExpenseListParams
): Promise<{ claims: ExpenseClaimItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      employeeId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    }

    const claims = await tx.expenseClaim.findMany({
      where,
      include: {
        category: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    })
    const total = await tx.expenseClaim.count({ where })

    return {
      claims: claims.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeFirstName: c.employee.firstName,
        employeeLastName: c.employee.lastName,
        categoryId: c.categoryId,
        categoryName: c.category.name,
        amountCents: c.amountCents,
        currency: c.currency,
        description: c.description,
        expenseDate: c.expenseDate,
        status: c.status,
        receiptDocumentId: c.receiptDocumentId,
        submittedAt: c.submittedAt,
        reviewedById: c.reviewedById,
        reviewedAt: c.reviewedAt,
        reviewNotes: c.reviewNotes,
        reimbursedAt: c.reimbursedAt,
        createdAt: c.createdAt,
      })),
      total,
    }
  })
}

/**
 * List pending expense claims for a manager's direct reports.
 */
export async function listTeamPendingExpenseClaims(
  userId: string,
  orgId: string,
  managerEmployeeId: string
): Promise<ExpenseClaimItem[]> {
  return dbAs(userId, async (tx) => {
    const claims = await tx.expenseClaim.findMany({
      where: {
        orgId,
        status: 'SUBMITTED',
        employee: { managerId: managerEmployeeId },
      },
      include: {
        category: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return claims.map((c) => ({
      id: c.id,
      employeeId: c.employeeId,
      employeeFirstName: c.employee.firstName,
      employeeLastName: c.employee.lastName,
      categoryId: c.categoryId,
      categoryName: c.category.name,
      amountCents: c.amountCents,
      currency: c.currency,
      description: c.description,
      expenseDate: c.expenseDate,
      status: c.status,
      receiptDocumentId: c.receiptDocumentId,
      submittedAt: c.submittedAt,
      reviewedById: c.reviewedById,
      reviewedAt: c.reviewedAt,
      reviewNotes: c.reviewNotes,
      reimbursedAt: c.reimbursedAt,
      createdAt: c.createdAt,
    }))
  })
}

/**
 * List all expense claims (for HR Admin / Owner).
 */
export async function listAllExpenseClaims(
  userId: string,
  orgId: string,
  params: ExpenseListParams
): Promise<{ claims: ExpenseClaimItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    }

    const claims = await tx.expenseClaim.findMany({
      where,
      include: {
        category: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    })
    const total = await tx.expenseClaim.count({ where })

    return {
      claims: claims.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeFirstName: c.employee.firstName,
        employeeLastName: c.employee.lastName,
        categoryId: c.categoryId,
        categoryName: c.category.name,
        amountCents: c.amountCents,
        currency: c.currency,
        description: c.description,
        expenseDate: c.expenseDate,
        status: c.status,
        receiptDocumentId: c.receiptDocumentId,
        submittedAt: c.submittedAt,
        reviewedById: c.reviewedById,
        reviewedAt: c.reviewedAt,
        reviewNotes: c.reviewNotes,
        reimbursedAt: c.reimbursedAt,
        createdAt: c.createdAt,
      })),
      total,
    }
  })
}

/**
 * Count pending expense claims for approvals badge.
 */
export async function countPendingExpenseClaims(
  userId: string,
  orgId: string,
  managerEmployeeId: string | null
): Promise<number> {
  return dbAs(userId, async (tx) => {
    if (managerEmployeeId) {
      return tx.expenseClaim.count({
        where: {
          orgId,
          status: 'SUBMITTED',
          employee: { managerId: managerEmployeeId },
        },
      })
    }
    return tx.expenseClaim.count({
      where: { orgId, status: 'SUBMITTED' },
    })
  })
}
