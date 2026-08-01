'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet.
import '@/modules/register'

/**
 * Expenses module server actions.
 * Every mutation:
 *   1. Resolves org from slug
 *   2. Checks permission
 *   3. Validates input with Zod
 *   4. Performs mutation via dbAs (RLS-scoped)
 *   5. Writes audit entry
 *   6. Revalidates cache
 */
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getOrgContext, requirePermission, verifySession } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser } from '@/core/employees'
import { getStorage, buildStorageKey } from '@/core/storage'
import { validateFileContent } from '@/core/documents/file-signature'
import { createReceiptDocument } from '@/core/documents/receipts'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/modules/documents/schemas'
import {
  submitExpenseClaimSchema,
  approveExpenseClaimSchema,
  rejectExpenseClaimSchema,
  withdrawExpenseClaimSchema,
  reimburseExpenseClaimSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
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
// Category actions
// ─────────────────────────────────────────────

export async function createExpenseCategory(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'expense.category.manage')

  const parsed = createExpenseCategorySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { name } = parsed.data

  const category = await dbAs(userId, async (tx) => {
    const createdCategory = await tx.expenseCategory.create({
      data: { orgId: org.id, name },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.category.created',
      targetType: 'expense_category',
      targetId: createdCategory.id,
      after: { name },
    }, tx)

    return createdCategory
  })

  revalidatePath(`/${orgSlug}/settings/expenses`)
  return { success: true, data: { id: category.id } }
}

export async function updateExpenseCategory(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'expense.category.manage')

  const parsed = updateExpenseCategorySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { categoryId, name, isArchived } = parsed.data

  const existing = await dbAs(userId, async (tx) => {
    return tx.expenseCategory.findFirst({
      where: { id: categoryId, orgId: org.id },
    })
  })

  if (!existing) return { success: false, error: 'Category not found' }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (isArchived !== undefined) updateData.isArchived = isArchived

  await dbAs(userId, async (tx) => {
    await tx.expenseCategory.update({
      where: { id: categoryId },
      data: updateData,
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.category.updated',
      targetType: 'expense_category',
      targetId: categoryId,
      before: { name: existing.name, isArchived: existing.isArchived },
      after: updateData,
    }, tx)
  })

  revalidatePath(`/${orgSlug}/settings/expenses`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Receipt upload
// ─────────────────────────────────────────────

/**
 * Uploads a receipt for the caller's own expense claim.
 *
 * Deliberately does NOT reuse the Documents module's uploadDocument action —
 * that action requires document.upload, which defaults to ADMIN_ROLES only.
 * An employee attaching a receipt to their own claim needs to do so under
 * expense.submit instead, so this mirrors uploadDocument's storage/metadata
 * logic directly rather than gating a self-service action behind an
 * admin-only permission.
 */
export async function uploadExpenseReceipt(
  orgSlug: string,
  metadata: { fileName: string; mimeType: string; fileSize: number },
  fileBuffer: Buffer | Uint8Array
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'expense.submit')
  const session = await verifySession()
  const userId = session.userId

  const { fileName, mimeType, fileSize } = metadata

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { success: false, error: 'File type not allowed' }
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: 'File exceeds maximum size of 25MB' }
  }

  const fileContentError = validateFileContent(fileBuffer, fileSize, mimeType)
  if (fileContentError) {
    return { success: false, error: fileContentError }
  }

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const fileId = randomUUID()
  const fileKey = buildStorageKey(org.id, employeeId, fileId)

  const storage = await getStorage()
  try {
    await storage.upload(fileKey, fileBuffer, mimeType)
  } catch (err) {
    return {
      success: false,
      error: `Storage upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  let documentId: string
  try {
    documentId = await createReceiptDocument({
      orgId: org.id,
      employeeId,
      fileName,
      fileKey,
      fileSize,
      mimeType,
      actorUserId: userId,
    })
  } catch (err) {
    try {
      await storage.delete(fileKey)
    } catch {
      console.error('[Expenses] Failed to clean up orphaned storage object:', fileKey)
    }
    return {
      success: false,
      error: `Failed to save receipt: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  return { success: true, data: { id: documentId } }
}

// ─────────────────────────────────────────────
// Submit expense claim
// ─────────────────────────────────────────────

export async function submitExpenseClaim(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'expense.submit')
  const session = await verifySession()
  const userId = session.userId

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = submitExpenseClaimSchema.safeParse({
    ...raw,
    amountCents: raw.amountCents ? Number(raw.amountCents) : undefined,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const input = parsed.data

  // Validate category exists and is not archived
  const category = await dbAs(userId, async (tx) => {
    return tx.expenseCategory.findFirst({
      where: { id: input.categoryId, orgId: org.id, isArchived: false },
      select: { id: true },
    })
  })
  if (!category) {
    return { success: false, error: 'Expense category not found or is archived.' }
  }

  // If receipt document is provided, validate it exists and belongs to the
  // submitting employee — org scope alone would let someone attach another
  // employee's document (visible to it) as their own claim's receipt.
  if (input.receiptDocumentId) {
    const doc = await dbAs(userId, async (tx) => {
      return tx.employeeDocument.findFirst({
        where: { id: input.receiptDocumentId, orgId: org.id, employeeId },
        select: { id: true },
      })
    })
    if (!doc) {
      return { success: false, error: 'Receipt document not found.' }
    }
  }

  const claim = await dbAs(userId, async (tx) => {
    const createdClaim = await tx.expenseClaim.create({
      data: {
        orgId: org.id,
        employeeId,
        categoryId: input.categoryId,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        expenseDate: new Date(input.expenseDate),
        status: 'SUBMITTED',
        receiptDocumentId: input.receiptDocumentId || null,
        submittedAt: new Date(),
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.claim.submitted',
      targetType: 'expense_claim',
      targetId: createdClaim.id,
      after: {
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        expenseDate: input.expenseDate,
      },
    }, tx)

    return createdClaim
  })

  // Notify manager
  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: employeeId },
      select: {
        firstName: true,
        lastName: true,
        manager: { select: { userId: true } },
      },
    })
  })

  if (employee?.manager?.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: employee.manager.userId,
      title: 'New expense claim',
      message: `${employee.firstName} ${employee.lastName} has submitted an expense claim for ${(input.amountCents / 100).toFixed(2)} ${input.currency}.`,
      link: `/${orgSlug}/expenses/approvals`,
    })
  }

  revalidatePath(`/${orgSlug}/expenses`)
  return { success: true, data: { id: claim.id } }
}

// ─────────────────────────────────────────────
// Approve expense claim
// ─────────────────────────────────────────────

export async function approveExpenseClaim(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId, role } = await requirePermission(org.id, 'expense.approve')

  const raw = Object.fromEntries(formData.entries())
  const parsed = approveExpenseClaimSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { claimId, note } = parsed.data

  const claim = await dbAs(userId, async (tx) => {
    return tx.expenseClaim.findFirst({
      where: { id: claimId, orgId: org.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, userId: true, managerId: true } },
      },
    })
  })

  if (!claim) {
    return { success: false, error: 'Expense claim not found.' }
  }

  if (claim.status !== 'SUBMITTED') {
    return { success: false, error: 'Only submitted claims can be approved.' }
  }

  const approverEmployeeId = await getEmployeeIdForUser(org.id, userId)

  // Manager can only approve direct reports' claims
  if (role === 'MANAGER') {
    if (!approverEmployeeId || claim.employee.managerId !== approverEmployeeId) {
      return { success: false, error: 'You can only approve claims from your direct reports.' }
    }
  }

  // Cannot approve own claim
  if (approverEmployeeId === claim.employeeId) {
    return { success: false, error: 'Cannot approve your own expense claim.' }
  }

  // Conditioned on status: 'SUBMITTED' so a concurrent approve/reject on the
  // same claim can't both win — whichever transaction commits first flips
  // the status, and the second's updateMany matches zero rows.
  const approved = await dbAs(userId, async (tx) => {
    const { count } = await tx.expenseClaim.updateMany({
      where: { id: claimId, status: 'SUBMITTED' },
      data: {
        status: 'APPROVED',
        reviewedById: approverEmployeeId,
        reviewedAt: new Date(),
        reviewNotes: note || null,
      },
    })
    if (count === 0) return false

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.claim.approved',
      targetType: 'expense_claim',
      targetId: claimId,
      before: { status: 'SUBMITTED' },
      after: { status: 'APPROVED', reviewNotes: note },
    }, tx)
    return true
  })

  if (!approved) {
    return { success: false, error: 'This claim was already reviewed by someone else.' }
  }

  // Notify employee
  if (claim.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: claim.employee.userId,
      title: 'Expense claim approved',
      message: `Your expense claim has been approved.${note ? ` Note: ${note}` : ''}`,
      link: `/${orgSlug}/expenses`,
    })
  }

  revalidatePath(`/${orgSlug}/expenses`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Reject expense claim
// ─────────────────────────────────────────────

export async function rejectExpenseClaim(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId, role } = await requirePermission(org.id, 'expense.approve')

  const raw = Object.fromEntries(formData.entries())
  const parsed = rejectExpenseClaimSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Rejection reason is required.' }
  }

  const { claimId, reason } = parsed.data

  const claim = await dbAs(userId, async (tx) => {
    return tx.expenseClaim.findFirst({
      where: { id: claimId, orgId: org.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, userId: true, managerId: true } },
      },
    })
  })

  if (!claim) {
    return { success: false, error: 'Expense claim not found.' }
  }

  if (claim.status !== 'SUBMITTED') {
    return { success: false, error: 'Only submitted claims can be rejected.' }
  }

  const approverEmployeeId = await getEmployeeIdForUser(org.id, userId)

  // Manager can only reject direct reports' claims
  if (role === 'MANAGER') {
    if (!approverEmployeeId || claim.employee.managerId !== approverEmployeeId) {
      return { success: false, error: 'You can only reject claims from your direct reports.' }
    }
  }

  // Same conditional-update race guard as approveExpenseClaim.
  const rejected = await dbAs(userId, async (tx) => {
    const { count } = await tx.expenseClaim.updateMany({
      where: { id: claimId, status: 'SUBMITTED' },
      data: {
        status: 'REJECTED',
        reviewedById: approverEmployeeId,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
    })
    if (count === 0) return false

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.claim.rejected',
      targetType: 'expense_claim',
      targetId: claimId,
      before: { status: 'SUBMITTED' },
      after: { status: 'REJECTED', reviewNotes: reason },
    }, tx)
    return true
  })

  if (!rejected) {
    return { success: false, error: 'This claim was already reviewed by someone else.' }
  }

  // Notify employee
  if (claim.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: claim.employee.userId,
      title: 'Expense claim rejected',
      message: `Your expense claim was rejected. Reason: ${reason}`,
      link: `/${orgSlug}/expenses`,
    })
  }

  revalidatePath(`/${orgSlug}/expenses`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Withdraw expense claim (employee pulls back their own)
// ─────────────────────────────────────────────

export async function withdrawExpenseClaim(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const session = await verifySession()
  const userId = session.userId

  const raw = Object.fromEntries(formData.entries())
  const parsed = withdrawExpenseClaimSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { claimId } = parsed.data
  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const claim = await dbAs(userId, async (tx) => {
    return tx.expenseClaim.findFirst({
      where: { id: claimId, orgId: org.id, employeeId },
      select: { id: true, status: true },
    })
  })

  if (!claim) {
    return { success: false, error: 'Expense claim not found or not yours.' }
  }

  // Can only withdraw DRAFT or SUBMITTED claims
  if (claim.status !== 'DRAFT' && claim.status !== 'SUBMITTED') {
    return { success: false, error: 'Cannot withdraw a claim that has already been reviewed.' }
  }

  await dbAs(userId, async (tx) => {
    await tx.expenseClaim.delete({
      where: { id: claimId },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.claim.withdrawn',
      targetType: 'expense_claim',
      targetId: claimId,
      before: { status: claim.status },
      after: { status: 'WITHDRAWN (deleted)' },
    }, tx)
  })

  revalidatePath(`/${orgSlug}/expenses`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Mark as reimbursed (ADMIN_ROLES only)
// ─────────────────────────────────────────────

export async function markExpenseReimbursed(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'expense.reimburse')

  const raw = Object.fromEntries(formData.entries())
  const parsed = reimburseExpenseClaimSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { claimId } = parsed.data

  const claim = await dbAs(userId, async (tx) => {
    return tx.expenseClaim.findFirst({
      where: { id: claimId, orgId: org.id },
      include: {
        employee: { select: { userId: true, firstName: true, lastName: true } },
      },
    })
  })

  if (!claim) {
    return { success: false, error: 'Expense claim not found.' }
  }

  if (claim.status !== 'APPROVED') {
    return { success: false, error: 'Only approved claims can be marked as reimbursed.' }
  }

  await dbAs(userId, async (tx) => {
    await tx.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: 'REIMBURSED',
        reimbursedAt: new Date(),
      },
    })

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'expense.claim.reimbursed',
      targetType: 'expense_claim',
      targetId: claimId,
      before: { status: 'APPROVED' },
      after: { status: 'REIMBURSED' },
    }, tx)
  })

  // Notify employee
  if (claim.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: claim.employee.userId,
      title: 'Expense reimbursed',
      message: `Your expense claim for ${(claim.amountCents / 100).toFixed(2)} ${claim.currency} has been reimbursed.`,
      link: `/${orgSlug}/expenses`,
    })
  }

  revalidatePath(`/${orgSlug}/expenses`)
  return { success: true }
}
