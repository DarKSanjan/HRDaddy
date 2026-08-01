/**
 * Attendance service — core kernel functions that need dbAdmin access.
 */
import { Prisma } from '@prisma/client'
import { dbAdmin } from '@/core/db/admin'

/**
 * Find an open attendance session for an employee.
 */
export async function findOpenSession(orgId: string, employeeId: string) {
  return dbAdmin.attendanceRecord.findFirst({
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
 */
export async function closeAttendanceRecord(
  recordId: string,
  clockOut: Date,
  durationMinutes: number,
  tx?: Prisma.TransactionClient
) {
  return (tx ?? dbAdmin).attendanceRecord.update({
    where: { id: recordId },
    data: {
      clockOut,
      durationMinutes,
      status: 'CLOSED',
    },
  })
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
