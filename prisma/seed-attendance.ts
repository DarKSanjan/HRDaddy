/**
 * HR Daddy Demo Seed - Attendance data.
 * Creates 3 months of attendance history including remote days, late arrivals, missing clock-out.
 */
import { PrismaClient } from '@prisma/client'

/**
 * Generate attendance records for 3 months (May, June, July 2026).
 */
export async function seedAttendance(
  db: PrismaClient,
  orgId: string,
  employeeIds: string[]
) {
  // Check if we already have attendance data for this org
  const existingCount = await db.attendanceRecord.count({
    where: { orgId },
  })
  if (existingCount > 50) return // Already seeded

  const workingDays = getWorkingDaysInRange(
    new Date('2026-05-01'),
    new Date('2026-07-24')
  )

  for (const empId of employeeIds) {
    for (const day of workingDays) {
      // Skip ~10% of days randomly (leave, sick, etc)
      const hash = simpleHash(`${empId}-${day.toISOString()}`)
      if (hash % 10 === 0) continue

      const isRemote = hash % 7 === 0 // ~14% remote
      const isLate = hash % 25 === 0 // ~4% late arrivals

      const clockInHour = isLate ? 9 + (hash % 2) : 8 + (hash % 2)
      const clockInMin = isLate ? 15 + (hash % 30) : hash % 60
      const clockIn = new Date(day)
      clockIn.setHours(clockInHour, clockInMin, 0, 0)

      // One missing clock-out for the most recent day for first employee
      const isMissingClockOut =
        empId === employeeIds[0] &&
        day.toISOString().slice(0, 10) === '2026-07-23'

      let clockOut: Date | null = null
      let durationMinutes: number | null = null
      let status: 'OPEN' | 'CLOSED' | 'MISSING_CLOCK_OUT' = 'CLOSED'

      if (isMissingClockOut) {
        status = 'MISSING_CLOCK_OUT'
      } else {
        const clockOutHour = 17 + (hash % 3)
        const clockOutMin = hash % 60
        clockOut = new Date(day)
        clockOut.setHours(clockOutHour, clockOutMin, 0, 0)
        durationMinutes = Math.round(
          (clockOut.getTime() - clockIn.getTime()) / 60000
        )
      }

      await db.attendanceRecord.create({
        data: {
          orgId,
          employeeId: empId,
          date: day,
          clockIn,
          clockOut,
          durationMinutes,
          type: isRemote ? 'REMOTE' : 'OFFICE',
          status,
        },
      })
    }
  }
}

function getWorkingDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const current = new Date(start)
  while (current <= end) {
    const dow = current.getDay()
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  return days
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}
