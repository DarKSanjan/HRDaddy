'use server'

/**
 * Attendance module server actions.
 *
 * Critical logic:
 * - No double clock-in
 * - Overnight shifts: clock-in 23:00, out 07:00 → belongs to START date, 8h
 * - All timestamps stored UTC, displayed in org timezone
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser, getOrgSettings } from '@/core/employees'
import { getLocalDateForTimestamp } from '@/core/calendar'
import {
  findOpenSession,
  createAttendanceRecord,
  closeAttendanceRecord,
  getAttendanceRecordWithEmployee,
  correctAttendanceRecord,
} from '@/core/attendance'
import {
  clockInSchema,
  correctAttendanceSchema,
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
// Clock In
// ─────────────────────────────────────────────

export async function clockIn(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'attendance.clock')

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = clockInSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  // Check for existing open session (no double clock-in)
  const existing = await findOpenSession(org.id, employeeId)
  if (existing) {
    return { success: false, error: 'You are already clocked in. Please clock out first.' }
  }

  // Get org timezone for correct local date assignment
  const settings = await getOrgSettings(org.id)
  const timezone = settings?.timezone ?? 'UTC'

  const now = new Date() // UTC
  const localDate = getLocalDateForTimestamp(now, timezone)

  // The `date` field stores the local working day this session belongs to
  const dateObj = new Date(localDate + 'T00:00:00Z')

  const record = await createAttendanceRecord({
    orgId: org.id,
    employeeId,
    date: dateObj,
    clockIn: now,
    type: parsed.data.type,
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'attendance.clock_in',
    targetType: 'attendance_record',
    targetId: record.id,
    after: { clockIn: now.toISOString(), type: parsed.data.type, localDate },
  })

  revalidatePath(`/${orgSlug}/attendance`)
  return { success: true, data: { id: record.id } }
}

// ─────────────────────────────────────────────
// Clock Out
// ─────────────────────────────────────────────

export async function clockOut(
  orgSlug: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'attendance.clock')

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  // Find the open session
  const openRecord = await findOpenSession(org.id, employeeId)
  if (!openRecord) {
    return { success: false, error: 'You are not currently clocked in.' }
  }

  const now = new Date()

  // Calculate duration in minutes.
  // Overnight shifts: clock-in 23:00, out 07:00 → compute correctly as 8h (480 min)
  const durationMinutes = Math.max(
    0,
    Math.round((now.getTime() - openRecord.clockIn.getTime()) / (1000 * 60))
  )

  await closeAttendanceRecord(openRecord.id, now, durationMinutes)

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'attendance.clock_out',
    targetType: 'attendance_record',
    targetId: openRecord.id,
    before: { status: 'OPEN' },
    after: { clockOut: now.toISOString(), durationMinutes, status: 'CLOSED' },
  })

  revalidatePath(`/${orgSlug}/attendance`)
  return { success: true, data: { durationMinutes } }
}

// ─────────────────────────────────────────────
// Correct attendance record (HR only)
// ─────────────────────────────────────────────

export async function correctAttendance(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'attendance.correct')

  const raw = Object.fromEntries(formData.entries())
  const parsed = correctAttendanceSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { recordId, clockIn: newClockIn, clockOut: newClockOut, reason } = parsed.data

  const record = await getAttendanceRecordWithEmployee(org.id, recordId)
  if (!record) {
    return { success: false, error: 'Attendance record not found.' }
  }

  // Preserve original values for audit
  const before = {
    clockIn: record.clockIn.toISOString(),
    clockOut: record.clockOut?.toISOString() ?? null,
    durationMinutes: record.durationMinutes,
    status: record.status,
  }

  const correctorEmployeeId = await getEmployeeIdForUser(org.id, userId)
  const newClockInDate = new Date(newClockIn)
  const newClockOutDate = newClockOut ? new Date(newClockOut) : null

  let durationMinutes: number | null = null
  if (newClockOutDate) {
    durationMinutes = Math.max(
      0,
      Math.round((newClockOutDate.getTime() - newClockInDate.getTime()) / (1000 * 60))
    )
  }

  await correctAttendanceRecord(recordId, {
    clockIn: newClockInDate,
    clockOut: newClockOutDate,
    durationMinutes,
    correctedById: correctorEmployeeId,
    correctionReason: reason,
  })

  const after = {
    clockIn: newClockIn,
    clockOut: newClockOut ?? null,
    durationMinutes,
    status: newClockOutDate ? 'CORRECTED' : 'OPEN',
    correctionReason: reason,
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'attendance.correct',
    targetType: 'attendance_record',
    targetId: recordId,
    before,
    after,
  })

  // Notify the affected employee
  if (record.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: record.employee.userId,
      title: 'Attendance record corrected',
      message: `An attendance record has been corrected by HR. Reason: ${reason}`,
      link: `/${orgSlug}/attendance`,
    })
  }

  revalidatePath(`/${orgSlug}/attendance`)
  return { success: true }
}
