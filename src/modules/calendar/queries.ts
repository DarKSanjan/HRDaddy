import 'server-only'

import { dbAs } from '@/core/db/client'
import { hasPermission } from '@/core/permissions'
import type { OrgRole } from '@prisma/client'

export interface HolidayRow {
  id: string
  date: Date
  name: string
}

export async function getHolidaysForDateRange(
  userId: string,
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<HolidayRow[]> {
  return dbAs(userId, async (tx) => {
    return tx.holiday.findMany({
      where: {
        orgId,
        date: { gte: startDate, lte: endDate },
      },
      select: { id: true, date: true, name: true },
      orderBy: { date: 'asc' },
    })
  })
}

export async function getAllHolidaysForYear(
  userId: string,
  orgId: string,
  year: number
): Promise<HolidayRow[]> {
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59))
  return getHolidaysForDateRange(userId, orgId, startDate, endDate)
}

export interface ImportantDateEntry {
  date: Date
  label: string
  type: 'performance' | 'payroll' | 'birthday' | 'anniversary' | 'holiday' | 'event'
}

export async function getImportantDatesForViewer(
  userId: string,
  orgId: string,
  role: OrgRole,
  enabledModules: string[],
  startDate: Date,
  endDate: Date
): Promise<ImportantDateEntry[]> {
  const entries: ImportantDateEntry[] = []

  const canViewPerformance =
    hasPermission(role, enabledModules, 'performance.cycle.manage') ||
    hasPermission(role, enabledModules, 'performance.review.submit')

  if (canViewPerformance) {
    const cycles = await dbAs(userId, async (tx) => {
      return tx.performanceCycle.findMany({
        where: {
          orgId,
          OR: [
            { startDate: { gte: startDate, lte: endDate } },
            { endDate: { gte: startDate, lte: endDate } },
          ],
        },
        select: { name: true, startDate: true, endDate: true },
      })
    })
    for (const c of cycles) {
      if (c.endDate >= startDate && c.endDate <= endDate) {
        entries.push({ date: c.endDate, label: `Review cycle closes: ${c.name}`, type: 'performance' })
      }
      if (c.startDate >= startDate && c.startDate <= endDate) {
        entries.push({ date: c.startDate, label: `Review cycle starts: ${c.name}`, type: 'performance' })
      }
    }
  }

  const canViewPayroll = hasPermission(role, enabledModules, 'payroll.process')

  if (canViewPayroll) {
    const periods = await dbAs(userId, async (tx) => {
      return tx.payrollPeriod.findMany({
        where: {
          orgId,
          OR: [
            { startDate: { gte: startDate, lte: endDate } },
            { endDate: { gte: startDate, lte: endDate } },
          ],
        },
        select: { name: true, startDate: true, endDate: true },
      })
    })
    for (const p of periods) {
      if (p.endDate >= startDate && p.endDate <= endDate) {
        entries.push({ date: p.endDate, label: `Payroll closes: ${p.name}`, type: 'payroll' })
      }
    }
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export interface BirthdayAnniversaryEntry {
  date: Date
  label: string
  type: 'birthday' | 'anniversary'
}

export async function getBirthdaysAndAnniversaries(
  userId: string,
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<BirthdayAnniversaryEntry[]> {
  const startMmDd = `${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  const endMmDd = `${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  const crossesYearBoundary = startMmDd > endMmDd

  const employees = await dbAs(userId, async (tx) => {
    return tx.employee.findMany({
      where: {
        orgId,
        employmentStatus: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        startDate: true,
      },
    })
  })

  const entries: BirthdayAnniversaryEntry[] = []
  const now = new Date()

  for (const emp of employees) {
    if (emp.dateOfBirth) {
      const mmDd = `${String(emp.dateOfBirth.getMonth() + 1).padStart(2, '0')}-${String(emp.dateOfBirth.getDate()).padStart(2, '0')}`
      const inRange = crossesYearBoundary
        ? mmDd >= startMmDd || mmDd <= endMmDd
        : mmDd >= startMmDd && mmDd <= endMmDd

      if (inRange) {
        const year = mmDd >= startMmDd ? startDate.getFullYear() : endDate.getFullYear()
        entries.push({
          date: new Date(Date.UTC(year, emp.dateOfBirth.getMonth(), emp.dateOfBirth.getDate())),
          label: `🎂 ${emp.firstName} ${emp.lastName}'s birthday`,
          type: 'birthday',
        })
      }
    }

    if (emp.startDate) {
      const yearsWorked = now.getFullYear() - emp.startDate.getFullYear()
      if (yearsWorked < 1) continue

      const mmDd = `${String(emp.startDate.getMonth() + 1).padStart(2, '0')}-${String(emp.startDate.getDate()).padStart(2, '0')}`
      const inRange = crossesYearBoundary
        ? mmDd >= startMmDd || mmDd <= endMmDd
        : mmDd >= startMmDd && mmDd <= endMmDd

      if (inRange) {
        const year = mmDd >= startMmDd ? startDate.getFullYear() : endDate.getFullYear()
        const anniversaryYears = year - emp.startDate.getFullYear()
        if (anniversaryYears >= 1) {
          entries.push({
            date: new Date(Date.UTC(year, emp.startDate.getMonth(), emp.startDate.getDate())),
            label: `🎉 ${emp.firstName} ${emp.lastName} — ${anniversaryYears} year${anniversaryYears > 1 ? 's' : ''}`,
            type: 'anniversary',
          })
        }
      }
    }
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export interface CalendarEventRow {
  id: string
  title: string
  date: Date
  audience: string
  departmentId: string | null
  createdById: string
}

export async function listVisibleCalendarEvents(
  userId: string,
  orgId: string,
  employeeId: string | null,
  role: OrgRole,
  startDate: Date,
  endDate: Date
): Promise<CalendarEventRow[]> {
  return dbAs(userId, async (tx) => {
    const isAdminOrManager = ['OWNER', 'HR_ADMIN', 'MANAGER'].includes(role)

    if (isAdminOrManager) {
      return tx.calendarEvent.findMany({
        where: {
          orgId,
          date: { gte: startDate, lte: endDate },
        },
        select: { id: true, title: true, date: true, audience: true, departmentId: true, createdById: true },
        orderBy: { date: 'asc' },
      })
    }

    if (!employeeId) return []

    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    })

    return tx.calendarEvent.findMany({
      where: {
        orgId,
        date: { gte: startDate, lte: endDate },
        OR: [
          { audience: 'COMPANY' },
          { audience: 'DEPARTMENT', departmentId: employee?.departmentId ?? '__none__' },
          { audience: 'SPECIFIC_EMPLOYEES', recipients: { some: { employeeId } } },
        ],
      },
      select: { id: true, title: true, date: true, audience: true, departmentId: true, createdById: true },
      orderBy: { date: 'asc' },
    })
  })
}

export async function createHoliday(
  userId: string,
  orgId: string,
  data: { date: Date; name: string }
) {
  return dbAs(userId, async (tx) => {
    return tx.holiday.create({
      data: {
        orgId,
        date: data.date,
        name: data.name,
      },
    })
  })
}

export async function deleteHoliday(userId: string, orgId: string, holidayId: string) {
  return dbAs(userId, async (tx) => {
    return tx.holiday.delete({
      where: { id: holidayId },
    })
  })
}
