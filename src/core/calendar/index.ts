/**
 * Working-day calendar service — shared by Leave and Attendance modules.
 *
 * All date maths in the ORGANISATION's timezone, not the server's and not the
 * browser's. Uses date-fns + @date-fns/tz.
 */
import {
  eachDayOfInterval,
  getDay,
  isAfter,
} from 'date-fns'
import { TZDate } from '@date-fns/tz'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface OrgCalendarSettings {
  timezone: string
  /** ISO weekday numbers where Mon=1, Sun=7. Default [1,2,3,4,5] */
  workingDays: number[]
}

export interface PublicHoliday {
  date: string // YYYY-MM-DD
  name: string
}

// ─────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────

/**
 * Convert a Date or ISO string to a TZDate in the org's timezone,
 * stripped to the start of the local day.
 */
export function toOrgDate(
  date: Date | string,
  timezone: string
): TZDate {
  const d = typeof date === 'string' ? new Date(date) : date
  const tzDate = new TZDate(d.getTime(), timezone)
  return new TZDate(
    tzDate.getFullYear(),
    tzDate.getMonth(),
    tzDate.getDate(),
    0,
    0,
    0,
    0,
    timezone
  )
}

/**
 * Check if a given date is a working day.
 * A working day is one that:
 *   1. Falls on a configured working-day-of-week
 *   2. Is not a public holiday
 */
export function isWorkingDay(
  date: Date | string,
  settings: OrgCalendarSettings,
  holidays: PublicHoliday[]
): boolean {
  const orgDate = toOrgDate(date, settings.timezone)

  // getDay: 0=Sun, 1=Mon ... 6=Sat → convert to ISO: Mon=1 ... Sun=7
  const jsDay = getDay(orgDate)
  const isoDay = jsDay === 0 ? 7 : jsDay

  if (!settings.workingDays.includes(isoDay)) {
    return false
  }

  // Check against holidays
  const dateStr = formatLocalDate(orgDate)
  if (holidays.some((h) => h.date === dateStr)) {
    return false
  }

  return true
}

/**
 * Count working days in a date range (inclusive of start and end).
 * Excludes weekends (per org config) and public holidays.
 */
export function countWorkingDays(
  start: Date | string,
  end: Date | string,
  settings: OrgCalendarSettings,
  holidays: PublicHoliday[]
): number {
  const startDate = toOrgDate(start, settings.timezone)
  const endDate = toOrgDate(end, settings.timezone)

  if (isAfter(startDate, endDate)) {
    return 0
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate })
  let count = 0

  for (const day of days) {
    if (isWorkingDay(day, settings, holidays)) {
      count++
    }
  }

  return count
}

/**
 * Calculate leave days considering half-day option.
 * If half-day is requested on a single-day range, returns 0.5.
 * Multi-day requests cannot be half-day.
 */
export function calculateLeaveDays(
  start: Date | string,
  end: Date | string,
  isHalfDay: boolean,
  settings: OrgCalendarSettings,
  holidays: PublicHoliday[]
): number {
  const workingDays = countWorkingDays(start, end, settings, holidays)

  if (isHalfDay && workingDays === 1) {
    return 0.5
  }

  return workingDays
}

/**
 * Format a TZDate to YYYY-MM-DD string in the org timezone.
 */
export function formatLocalDate(date: TZDate | Date): string {
  const d = date instanceof TZDate ? date : new TZDate(date.getTime(), 'UTC')
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get the current local date in the org's timezone.
 */
export function getOrgToday(timezone: string): TZDate {
  return toOrgDate(new Date(), timezone)
}

/**
 * Get the local date for a UTC timestamp in org timezone.
 * Returns YYYY-MM-DD.
 */
export function getLocalDateForTimestamp(
  timestamp: Date,
  timezone: string
): string {
  const tzDate = new TZDate(timestamp.getTime(), timezone)
  return formatLocalDate(tzDate)
}

// ─────────────────────────────────────────────
// Service year calculation
// ─────────────────────────────────────────────

/**
 * Calculate the number of completed years of service as of a reference date.
 */
export function completedServiceYears(
  startDate: Date | string,
  referenceDate: Date | string,
  timezone: string
): number {
  const start = toOrgDate(startDate, timezone)
  const ref = toOrgDate(referenceDate, timezone)

  if (isAfter(start, ref)) return 0

  let years = ref.getFullYear() - start.getFullYear()

  // Check if anniversary has passed this year
  const anniversaryThisYear = new TZDate(
    ref.getFullYear(),
    start.getMonth(),
    start.getDate(),
    0,
    0,
    0,
    0,
    timezone
  )

  if (isAfter(anniversaryThisYear, ref)) {
    years--
  }

  return Math.max(0, years)
}

/**
 * Calculate Singapore MOM annual leave entitlement.
 * 7 days after 1 year, +1 per additional year, capped at 14.
 * Returns 0 if less than 1 year of service.
 */
export function sgAnnualLeaveEntitlement(completedYears: number): number {
  if (completedYears < 1) return 0
  return Math.min(7 + (completedYears - 1), 14)
}

/**
 * Calculate pro-rated annual leave for incomplete year.
 * Pro-rated by months worked in the current period.
 */
export function proRatedEntitlement(
  fullEntitlement: number,
  monthsWorked: number
): number {
  if (monthsWorked <= 0) return 0
  if (monthsWorked >= 12) return fullEntitlement
  // Round to 1 decimal place
  return Math.round((fullEntitlement * monthsWorked) / 12 * 10) / 10
}
