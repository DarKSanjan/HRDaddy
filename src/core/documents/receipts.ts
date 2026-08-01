import 'server-only'

import { dbAdmin } from '@/core/db/admin'
import { writeAudit } from '@/core/audit'

const RECEIPT_CATEGORY_NAME = 'Receipts'

/**
 * Find-or-create the org's "Receipts" document category, and insert the
 * employee_documents row for a self-uploaded expense receipt.
 *
 * document_categories_insert and employee_documents_insert are both
 * OWNER/HR_ADMIN-only under RLS (00020) — by design, the general Documents
 * module is admin-managed. Expense receipts are the one legitimate
 * self-service exception: expense.submit is open to every role, and every
 * value written here is either server-validated (file content/size, MIME
 * family) or taken from the caller's own verified session/employee record,
 * never raw user input, so running it through dbAdmin (bypassing RLS) is
 * safe. Same pattern as provisionLeaveBalances.
 */
export async function createReceiptDocument(input: {
  orgId: string
  employeeId: string
  fileName: string
  fileKey: string
  fileSize: number
  mimeType: string
  actorUserId: string
}): Promise<string> {
  const documentId = await dbAdmin.$transaction(async (tx) => {
    const existingCategory = await tx.documentCategory.findFirst({
      where: { orgId: input.orgId, name: RECEIPT_CATEGORY_NAME },
      select: { id: true },
    })
    const categoryId =
      existingCategory?.id ??
      (
        await tx.documentCategory.create({
          data: { orgId: input.orgId, name: RECEIPT_CATEGORY_NAME },
        })
      ).id

    const document = await tx.employeeDocument.create({
      data: {
        orgId: input.orgId,
        employeeId: input.employeeId,
        categoryId,
        fileName: input.fileName,
        fileKey: input.fileKey,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        uploadedById: input.employeeId,
      },
    })

    return document.id
  })

  // No tx passed: write_audit_log() is only executable as app_user, and reads
  // the actor from auth.uid(), which is unset on this service-role connection.
  // The plain dbAdmin insert path (see writeAudit's docstring) is correct here.
  await writeAudit({
    orgId: input.orgId,
    actorId: input.actorUserId,
    action: 'expense.receipt.uploaded',
    targetType: 'employee_document',
    targetId: documentId,
    after: {
      fileName: input.fileName,
      employeeId: input.employeeId,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
    },
  })

  return documentId
}
