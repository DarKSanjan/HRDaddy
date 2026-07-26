/**
 * Zod validation schemas for the Employees module.
 * Used in server actions for input validation.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────
// Employee schemas
// ─────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  workEmail: z.string().email('Invalid email address'),
  personalEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  nationalId: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  departmentId: z.string().optional().or(z.literal('')),
  jobTitleId: z.string().optional().or(z.literal('')),
  locationId: z.string().optional().or(z.literal('')),
  employmentTypeId: z.string().optional().or(z.literal('')),
  managerId: z.string().optional().or(z.literal('')),
  compensationAmountCents: z.number().int().min(0).optional(),
  compensationCurrency: z.string().length(3).optional().or(z.literal('')),
  payType: z.enum(['SALARIED', 'HOURLY']).optional(),
  isWorkman: z.boolean().optional(),
  shiftTemplateId: z.string().optional().or(z.literal('')),
  inviteToPortal: z.boolean().optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  employeeId: z.string().min(1, 'Invalid employee ID'),
})

export const changeStatusSchema = z.object({
  employeeId: z.string().min(1, 'Invalid employee ID'),
  newStatus: z.enum(['DRAFT', 'INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'ARCHIVED']),
  reason: z.string().optional(),
  reassignManagerId: z.string().optional().or(z.literal('')),
})

export const assignManagerSchema = z.object({
  employeeId: z.string().min(1, 'Invalid employee ID'),
  managerId: z.string().optional().or(z.literal('')),
})

// ─────────────────────────────────────────────
// Org structure schemas
// ─────────────────────────────────────────────

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  managerId: z.string().optional().or(z.literal('')),
})

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  departmentId: z.string().min(1, 'Invalid department ID'),
})

export const createJobTitleSchema = z.object({
  name: z.string().min(1, 'Job title is required').max(100),
})

export const updateJobTitleSchema = createJobTitleSchema.extend({
  jobTitleId: z.string().min(1, 'Invalid job title ID'),
})

export const createWorkLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(100),
  address: z.string().max(500).optional().or(z.literal('')),
})

export const updateWorkLocationSchema = createWorkLocationSchema.partial().extend({
  locationId: z.string().min(1, 'Invalid location ID'),
})

export const createEmploymentTypeSchema = z.object({
  name: z.string().min(1, 'Employment type name is required').max(100),
  defaultShiftTemplateId: z.string().optional().or(z.literal('')),
})

export const updateEmploymentTypeSchema = createEmploymentTypeSchema.extend({
  employmentTypeId: z.string().min(1, 'Invalid employment type ID'),
})

// ─────────────────────────────────────────────
// Shift Template schemas
// ─────────────────────────────────────────────

export const createShiftTemplateSchema = z.object({
  name: z.string().min(1, 'Shift template name is required').max(100),
  startMinutes: z.coerce.number().int().min(0).max(1439),
  endMinutes: z.coerce.number().int().min(0).max(1439),
  standardMinutesPerDay: z.coerce.number().int().min(1).max(1440),
  overtimeMultiplier: z.coerce.number().min(1.0).max(9.99).optional(),
  restDayMultiplier: z.coerce.number().min(1.0).max(9.99).optional(),
})

export const updateShiftTemplateSchema = createShiftTemplateSchema.partial().extend({
  shiftTemplateId: z.string().min(1, 'Invalid shift template ID'),
})

export const archiveShiftTemplateSchema = z.object({
  shiftTemplateId: z.string().min(1, 'Invalid shift template ID'),
})

// ─────────────────────────────────────────────
// Query / filter schemas
// ─────────────────────────────────────────────

export const employeeListParamsSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(['DRAFT', 'INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'ARCHIVED']).optional(),
  employmentTypeId: z.string().optional(),
  locationId: z.string().optional(),
  sortBy: z.enum(['firstName', 'lastName', 'startDate', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>
export type AssignManagerInput = z.infer<typeof assignManagerSchema>
export type EmployeeListParams = z.infer<typeof employeeListParamsSchema>
