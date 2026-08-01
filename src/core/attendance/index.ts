/**
 * Attendance service — core kernel functions that need dbAdmin access.
 */
import { Prisma } from '@prisma/client'
import { dbAdmin } from '@/core/db/admin'

export class AttendanceError extends Error {
  constructor(
    public readonly reason: 'already_clocked_in' | 'not_open',
    message: string
  ) {
    super(message)
    this.name = 'AttendanceError'
  }
}

/**
 * Find an open attendance session for an employee. Pass `tx` to check under
 * an advisory lock inside the same transaction that creates the record —
 * without it, two concurrent clock-ins can both see "no open session" before
 * either writes.
 */
export async function findOpenSession(
  orgId: string,
  employeeId: string,
  tx?: Prisma.TransactionClient
) {
  return (tx ?? dbAdmin).attendanceRecord.findFirst({
    where: { orgId, employeeId, status: 'OPEN' },
    orderBy: { clockIn: 'desc' },
  })
}

/**
 * Create a new attendance record (clock in).
 */
export async function createAttendanceRecord(data: {
  orgId: string
  employeeId: string
  date: Date
  clockIn: Date
  type: 'OFFICE' | 'REMOTE'
}, tx?: Prisma.TransactionClient) {
  return (tx ?? dbAdmin).attendanceRecord.create({
    data: {
      orgId: data.orgId,
      employeeId: data.employeeId,
      date: data.date,
      clockIn: data.clockIn,
      type: data.type,
      status: 'OPEN',
    },
  })
}

/**
 * Close an attendance record (clock out).
 *
 * Conditioned on `status: 'OPEN'` so two concurrent clock-outs on the same
 * record can't both "succeed" — the second's row lock is only granted after
 * the first commits, at which point the WHERE no longer matches and it
 * affects zero rows instead of double-writing.
 */
export async function closeAttendanceRecord(
  recordId: string,
  clockOut: Date,
  durationMinutes: number,
  tx?: Prisma.TransactionClient
) {
  const { count } = await (tx ?? dbAdmin).attendanceRecord.updateMany({
    where: { id: recordId, status: 'OPEN' },
    data: {
      clockOut,
      durationMinutes,
      status: 'CLOSED',
    },
  })
  if (count === 0) {
    throw new AttendanceError('not_open', 'This session was already clocked out.')
  }
}

/**
 * Get attendance record with employee info.
 */
export async function getAttendanceRecordWithEmployee(orgId: string, recordId: string) {
  return dbAdmin.attendanceRecord.findFirst({
    where: { id: recordId, orgId },
    include: { employee: { select: { userId: true } } },
  })
}

/**
 * Correct an attendance record.
 */
export async function correctAttendanceRecord(
  recordId: string,
  data: {
    clockIn: Date
    clockOut: Date | null
    durationMinutes: number | null
    correctedById: string | null
    correctionReason: string
  },
  tx?: Prisma.TransactionClient
) {
  return (tx ?? dbAdmin).attendanceRecord.update({
    where: { id: recordId },
    data: {
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      durationMinutes: data.durationMinutes,
      status: data.clockOut ? 'CORRECTED' : 'OPEN',
      correctedById: data.correctedById,
      correctionReason: data.correctionReason,
    },
  })
}
