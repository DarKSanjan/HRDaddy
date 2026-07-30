import 'server-only'
import { dbAdmin } from '@/core/db/admin'
import { createEvents, type EventAttributes } from 'ics'

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

export async function generateCalendarFeed(
  token: string
): Promise<CalendarFeedResult | null> {
  const feedToken = await dbAdmin.calendarFeedToken.findUnique({
    where: { token },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          orgId: true,
        },
      },
    },
  })

  if (!feedToken) {
    return null
  }

  const { employee, scope } = feedToken

  const now = new Date()
  const startYear = now.getFullYear() - 1
  const endYear = now.getFullYear() + 1
  const windowStart = new Date(startYear, 0, 1)
  const windowEnd = new Date(endYear, 11, 31, 23, 59, 59)

  const events: EventAttributes[] = []

  if (scope === 'PERSONAL') {
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

    for (const lr of leaveRequests) {
      const summary = formatLeaveSummary(lr.leaveType.name, lr.isHalfDay, lr.halfDayPeriod)
      events.push(buildLeaveEvent(lr, summary))
    }
  } else if (scope === 'TEAM') {
    const leaveRequests = await dbAdmin.leaveRequest.findMany({
      where: {
        orgId: employee.orgId,
        employee: { managerId: employee.id },
        status: 'APPROVED',
        startDate: { lte: windowEnd },
        endDate: { gte: windowStart },
      },
      include: {
        leaveType: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    for (const lr of leaveRequests) {
      const suffix = formatLeaveSummary(lr.leaveType.name, lr.isHalfDay, lr.halfDayPeriod)
      const summary = `${lr.employee.firstName} ${lr.employee.lastName} — ${suffix}`
      events.push(buildLeaveEvent(lr, summary))
    }
  } else {
    const leaveRequests = await dbAdmin.leaveRequest.findMany({
      where: {
        orgId: employee.orgId,
        status: 'APPROVED',
        startDate: { lte: windowEnd },
        endDate: { gte: windowStart },
      },
      include: {
        leaveType: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    for (const lr of leaveRequests) {
      const suffix = formatLeaveSummary(lr.leaveType.name, lr.isHalfDay, lr.halfDayPeriod)
      const summary = `${lr.employee.firstName} ${lr.employee.lastName} — ${suffix}`
      events.push(buildLeaveEvent(lr, summary))
    }
  }

  const holidays = await dbAdmin.holiday.findMany({
    where: {
      orgId: employee.orgId,
      date: { gte: windowStart, lte: windowEnd },
    },
    select: { date: true, name: true },
    orderBy: { date: 'asc' },
  })
  for (const h of holidays) {
    const y = h.date.getUTCFullYear()
    const m = h.date.getUTCMonth() + 1
    const d = h.date.getUTCDate()
    const holidayDate = new Date(y, m - 1, d)
    events.push({
      title: `🏖️ ${h.name}`,
      start: [y, m, d],
      end: dateToArray(addOneDay(holidayDate)),
      startOutputType: 'local',
      status: 'CONFIRMED',
      uid: `holiday-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}-${h.name.replace(/\s+/g, '-').toLowerCase()}@hrdaddy`,
    })
  }

  const employeeName = `${employee.firstName} ${employee.lastName}`
  let calName: string

  if (scope === 'PERSONAL') {
    calName = `${employeeName} — HRDaddy Leave & Holidays`
  } else if (scope === 'TEAM') {
    calName = `${employeeName}'s Team — HRDaddy Calendar`
  } else {
    const org = await dbAdmin.organisation.findUnique({
      where: { id: employee.orgId },
      select: { name: true },
    })
    calName = `${org?.name ?? 'Company'} — HRDaddy Calendar`
  }

  const { error, value } = createEvents(events, { calName })

  if (error || !value) {
    return {
      icsBody: buildEmptyCalendar(calName),
      employeeName,
    }
  }

  return { icsBody: value, employeeName }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

interface LeaveRow {
  id: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
}

function buildLeaveEvent(lr: LeaveRow, summary: string): EventAttributes {
  const start = dateToArray(lr.startDate)

  if (lr.isHalfDay) {
    return {
      title: summary,
      start,
      end: start,
      startOutputType: 'local',
      status: 'CONFIRMED',
      uid: `leave-${lr.id}@hrdaddy`,
    }
  }

  const endExclusive = addOneDay(lr.endDate)
  return {
    title: summary,
    start,
    end: dateToArray(endExclusive),
    startOutputType: 'local',
    status: 'CONFIRMED',
    uid: `leave-${lr.id}@hrdaddy`,
  }
}

function dateToArray(date: Date): [number, number, number] {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
}

function addOneDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

function buildEmptyCalendar(calName: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HRDaddy//Calendar Feed//EN',
    `X-WR-CALNAME:${calName}`,
    'END:VCALENDAR',
  ].join('\r\n')
}
