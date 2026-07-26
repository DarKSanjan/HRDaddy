/**
 * Shift-aware attendance computation helpers.
 *
 * These derive lateMinutes/undertimeMinutes/overtimeMinutes at query time —
 * no migration column needed. Follows the existing "compute, don't store" pattern.
 */
import { TZDate } from '@date-fns/tz'

export interface ResolvedShift {
  startMinutes: number // minutes from midnight
  endMinutes: number
  standardMinutesPerDay: number
  overtimeMultiplier: number
  restDayMultiplier: number
}

export interface AttendanceShiftMetrics {
  /** Minutes late (clock-in after shift start), floored at 0 */
  lateMinutes: number
  /** Shift standard minus worked duration, floored at 0. Only meaningful when clocked out. */
  undertimeMinutes: number
  /** Worked duration beyond standard, floored at 0 */
  overtimeMinutes: number
  /** Whether the attendance date falls on a rest day (non-working day) */
  isRestDay: boolean
}

/**
 * Resolve the effective shift for an employee.
 *
 * Priority:
 * 1. Employee's own shiftTemplate
 * 2. EmploymentType's defaultShiftTemplate
 * 3. Org-wide working hours (fallback)
 */
export function resolveShift(params: {
  employeeShift: { startMinutes: number; endMinutes: number; standardMinutesPerDay: number; overtimeMultiplier: number; restDayMultiplier: number } | null
  employmentTypeShift: { startMinutes: number; endMinutes: number; standardMinutesPerDay: number; overtimeMultiplier: number; restDayMultiplier: number } | null
  orgWorkingHoursStart: string // "HH:mm"
  orgWorkingHoursEnd: string   // "HH:mm"
}): ResolvedShift {
  if (params.employeeShift) {
    return {
      startMinutes: params.employeeShift.startMinutes,
      endMinutes: params.employeeShift.endMinutes,
      standardMinutesPerDay: params.employeeShift.standardMinutesPerDay,
      overtimeMultiplier: params.employeeShift.overtimeMultiplier,
      restDayMultiplier: params.employeeShift.restDayMultiplier,
    }
  }

  if (params.employmentTypeShift) {
    return {
      startMinutes: params.employmentTypeShift.startMinutes,
      endMinutes: params.employmentTypeShift.endMinutes,
      standardMinutesPerDay: params.employmentTypeShift.standardMinutesPerDay,
      overtimeMultiplier: params.employmentTypeShift.overtimeMultiplier,
      restDayMultiplier: params.employmentTypeShift.restDayMultiplier,
    }
  }

  // Fallback: derive from org-wide working hours
  const startMinutes = parseTimeToMinutes(params.orgWorkingHoursStart)
  const endMinutes = parseTimeToMinutes(params.orgWorkingHoursEnd)
  const standardMinutesPerDay = endMinutes > startMinutes
    ? endMinutes - startMinutes
    : 480 // default 8 hours if somehow invalid

  return {
    startMinutes,
    endMinutes,
    standardMinutesPerDay,
    overtimeMultiplier: 1.5,
    restDayMultiplier: 2.0,
  }
}

/**
 * Compute shift metrics for an attendance record.
 *
 * @param params.timezone - IANA timezone of the organisation (e.g. 'Asia/Singapore').
 *   Clock-in/out timestamps are stored as UTC instants; this timezone is used to
 *   convert them to the org's wall-clock time before comparing against shift start/end
 *   (which are defined in org-local minutes-from-midnight).
 */
export function computeShiftMetrics(params: {
  shift: ResolvedShift
  clockIn: Date
  clockOut: Date | null
  durationMinutes: number | null
  /** Day-of-week (0=Sunday, 1=Monday, ..., 6=Saturday) */
  dayOfWeek: number
  /** Working days from org settings, e.g. [1,2,3,4,5] for Mon-Fri */
  workingDays: number[]
  /** IANA timezone of the organisation, e.g. 'Asia/Singapore' */
  timezone: string
}): AttendanceShiftMetrics {
  const { shift, clockIn, clockOut, durationMinutes, dayOfWeek, workingDays, timezone } = params

  // Convert UTC clock-in to org-local time before extracting hours/minutes.
  // shift.startMinutes is in org-local wall-clock minutes, so the comparison
  // must also be in org-local time. See core/calendar/index.ts for the pattern.
  const localClockIn = new TZDate(clockIn.getTime(), timezone)
  const clockInMinutes = localClockIn.getHours() * 60 + localClockIn.getMinutes()

  // Late = clock-in after shift start
  const lateMinutes = Math.max(0, clockInMinutes - shift.startMinutes)

  // Is this a rest day?
  const isRestDay = !workingDays.includes(dayOfWeek)

  // Undertime & overtime only meaningful when clocked out
  if (clockOut === null || durationMinutes === null) {
    return { lateMinutes, undertimeMinutes: 0, overtimeMinutes: 0, isRestDay }
  }

  const undertimeMinutes = Math.max(0, shift.standardMinutesPerDay - durationMinutes)
  const overtimeMinutes = Math.max(0, durationMinutes - shift.standardMinutesPerDay)

  return { lateMinutes, undertimeMinutes, overtimeMinutes, isRestDay }
}

/**
 * Parse "HH:mm" string to minutes from midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
