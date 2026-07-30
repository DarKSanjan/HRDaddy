/**
 * Calendar feed core module — generates ICS (RFC 5545) calendar bodies.
 *
 * Uses `dbAdmin` for the token-lookup path. This is the fourth legitimate case
 * for bypassing RLS: an unauthenticated public endpoint whose "authentication"
 * is an unguessable token embedded in the URL (analogous to a signed URL or a
 * background-job context). There is no user session to scope with — the token
 * IS the credential. See also the comment in src/core/db/admin.ts.
 */
import 'server-only'
import { dbAdmin } from '@/core/db/admin'
import { createEvents, type EventAttributes } from 'ics'
import { getHolidaysForRange } from '@/core/calendar/holidays-sg'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CalendarFeedResult {
  icsBody: string
  employeeName: string
}

// ─────────────────────────────────────────────
// Token lookup & feed generation
// ─────────────────────────────────────────────

/**
 * Look up an employee by their calendar feed token and generate an ICS body.
 * Returns null if the token doesn't match any employee (bad/regenerated token).
 */
export async function generateCalendarFeed(
  token: string
): Promise<CalendarFeedResult | null> {
  const employee = await dbAdmin.employee.findUnique({
    where: { calendarFeedToken: token },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      orgId: true,
    },
  })

  if (!employee) {
    return null
  }

  // Window: ±1 year from today
  const now = new Date()
  const startYear = now.getFullYear() - 1
  const endYear = now.getFullYear() + 1
  const windowStart = new Date(startYear, 0, 1)
  const windowEnd = new Date(endYear, 11, 31, 23, 59, 59)

  // Fetch approved leave requests in the window
  const leaveRequests = await dbAdmin.leaveRequest.findMany({
    where: {
      employeeId: employee.id,
      orgId: employee.orgId,
      status: 'APPROVED',
      startDate: { lte: windowEnd },
      endDate: { gte: windowStart },
    },
    include: {
      leaveType: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  // Build ICS events
  const events: EventAttributes[] = []

  // Leave request events
  for (const lr of leaveRequests) {
    const summary = formatLeaveSummary(lr.leaveType.name, lr.isHalfDay, lr.halfDayPeriod)
    const start = dateToArray(lr.startDate)

    if (lr.isHalfDay) {
      // Half-day: single-day event with time markers
      events.push({
        title: summary,
        start,
        end: start, // Same day
        startOutputType: 'local',
        status: 'CONFIRMED',
        uid: `leave-${lr.id}@hrdaddy`,
      })
    } else {
      // All-day event: end date in ICS is exclusive, so add 1 day
      const endExclusive = addOneDay(lr.endDate)
      events.push({
        title: summary,
        start,
        end: dateToArray(endExclusive),
        startOutputType: 'local',
        status: 'CONFIRMED',
        uid: `leave-${lr.id}@hrdaddy`,
      })
    }
  }

  // Public holiday events
  const holidays = getHolidaysForRange(startYear, endYear)
  for (const h of holidays) {
    const [y, m, d] = h.date.split('-').map(Number)
    const holidayDate = new Date(y, m - 1, d)
    events.push({
      title: `🇸🇬 ${h.name}`,
      start: [y, m, d],
      end: dateToArray(addOneDay(holidayDate)), // All-day: exclusive end, month/year-safe
      startOutputType: 'local',
      status: 'CONFIRMED',
      uid: `holiday-${h.date}@hrdaddy`,
    })
  }

  // Generate ICS body
  const employeeName = `${employee.firstName} ${employee.lastName}`
  const { error, value } = createEvents(events, {
    calName: `${employeeName} — HRDaddy Leave & Holidays`,
  })

  if (error || !value) {
    // Fallback: empty valid calendar if generation fails for some reason
    return {
      icsBody: buildEmptyCalendar(employeeName),
      employeeName,
    }
  }

  return { icsBody: value, employeeName }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Format leave type name into a natural summary.
 * e.g. "Annual Leave", "Sick Leave (half day - AM)"
 */
export function formatLeaveSummary(
  leaveTypeName: string,
  isHalfDay: boolean,
  halfDayPeriod: string | null
): string {
  if (!isHalfDay) {
    return leaveTypeName
  }
  const period = halfDayPeriod === 'AM' ? 'morning' : halfDayPeriod === 'PM' ? 'afternoon' : ''
  return period ? `${leaveTypeName} (half day — ${period})` : `${leaveTypeName} (half day)`
}

function dateToArray(date: Date): [number, number, number] {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
}

function addOneDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

function buildEmptyCalendar(name: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HRDaddy//Calendar Feed//EN',
    `X-WR-CALNAME:${name} — HRDaddy Leave & Holidays`,
    'END:VCALENDAR',
  ].join('\r\n')
}
