import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { getTeamLeaveCalendar } from '@/modules/leave/queries'
import { leaveCalendarParamsSchema } from '@/modules/leave/schemas'
import { TeamCalendarView } from '../_components/team-calendar-view'
import { Calendar } from 'lucide-react'

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb items={[{ label: 'Leave', href: `/${orgSlug}/leave` }, { label: 'Team Calendar' }]} />
        <h1 className="text-[20px] font-bold text-text">Team Calendar</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {new Date(validParams.year, validParams.month - 1).toLocaleDateString('en-SG', {
              month: 'long',
              year: 'numeric',
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No leave scheduled this month.</p>
            </div>
          ) : (
            <TeamCalendarView
              entries={entries}
              month={validParams.month}
              year={validParams.year}
              orgSlug={orgSlug}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
