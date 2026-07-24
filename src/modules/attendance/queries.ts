/**
 * Attendance module queries.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { AttendanceStatus, AttendanceType } from '@prisma/client'
import type { AttendanceListParams } from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AttendanceRecordItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  date: Date
  clockIn: Date
  clockOut: Date | null
  durationMinutes: number | null
  type: AttendanceType
  status: AttendanceStatus
  correctedById: string | null
  correctionReason: string | null
  createdAt: Date
}

export interface AttendanceSummary {
  daysPresent: number
  totalHours: number
  averageStartTime: string | null
  averageEndTime: string | null
  lateArrivals: number
}

export interface CurrentAttendanceState {
  isClockedIn: boolean
  currentRecord: {
    id: string
    clockIn: Date
    type: AttendanceType
  } | null
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

/**
 * Get the current attendance state for an employee.
 */
export async function getCurrentAttendanceState(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<CurrentAttendanceState> {
  return dbAs(userId, async (tx) => {
    const openRecord = await tx.attendanceRecord.findFirst({
      where: {
        orgId,
        employeeId,
        status: 'OPEN',
      },
      orderBy: { clockIn: 'desc' },
      select: { id: true, clockIn: true, type: true },
    })

    return {
      isClockedIn: !!openRecord,
      currentRecord: openRecord,
    }
  })
}

/**
 * Get employee's attendance history for a month.
 */
export async function getEmployeeAttendanceHistory(
  userId: string,
  orgId: string,
  employeeId: string,
  params: AttendanceListParams
): Promise<{ records: AttendanceRecordItem[]; total: number }> {
  const now = new Date()
  const month = params.month ?? now.getMonth() + 1
  const year = params.year ?? now.getFullYear()

  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      employeeId,
      date: { gte: startOfMonth, lte: endOfMonth },
    }

    const [records, total] = await Promise.all([
      tx.attendanceRecord.findMany({
        where,
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.attendanceRecord.count({ where }),
    ])

    return {
      records: records.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeFirstName: r.employee.firstName,
        employeeLastName: r.employee.lastName,
        date: r.date,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        durationMinutes: r.durationMinutes,
        type: r.type,
        status: r.status,
        correctedById: r.correctedById,
        correctionReason: r.correctionReason,
        createdAt: r.createdAt,
      })),
      total,
    }
  })
}

/**
 * Get attendance summary for an employee in a month.
 */
export async function getAttendanceSummary(
  userId: string,
  orgId: string,
  employeeId: string,
  month: number,
  year: number,
  workingHoursStart: string
): Promise<AttendanceSummary> {
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

  return dbAs(userId, async (tx) => {
    const records = await tx.attendanceRecord.findMany({
      where: {
        orgId,
        employeeId,
        date: { gte: startOfMonth, lte: endOfMonth },
        status: { in: ['CLOSED', 'CORRECTED'] },
      },
      select: { clockIn: true, clockOut: true, durationMinutes: true },
    })

    const daysPresent = records.length
    const totalMinutes = records.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0)
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10

    let averageStartTime: string | null = null
    let averageEndTime: string | null = null
    let lateArrivals = 0

    if (records.length > 0) {
      const startMinutes = records.map((r) => r.clockIn.getHours() * 60 + r.clockIn.getMinutes())
      const avgStart = Math.round(startMinutes.reduce((a, b) => a + b, 0) / startMinutes.length)
      averageStartTime = `${String(Math.floor(avgStart / 60)).padStart(2, '0')}:${String(avgStart % 60).padStart(2, '0')}`

      const endRecords = records.filter((r) => r.clockOut)
      if (endRecords.length > 0) {
        const endMinutes = endRecords.map((r) => r.clockOut!.getHours() * 60 + r.clockOut!.getMinutes())
        const avgEnd = Math.round(endMinutes.reduce((a, b) => a + b, 0) / endMinutes.length)
        averageEndTime = `${String(Math.floor(avgEnd / 60)).padStart(2, '0')}:${String(avgEnd % 60).padStart(2, '0')}`
      }

      // Count late arrivals
      const [configHour, configMinute] = workingHoursStart.split(':').map(Number)
      const configStartMinutes = configHour * 60 + configMinute
      lateArrivals = startMinutes.filter((m) => m > configStartMinutes).length
    }

    return { daysPresent, totalHours, averageStartTime, averageEndTime, lateArrivals }
  })
}

/**
 * Get team attendance for today (for managers).
 */
export async function getTeamAttendanceToday(
  userId: string,
  orgId: string,
  managerEmployeeId: string
): Promise<AttendanceRecordItem[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return dbAs(userId, async (tx) => {
    const records = await tx.attendanceRecord.findMany({
      where: {
        orgId,
        date: { gte: today, lt: tomorrow },
        employee: { managerId: managerEmployeeId },
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { clockIn: 'desc' },
    })

    return records.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      date: r.date,
      clockIn: r.clockIn,
      clockOut: r.clockOut,
      durationMinutes: r.durationMinutes,
      type: r.type,
      status: r.status,
      correctedById: r.correctedById,
      correctionReason: r.correctionReason,
      createdAt: r.createdAt,
    }))
  })
}

// getEmployeeIdForUser is in @/core/employees
