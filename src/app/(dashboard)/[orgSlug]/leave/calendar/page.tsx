import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, PageHeader } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { getTeamLeaveCalendar } from '@/modules/leave/queries'
import { leaveCalendarParamsSchema } from '@/modules/leave/schemas'
import { getHolidaysForYear } from '@/core/calendar/holidays-sg'
import { TeamCalendarView } from '../_components/team-calendar-view'

export const dynamic = 'force-dynamic'

export default async function LeaveCalendarPage({
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
  moduleGuard('leave', enabledModules)

  const now = new Date()
  const calendarParams = leaveCalendarParamsSchema.safeParse({
    month: rawSearchParams.month ?? now.getMonth() + 1,
    year: rawSearchParams.year ?? now.getFullYear(),
  })
  const validParams = calendarParams.success
    ? calendarParams.data
    : { month: now.getMonth() + 1, year: now.getFullYear() }

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  // Managers see their team; Owner/HR see all
  const managerEmployeeId =
    membership.role === 'MANAGER' ? employeeId : null

  const entries = await getTeamLeaveCalendar(
    session.userId,
    org.id,
    managerEmployeeId,
    validParams
  )

  // Holidays for the displayed month's year (cheap synchronous fixture)
  const holidays = getHolidaysForYear(validParams.year)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Leave', href: `/${orgSlug}/leave` }, { label: 'Team Calendar' }]}
        title="Team Calendar"
      />

      <Card>
        <CardContent className="pt-6">
          <TeamCalendarView
            entries={entries}
            holidays={holidays}
            month={validParams.month}
            year={validParams.year}
            orgSlug={orgSlug}
          />
        </CardContent>
      </Card>
    </div>
  )
}
