'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Documents module server actions.
 * Every mutation:
 *   1. Resolves org from slug (never trusts client-provided orgId)
 *   2. Checks permission
 *   3. Validates input with Zod
 *   4. Performs mutation via dbAs (RLS-scoped)
 *   5. Writes audit entry
 *   6. Revalidates cache
 *
 * CRITICAL: Uses getStorage() (caller-scoped) never getStorageUnscoped() in
 * request paths. Partial-failure cleanup in both directions.
 */
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { getStorage, buildStorageKey } from '@/core/storage'
import {
  createCategorySchema,
  updateCategorySchema,
  uploadDocumentSchema,
  replaceDocumentSchema,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
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

export async function createCategory(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.category.manage')

  const parsed = createCategorySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { name, isSensitive } = parsed.data

  const category = await dbAs(userId, async (tx) => {
    return tx.documentCategory.create({
      data: { orgId: org.id, name, isSensitive },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'document.category.created',
    targetType: 'document_category',
    targetId: category.id,
    after: { name, isSensitive },
  })

  revalidatePath(`/${orgSlug}/documents`)
  return { success: true, data: { id: category.id } }
}

export async function updateCategory(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.category.manage')

  const parsed = updateCategorySchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { categoryId, name, isSensitive } = parsed.data

  const existing = await dbAs(userId, async (tx) => {
    return tx.documentCategory.findFirst({
      where: { id: categoryId, orgId: org.id },
    })
  })

  if (!existing) return { success: false, error: 'Category not found' }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (isSensitive !== undefined) updateData.isSensitive = isSensitive

  await dbAs(userId, async (tx) => {
    await tx.documentCategory.update({
      where: { id: categoryId },
      data: updateData,
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'document.category.updated',
    targetType: 'document_category',
    targetId: categoryId,
    before: { name: existing.name, isSensitive: existing.isSensitive },
    after: updateData,
  })

  revalidatePath(`/${orgSlug}/documents`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Document upload
// ─────────────────────────────────────────────

/**
 * Upload a document.
 *
 * Partial-failure handling:
 * - If storage upload succeeds but metadata write fails: delete the uploaded object.
 * - If metadata write would proceed without a successful upload: never create metadata.
 *
 * This ensures no orphaned objects and no metadata referencing non-existent files.
 */
export async function uploadDocument(
  orgSlug: string,
  metadata: unknown,
  fileBuffer: Buffer | Uint8Array
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.upload')

  const parsed = uploadDocumentSchema.safeParse(metadata)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { employeeId, categoryId, fileName, mimeType, fileSize, expiresAt } = parsed.data

  // Server-side MIME + size validation (do not rely on client)
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { success: false, error: 'File type not allowed' }
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: 'File exceeds maximum size of 25MB' }
  }

  // Validate employee exists
  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: employeeId, orgId: org.id },
      select: { id: true },
    })
  })
  if (!employee) return { success: false, error: 'Employee not found' }

  // Validate category exists and sensitivity rules
  const category = await dbAs(userId, async (tx) => {
    return tx.documentCategory.findFirst({
      where: { id: categoryId, orgId: org.id },
      select: { id: true, isSensitive: true },
    })
  })
  if (!category) return { success: false, error: 'Category not found' }

  // Get uploader's employee record
  const uploaderEmployee = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { orgId: org.id, userId },
      select: { id: true },
    })
  })
  if (!uploaderEmployee) return { success: false, error: 'Uploader employee record not found' }

  // Build storage key
  const fileId = randomUUID()
  const fileKey = buildStorageKey(org.id, employeeId, fileId)

  // Step 1: Upload file to storage
  const storage = await getStorage()
  try {
    await storage.upload(fileKey, fileBuffer, mimeType)
  } catch (err) {
    return {
      success: false,
      error: `Storage upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  // Step 2: Write metadata. If this fails, clean up the uploaded object.
  let documentId: string
  try {
    const doc = await dbAs(userId, async (tx) => {
      return tx.employeeDocument.create({
        data: {
          orgId: org.id,
          employeeId,
          categoryId,
          fileName,
          fileKey,
          fileSize,
          mimeType,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          uploadedById: uploaderEmployee.id,
        },
      })
    })
    documentId = doc.id
  } catch (err) {
    // Metadata write failed — remove the uploaded object to prevent orphan
    try {
      await storage.delete(fileKey)
    } catch {
      // Best effort cleanup; a sweep job handles leftovers
      console.error('[Documents] Failed to clean up orphaned storage object:', fileKey)
    }
    return {
      success: false,
      error: `Failed to save document metadata: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'document.uploaded',
    targetType: 'employee_document',
    targetId: documentId,
    after: { fileName, employeeId, categoryId, fileSize, mimeType },
  })

  revalidatePath(`/${orgSlug}/documents`)
  return { success: true, data: { id: documentId } }
}

// ─────────────────────────────────────────────
// Document download (signed URL generation)
// ─────────────────────────────────────────────

export async function getDocumentDownloadUrl(
  orgSlug: string,
  documentId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.view_own')

  const doc = await dbAs(userId, async (tx) => {
    return tx.employeeDocument.findFirst({
      where: { id: documentId, orgId: org.id },
      select: {
        id: true,
        fileKey: true,
        fileName: true,
        employeeId: true,
        category: { select: { isSensitive: true } },
      },
    })
  })

  if (!doc) return { success: false, error: 'Document not found' }

  // If sensitive, require view_all permission
  if (doc.category.isSensitive) {
    try {
      await requirePermission(org.id, 'document.view_all')
    } catch {
      return { success: false, error: 'You do not have permission to access sensitive documents' }
    }
  }

  const storage = await getStorage()
  try {
    const url = await storage.getSignedUrl(doc.fileKey, 60)

    await writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'document.downloaded',
      targetType: 'employee_document',
      targetId: documentId,
      metadata: { fileName: doc.fileName },
    })

    return { success: true, data: { url, fileName: doc.fileName } }
  } catch (err) {
    return {
      success: false,
      error: `Failed to generate download URL: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

// ─────────────────────────────────────────────
// Document replace
// ─────────────────────────────────────────────

export async function replaceDocument(
  orgSlug: string,
  metadata: unknown,
  fileBuffer: Buffer | Uint8Array
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.upload')

  const parsed = replaceDocumentSchema.safeParse(metadata)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { documentId, fileName, mimeType, fileSize } = parsed.data

  // Get existing doc
  const existing = await dbAs(userId, async (tx) => {
    return tx.employeeDocument.findFirst({
      where: { id: documentId, orgId: org.id },
      select: {
        id: true,
        fileKey: true,
        fileName: true,
        employeeId: true,
        isArchived: true,
      },
    })
  })

  if (!existing) return { success: false, error: 'Document not found' }
  if (existing.isArchived) return { success: false, error: 'Cannot replace an archived document' }

  // Build new key
  const newFileId = randomUUID()
  const newFileKey = buildStorageKey(org.id, existing.employeeId, newFileId)

  const storage = await getStorage()

  // Upload new file first
  try {
    await storage.upload(newFileKey, fileBuffer, mimeType)
  } catch (err) {
    return {
      success: false,
      error: `Storage upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  // Update metadata
  try {
    await dbAs(userId, async (tx) => {
      await tx.employeeDocument.update({
        where: { id: documentId },
        data: { fileKey: newFileKey, fileName, fileSize, mimeType },
      })
    })
  } catch (err) {
    // Clean up the new upload
    try {
      await storage.delete(newFileKey)
    } catch {
      console.error('[Documents] Failed to clean up orphaned replacement:', newFileKey)
    }
    return {
      success: false,
      error: `Failed to update document metadata: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  // Delete old file (best effort — stale objects are cleaned by sweep job)
  try {
    await storage.delete(existing.fileKey)
  } catch {
    console.error('[Documents] Failed to delete old file:', existing.fileKey)
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'document.replaced',
    targetType: 'employee_document',
    targetId: documentId,
    before: { fileName: existing.fileName },
    after: { fileName, fileSize, mimeType },
  })

  revalidatePath(`/${orgSlug}/documents`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Archive and delete
// ─────────────────────────────────────────────

export async function archiveDocument(
  orgSlug: string,
  documentId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.upload')

  const doc = await dbAs(userId, async (tx) => {
    return tx.employeeDocument.findFirst({
      where: { id: documentId, orgId: org.id },
      select: { id: true, fileName: true, isArchived: true },
    })
  })

  if (!doc) return { success: false, error: 'Document not found' }
  if (doc.isArchived) return { success: false, error: 'Document is already archived' }

  await dbAs(userId, async (tx) => {
    await tx.employeeDocument.update({
      where: { id: documentId },
      data: { isArchived: true },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'document.archived',
    targetType: 'employee_document',
    targetId: documentId,
    metadata: { fileName: doc.fileName },
  })

  revalidatePath(`/${orgSlug}/documents`)
  return { success: true }
}

export async function deleteDocument(
  orgSlug: string,
  documentId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'document.view_all')

  const doc = await dbAs(userId, async (tx) => {
    return tx.employeeDocument.findFirst({
      where: { id: documentId, orgId: org.id },
      select: { id: true, fileKey: true, fileName: true, isArchived: true },
    })
  })

  if (!doc) return { success: false, error: 'Document not found' }
  if (!doc.isArchived) {
    return { success: false, error: 'Document must be archived before deletion' }
  }

  // Delete storage object
  const storage = await getStorage()
  try {
    await storage.delete(doc.fileKey)
  } catch {
    // Continue with metadata deletion even if storage fails
    console.error('[Documents] Failed to delete storage object:', doc.fileKey)
  }

  // Delete metadata
  await dbAs(userId, async (tx) => {
    await tx.employeeDocument.delete({ where: { id: documentId } })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'document.deleted',
    targetType: 'employee_document',
    targetId: documentId,
    metadata: { fileName: doc.fileName },
  })

  revalidatePath(`/${orgSlug}/documents`)
  return { success: true }
}
