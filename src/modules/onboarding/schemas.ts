/**
 * Zod validation schemas for the Onboarding module.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// Template schemas
// ─────────────────────────────────────────────

export const createTemplateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  assigneeType: z.enum(['EMPLOYEE', 'MANAGER', 'HR']),
  dueInDays: z.coerce.number().int().min(0, 'Due days must be non-negative').max(365),
  sortOrder: z.coerce.number().int().min(0),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  tasks: z.array(createTemplateTaskSchema).min(1, 'At least one task is required'),
})

export const updateTemplateSchema = z.object({
  templateId: z.string().cuid(),
  name: z.string().min(1, 'Template name is required').max(200).optional(),
  description: z.string().max(1000).optional().or(z.literal('')),
  tasks: z.array(createTemplateTaskSchema).min(1, 'At least one task is required').optional(),
})

export const archiveTemplateSchema = z.object({
  templateId: z.string().cuid(),
})

// ─────────────────────────────────────────────
// Assignment schemas
// ─────────────────────────────────────────────

export const assignOnboardingSchema = z.object({
  employeeId: z.string().cuid(),
  templateId: z.string().cuid(),
})

export const cancelOnboardingSchema = z.object({
  onboardingId: z.string().cuid(),
  reason: z.string().min(1, 'Reason is required').max(500),
})

// ─────────────────────────────────────────────
// Task schemas
// ─────────────────────────────────────────────

export const completeTaskSchema = z.object({
  taskId: z.string().cuid(),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

export const waiveTaskSchema = z.object({
  taskId: z.string().cuid(),
  reason: z.string().min(1, 'Reason is required').max(500),
})

export const reopenTaskSchema = z.object({
  taskId: z.string().cuid(),
})

// ─────────────────────────────────────────────
// Query schemas
// ─────────────────────────────────────────────

export const onboardingListParamsSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type AssignOnboardingInput = z.infer<typeof assignOnboardingSchema>
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>
export type WaiveTaskInput = z.infer<typeof waiveTaskSchema>
export type OnboardingListParams = z.infer<typeof onboardingListParamsSchema>
