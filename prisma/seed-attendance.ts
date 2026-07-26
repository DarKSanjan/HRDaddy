/**
 * HR Daddy Demo Seed - Attendance data.
 * Creates 6 months of attendance history (Feb–Jul 2026) with varied employee
 * patterns: chronically late arrivals, overtime workers, remote-heavy employees,
 * clean/punctual records, and some with frequent absences.
 *
 * Each employee is assigned a deterministic "persona" based on their index in the
 * array, which shapes their attendance behaviour. This produces a visually
 * interesting spread in the Team/Org Attendance dashboard rather than everyone
 * looking uniform.
 */
import { PrismaClient } from '@prisma/client'

// ──── Employee attendance personas ────
// Assigned by (employeeIndex % PERSONA_COUNT) for determinism.
type Persona =
  | 'punctual'       // Always on time, leaves at 17:30 sharp
  | 'chronic_late'   // 30-60 min late most days
  | 'overtime'       // Arrives early, stays until 20:00+
  | 'remote_heavy'   // Remote 60%+ of the time
  | 'frequent_absent' // Absent 20-25% of working days
  | 'normal'         // Baseline with mild variation

const PERSONAS: Persona[] = [
  'overtime',
  'punctual',
  'chronic_late',
  'remote_heavy',
  'frequent_absent',
  'normal',
]
const PERSONA_COUNT = PERSONAS.length

/**
 * Generate attendance records for 6 months (Feb 2 – Jul 25, 2026).
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
    new Date('2026-02-02'),
    new Date('2026-07-25')
  )

  for (let empIdx = 0; empIdx < employeeIds.length; empIdx++) {
    const empId = employeeIds[empIdx]
    const persona = PERSONAS[empIdx % PERSONA_COUNT]

    for (const day of workingDays) {
      const dateStr = day.toISOString()
      const hash = simpleHash(`${empId}-${dateStr}`)

      // ── Determine if employee is absent this day ──
      if (shouldSkipDay(persona, hash)) continue

      // ── Determine type (REMOTE vs OFFICE) ──
      const isRemote = getIsRemote(persona, hash)

      // ── Clock-in time ──
      const { clockInHour, clockInMin } = getClockIn(persona, hash)
      const clockIn = new Date(day)
      clockIn.setHours(clockInHour, clockInMin, 0, 0)

      // ── Missing clock-out scenario ──
      // First employee, most recent Wednesday only
      const isMissingClockOut =
        empIdx === 0 &&
        day.toISOString().slice(0, 10) === '2026-07-23'

      let clockOut: Date | null = null
      let durationMinutes: number | null = null
      let status: 'OPEN' | 'CLOSED' | 'MISSING_CLOCK_OUT' = 'CLOSED'

      if (isMissingClockOut) {
        status = 'MISSING_CLOCK_OUT'
      } else {
        const { clockOutHour, clockOutMin } = getClockOut(persona, hash)
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

// ──── Persona-specific behaviour helpers ────

function shouldSkipDay(persona: Persona, hash: number): boolean {
  switch (persona) {
    case 'frequent_absent':
      // ~22% absent
      return hash % 9 < 2
    case 'chronic_late':
      // ~8% absent (slightly higher than normal — unreliable)
      return hash % 12 === 0
    case 'punctual':
      // ~5% absent (rarely misses)
      return hash % 20 === 0
    case 'overtime':
      // ~3% absent (workaholic)
      return hash % 30 === 0
    case 'remote_heavy':
      // ~10% absent
      return hash % 10 === 0
    case 'normal':
    default:
      // ~10% absent
      return hash % 10 === 0
  }
}

function getIsRemote(persona: Persona, hash: number): boolean {
  switch (persona) {
    case 'remote_heavy':
      // ~65% remote
      return hash % 20 < 13
    case 'overtime':
      // ~10% remote (prefers office for long hours)
      return hash % 10 === 0
    case 'punctual':
      // ~20% remote
      return hash % 5 === 0
    case 'chronic_late':
      // ~30% remote (tends to WFH more)
      return hash % 10 < 3
    case 'frequent_absent':
      // ~15% remote
      return hash % 7 === 0
    case 'normal':
    default:
      // ~14% remote
      return hash % 7 === 0
  }
}

interface ClockInResult {
  clockInHour: number
  clockInMin: number
  isLate: boolean
}

function getClockIn(persona: Persona, hash: number): ClockInResult {
  switch (persona) {
    case 'chronic_late':
      // Late ~70% of days, arrives 9:15–10:10
      if (hash % 10 < 7) {
        return {
          clockInHour: 9 + Math.floor((hash % 60) / 55), // 9 or 10
          clockInMin: 15 + (hash % 55), // 15–69 → wraps to 15–55 sensibly
          isLate: true,
        }
      }
      // Occasionally on time
      return { clockInHour: 8, clockInMin: 50 + (hash % 10), isLate: false }

    case 'overtime':
      // Arrives early: 7:00–7:50
      return {
        clockInHour: 7,
        clockInMin: hash % 50,
        isLate: false,
      }

    case 'punctual':
      // Always 8:55–9:00
      return {
        clockInHour: 8,
        clockInMin: 55 + (hash % 6), // 55–60 → if 60, just use 59
        isLate: false,
      }

    case 'remote_heavy':
      // Slightly varied: 8:30–9:10
      return {
        clockInHour: 8 + Math.floor((30 + (hash % 40)) / 60),
        clockInMin: (30 + (hash % 40)) % 60,
        isLate: (30 + (hash % 40)) >= 65, // > 9:05 → late
      }

    case 'frequent_absent':
      // Normal-ish when present: 8:45–9:15
      if (hash % 4 === 0) {
        return { clockInHour: 9, clockInMin: 5 + (hash % 10), isLate: true }
      }
      return { clockInHour: 8, clockInMin: 45 + (hash % 15), isLate: false }

    case 'normal':
    default: {
      // 8:00–9:10 with ~4% late
      const isLate = hash % 25 === 0
      const clockInHour = isLate ? 9 : 8 + Math.floor((hash % 70) / 60)
      const clockInMin = isLate ? 10 + (hash % 20) : hash % 60
      return { clockInHour, clockInMin, isLate }
    }
  }
}

interface ClockOutResult {
  clockOutHour: number
  clockOutMin: number
}

function getClockOut(persona: Persona, hash: number): ClockOutResult {
  switch (persona) {
    case 'overtime':
      // Stays until 19:00–21:30
      return {
        clockOutHour: 19 + (hash % 3), // 19, 20, or 21
        clockOutMin: hash % 60,
      }

    case 'punctual':
      // Leaves right at 17:30 ± 5 min
      return {
        clockOutHour: 17,
        clockOutMin: 25 + (hash % 10),
      }

    case 'chronic_late':
      // Leaves at 17:30–18:30 (stays a bit to compensate, or doesn't)
      return {
        clockOutHour: 17 + (hash % 2),
        clockOutMin: 30 + (hash % 30),
      }

    case 'remote_heavy':
      // Remote workers tend to end at 17:45–18:30
      return {
        clockOutHour: 17 + Math.floor((45 + (hash % 45)) / 60),
        clockOutMin: (45 + (hash % 45)) % 60,
      }

    case 'frequent_absent':
      // When present, normal 17:00–18:00
      return {
        clockOutHour: 17,
        clockOutMin: hash % 60,
      }

    case 'normal':
    default:
      // 17:00–19:00 with some variation
      return {
        clockOutHour: 17 + (hash % 3),
        clockOutMin: hash % 60,
      }
  }
}

// ──── Utilities ────

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
