import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { getEmployeeIdForUser, getOrgSettings } from '@/core/employees'
import {
  getCurrentAttendanceState,
  getAttendanceWithShiftMetrics,
} from '@/modules/attendance/queries'
import { attendanceListParamsSchema } from '@/modules/attendance/schemas'
import { TZDate } from '@date-fns/tz'
import { ClockWidget } from './_components/clock-widget'
import { AttendanceHistoryTable } from './_components/attendance-history-table'
import { AttendanceSummaryCards } from './_components/attendance-summary-cards'
import { Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AttendancePage({
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

  const canCorrect = hasPermission(membership.role, enabledModules, 'attendance.correct')

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Clock className="h-10 w-10 text-text-subtle" aria-hidden="true" />
        <h3 className="mt-4 text-[16px] font-semibold text-text">No employee record</h3>
        <p className="mt-1 max-w-sm text-[13px] text-text-muted">
          You need an employee record to access attendance.
        </p>
      </div>
    )
  }

  const listParams = attendanceListParamsSchema.safeParse({
    month: rawSearchParams.month as string | undefined,
    year: rawSearchParams.year as string | undefined,
    page: rawSearchParams.page as string | undefined,
    pageSize: rawSearchParams.pageSize as string | undefined,
  })
  const validParams = listParams.success ? listParams.data : { page: 1, pageSize: 31 }

  const now = new Date()
  const month = validParams.month ?? now.getMonth() + 1
  const year = validParams.year ?? now.getFullYear()

  const settings = await getOrgSettings(org.id)
  const timezone = settings?.timezone ?? 'UTC'

  const [currentState, { records }] = await Promise.all([
    getCurrentAttendanceState(session.userId, org.id, employeeId),
    getAttendanceWithShiftMetrics(session.userId, org.id, employeeId, { ...validParams, month, year }),
  ])

  // Derive shift-aware summary from the metrics records
  const closedRecords = records.filter((r) => r.status === 'CLOSED' || r.status === 'CORRECTED')
  const daysPresent = closedRecords.length
  const totalMinutes = closedRecords.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0)
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10
  const lateArrivals = records.filter((r) => r.lateMinutes > 0).length

  let averageStartTime: string | null = null
  if (closedRecords.length > 0) {
    const startMins = closedRecords.map((r) => {
      const local = new TZDate(r.clockIn.getTime(), timezone)
      return local.getHours() * 60 + local.getMinutes()
    })
    const avgStart = Math.round(startMins.reduce((a, b) => a + b, 0) / startMins.length)
    averageStartTime = `${String(Math.floor(avgStart / 60)).padStart(2, '0')}:${String(avgStart % 60).padStart(2, '0')}`
  }

  const summary = { daysPresent, totalHours, averageStartTime, lateArrivals }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumb items={[{ label: 'Attendance' }]} />
        <h1 className="text-[20px] font-bold text-text">Attendance</h1>
      </div>

      <ClockWidget
        isClockedIn={currentState.isClockedIn}
        currentRecord={currentState.currentRecord}
        orgSlug={orgSlug}
      />

      <AttendanceSummaryCards summary={summary} />

      <Card>
        <CardHeader>
          <CardTitle>
            History — {new Date(year, month - 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No attendance records this month.</p>
            </div>
          ) : (
            <AttendanceHistoryTable
              records={records}
              timezone={timezone}
              canCorrect={canCorrect}
              orgSlug={orgSlug}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
