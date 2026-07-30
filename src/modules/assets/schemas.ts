/**
 * Assets module schemas — Zod validation for all inputs.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// Category schemas
// ─────────────────────────────────────────────

export const createAssetCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
})

export const updateAssetCategorySchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1, 'Category name is required').max(100).optional(),
  isArchived: z.boolean().optional(),
})

// ─────────────────────────────────────────────
// Asset schemas
// ─────────────────────────────────────────────

export const createAssetSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Asset name is required').max(200),
  assetTag: z.string().min(1, 'Asset tag is required').max(100),
  purchaseDate: z.string().optional(),
  purchaseValueCents: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  personInChargeId: z.string().optional(),
})

export const updateAssetSchema = z.object({
  assetId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  assetTag: z.string().min(1).max(100).optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseValueCents: z.coerce.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  personInChargeId: z.string().nullable().optional(),
})

// ─────────────────────────────────────────────
// Assignment schemas
// ─────────────────────────────────────────────

export const assignAssetSchema = z.object({
  assetId: z.string().min(1),
  employeeId: z.string().min(1, 'Employee is required'),
  conditionAtAssignment: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

export const returnAssetSchema = z.object({
  assetId: z.string().min(1),
  conditionAtReturn: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  returnToMaintenance: z.boolean().optional(),
})

// ─────────────────────────────────────────────
// Status transition schemas
// ─────────────────────────────────────────────

export const markAssetMaintenanceSchema = z.object({
  assetId: z.string().min(1),
  notes: z.string().max(1000).optional(),
})

export const markAssetAvailableSchema = z.object({
  assetId: z.string().min(1),
  notes: z.string().max(1000).optional(),
})

export const retireAssetSchema = z.object({
  assetId: z.string().min(1),
  notes: z.string().max(1000).optional(),
})

export const reportAssetLostSchema = z.object({
  assetId: z.string().min(1),
  notes: z.string().max(1000).optional(),
})

// ─────────────────────────────────────────────
// Query schemas
// ─────────────────────────────────────────────

export const assetListParamsSchema = z.object({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED', 'LOST']).optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

// ─────────────────────────────────────────────
// Asset request schemas
// ─────────────────────────────────────────────

export const requestAssetSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  requestedAssetId: z.string().optional(),
  reason: z.string().min(1, 'Reason is required').max(2000),
})

export const cancelAssetRequestSchema = z.object({
  requestId: z.string().min(1),
})

export const approveAssetRequestSchema = z.object({
  requestId: z.string().min(1),
  reviewNote: z.string().max(1000).optional(),
})

export const rejectAssetRequestSchema = z.object({
  requestId: z.string().min(1),
  reviewNote: z.string().min(1, 'Rejection reason is required').max(1000),
})

export const fulfillAssetRequestSchema = z.object({
  requestId: z.string().min(1),
  assetId: z.string().min(1, 'Asset is required'),
})

export const assetRequestListParamsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED']).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

// ─────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────

export type CreateAssetCategoryInput = z.infer<typeof createAssetCategorySchema>
export type UpdateAssetCategoryInput = z.infer<typeof updateAssetCategorySchema>
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
export type AssignAssetInput = z.infer<typeof assignAssetSchema>
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>
export type MarkAssetMaintenanceInput = z.infer<typeof markAssetMaintenanceSchema>
export type MarkAssetAvailableInput = z.infer<typeof markAssetAvailableSchema>
export type RetireAssetInput = z.infer<typeof retireAssetSchema>
export type ReportAssetLostInput = z.infer<typeof reportAssetLostSchema>
export type AssetListParams = z.infer<typeof assetListParamsSchema>
export type RequestAssetInput = z.infer<typeof requestAssetSchema>
export type CancelAssetRequestInput = z.infer<typeof cancelAssetRequestSchema>
export type ApproveAssetRequestInput = z.infer<typeof approveAssetRequestSchema>
export type RejectAssetRequestInput = z.infer<typeof rejectAssetRequestSchema>
export type FulfillAssetRequestInput = z.infer<typeof fulfillAssetRequestSchema>
export type AssetRequestListParams = z.infer<typeof assetRequestListParamsSchema>
