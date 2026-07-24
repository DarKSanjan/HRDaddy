/**
 * Attendance module schemas.
 */
import { z } from 'zod'

export const clockInSchema = z.object({
  type: z.enum(['OFFICE', 'REMOTE']),
  note: z.string().optional(),
})

export const clockOutSchema = z.object({
  note: z.string().optional(),
})

export const correctAttendanceSchema = z.object({
  recordId: z.string().min(1),
  clockIn: z.string().min(1, 'Clock-in time is required'),
  clockOut: z.string().optional(),
  reason: z.string().min(1, 'Correction reason is mandatory'),
})

export const manualAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  clockIn: z.string().min(1),
  clockOut: z.string().min(1),
  type: z.enum(['OFFICE', 'REMOTE']),
  reason: z.string().min(1, 'Reason is mandatory for manual entries'),
})

export const attendanceListParamsSchema = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2100).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(31),
})

export type ClockInInput = z.infer<typeof clockInSchema>
export type ClockOutInput = z.infer<typeof clockOutSchema>
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>
export type AttendanceListParams = z.infer<typeof attendanceListParamsSchema>
