import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, PageHeader } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { hasPermission } from '@/core/permissions'
import {
  getHolidaysForDateRange,
  getImportantDatesForViewer,
  getBirthdaysAndAnniversaries,
  listVisibleCalendarEvents,
  hasDirectReports,
} from '@/modules/calendar/queries'
import { calendarMonthParamsSchema } from '@/modules/calendar/schemas'
import { listDepartments } from '@/modules/employees/queries'
import { listActiveEmployees } from '@/modules/assets/queries'
import { CalendarView } from './_components/calendar-view'
import { CalendarActions } from './_components/calendar-actions'

export const dynamic = 'force-dynamic'

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearchParams = await searchParams

  const session = await verifySession()
  const { org, enabledModules, membership } = await getOrgContext(orgSlug)
  moduleGuard('calendar', enabledModules)

  const now = new Date()
  const calendarParams = calendarMonthParamsSchema.safeParse({
    month: rawSearchParams.month ?? now.getMonth() + 1,
    year: rawSearchParams.year ?? now.getFullYear(),
  })
  const validParams = calendarParams.success
    ? calendarParams.data
    : { month: now.getMonth() + 1, year: now.getFullYear() }

  const startDate = new Date(Date.UTC(validParams.year, validParams.month - 1, 1))
  const endDate = new Date(Date.UTC(validParams.year, validParams.month, 0, 23, 59, 59))

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  // Sequential fetches to avoid connection contention (see lesson #1)
  const holidays = await getHolidaysForDateRange(session.userId, org.id, startDate, endDate)
  const importantDates = await getImportantDatesForViewer(session.userId, org.id, membership.role, enabledModules, startDate, endDate)
  const birthdaysAnniversaries = await getBirthdaysAndAnniversaries(session.userId, org.id, startDate, endDate)
  const events = await listVisibleCalendarEvents(session.userId, org.id, employeeId, membership.role, startDate, endDate)

  const canManageHolidays = hasPermission(membership.role, enabledModules, 'calendar.holiday.manage')
  const canCreateEvents = hasPermission(membership.role, enabledModules, 'calendar.event.create')
  const isAdmin = membership.role === 'OWNER' || membership.role === 'HR_ADMIN'

  const employeeHasDirectReports = employeeId
    ? await hasDirectReports(session.userId, org.id, employeeId)
    : false

  const departments = canCreateEvents && isAdmin
    ? await listDepartments(session.userId, org.id)
    : []
  const employees = canCreateEvents
    ? await listActiveEmployees(session.userId, org.id)
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Calendar' }]}
        title="Calendar"
        actions={
          <CalendarActions
            orgSlug={orgSlug}
            canManageHolidays={canManageHolidays}
            canCreateEvents={canCreateEvents}
            isAdmin={isAdmin}
            hasDirectReports={employeeHasDirectReports}
            departments={departments}
            employees={employees}
          />
        }
      />

      <Card>
        <CardContent className="pt-6">
          <CalendarView
            holidays={holidays}
            importantDates={importantDates}
            birthdaysAnniversaries={birthdaysAnniversaries}
            events={events}
            month={validParams.month}
            year={validParams.year}
            orgSlug={orgSlug}
          />
        </CardContent>
      </Card>
    </div>
  )
}
