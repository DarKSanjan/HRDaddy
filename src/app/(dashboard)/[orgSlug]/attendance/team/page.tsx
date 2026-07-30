import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import {
  getTeamAttendanceOverview,
  getOrgAttendanceOverview,
} from '@/modules/attendance/queries'
import { getLatestClosedCycleId, getCycleReviews } from '@/modules/performance/queries'
import { TeamAttendanceTable } from './_components/team-attendance-table'
import { AttendanceHeadcountDonut } from './_components/attendance-headcount-donut'
import { LateArrivalsBar } from './_components/late-arrivals-bar'
import { OvertimeHoursBar } from './_components/overtime-hours-bar'
import { TeamPerformanceBar } from './_components/team-performance-bar'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TeamAttendancePage({
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
  moduleGuard('attendance', enabledModules)

  const role = membership.role

  // Permission gate: MANAGER gets view_team, OWNER/HR_ADMIN gets view_all
  if (role === 'MANAGER') {
    await requirePermission(org.id, 'attendance.view_team')
  } else {
    await requirePermission(org.id, 'attendance.view_all')
  }

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)

  // Parse month/year from search params
  const now = new Date()
  const month = rawSearchParams.month ? Number(rawSearchParams.month) : now.getMonth() + 1
  const year = rawSearchParams.year ? Number(rawSearchParams.year) : now.getFullYear()

  let overview
  if (role === 'MANAGER' && employeeId) {
    overview = await getTeamAttendanceOverview(session.userId, org.id, employeeId, month, year)
  } else {
    // OWNER or HR_ADMIN: org-wide
    overview = await getOrgAttendanceOverview(session.userId, org.id, month, year)
  }

  // Team performance data (only if performance module is enabled)
  let teamPerformanceData: Array<{ employeeName: string; overallScore: number }> = []
  if (enabledModules.includes('performance')) {
    const closedCycleId = await getLatestClosedCycleId(session.userId, org.id)
    if (closedCycleId) {
      const filterByManager = role === 'MANAGER' ? employeeId : null
      const reviews = await getCycleReviews(
        session.userId,
        org.id,
        closedCycleId,
        filterByManager
      )
      teamPerformanceData = reviews
        .filter((r) => r.status === 'PUBLISHED' && r.overallScore != null)
        .map((r) => ({
          employeeName: `${r.employeeFirstName} ${r.employeeLastName}`,
          overallScore: r.overallScore!,
        }))
    }
  }

  const scopeLabel = role === 'MANAGER' ? 'Team' : 'Organisation'

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Attendance', href: `/${orgSlug}/attendance` },
          { label: `${scopeLabel} Overview` },
        ]}
        title={`${scopeLabel} Attendance`}
      />

      {/* Dashboard charts */}
      {overview.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AttendanceHeadcountDonut
            employees={overview}
            totalEmployees={overview.length}
          />
          <LateArrivalsBar employees={overview} />
          <OvertimeHoursBar employees={overview} />
        </div>
      )}

      {/* Team performance */}
      {teamPerformanceData.length > 0 && (
        <TeamPerformanceBar data={teamPerformanceData} />
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {new Date(year, month - 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">
                {role === 'MANAGER'
                  ? 'No direct reports found or no attendance this month.'
                  : 'No attendance records this month.'}
              </p>
            </div>
          ) : (
            <TeamAttendanceTable employees={overview} orgSlug={orgSlug} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
