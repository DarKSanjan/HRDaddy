/**
 * Zod validation schemas for the Documents module.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// MIME type validation
// ─────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

// ─────────────────────────────────────────────
// Category schemas
// ─────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  isSensitive: z.boolean().default(false),
})

export const updateCategorySchema = z.object({
  categoryId: z.string().cuid(),
  name: z.string().min(1, 'Category name is required').max(100).optional(),
  isSensitive: z.boolean().optional(),
})

export const archiveCategorySchema = z.object({
  categoryId: z.string().cuid(),
})

// ─────────────────────────────────────────────
// Document schemas
// ─────────────────────────────────────────────

export const uploadDocumentSchema = z.object({
  employeeId: z.string().cuid(),
  categoryId: z.string().cuid(),
  fileName: z.string().min(1, 'File name is required').max(255),
  mimeType: z.string().refine(
    (v) => (ALLOWED_MIME_TYPES as readonly string[]).includes(v),
    'File type not allowed'
  ),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES, 'File exceeds maximum size of 25MB'),
  expiresAt: z.string().datetime().optional().or(z.literal('')),
})

export const archiveDocumentSchema = z.object({
  documentId: z.string().cuid(),
})

export const deleteDocumentSchema = z.object({
  documentId: z.string().cuid(),
})

export const replaceDocumentSchema = z.object({
  documentId: z.string().cuid(),
  fileName: z.string().min(1, 'File name is required').max(255),
  mimeType: z.string().refine(
    (v) => (ALLOWED_MIME_TYPES as readonly string[]).includes(v),
    'File type not allowed'
  ),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES, 'File exceeds maximum size of 25MB'),
})

// ─────────────────────────────────────────────
// Query schemas
// ─────────────────────────────────────────────

export const documentListParamsSchema = z.object({
  employeeId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  search: z.string().optional(),
  showArchived: z.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type ReplaceDocumentInput = z.infer<typeof replaceDocumentSchema>
export type DocumentListParams = z.infer<typeof documentListParamsSchema>
