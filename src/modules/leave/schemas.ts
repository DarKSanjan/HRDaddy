/**
 * Leave module schemas — Zod validation for all inputs.
 */
import { z } from 'zod'

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isHalfDay: z.boolean().default(false),
  halfDayPeriod: z.enum(['AM', 'PM']).optional(),
  reason: z.string().optional(),
})

export const approveLeaveSchema = z.object({
  requestId: z.string().min(1),
  note: z.string().optional(),
})

export const rejectLeaveSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, 'Rejection reason is required'),
})

export const withdrawLeaveSchema = z.object({
  requestId: z.string().min(1),
})

export const cancelLeaveSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, 'Cancellation reason is required'),
})

export const leaveListParamsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN', 'DRAFT']).optional(),
  leaveTypeId: z.string().optional(),
  year: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export const leaveCalendarParamsSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
})

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>
export type LeaveListParams = z.infer<typeof leaveListParamsSchema>
export type LeaveCalendarParams = z.infer<typeof leaveCalendarParamsSchema>
