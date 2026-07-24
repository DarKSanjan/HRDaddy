import { verifySession, getOrgBySlug, getOrgMembership } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CalendarDays, Clock, FileText } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/sign-in')

  const membership = await getOrgMembership(session.userId, org.id)
  if (!membership || !membership.isActive) redirect('/sign-in')

  const isAdmin = membership.role === 'OWNER' || membership.role === 'HR_ADMIN'

  // Fetch metrics (scoped to org)
  const [activeEmployees, onLeaveToday, pendingRequests] = await Promise.all([
    db.employee.count({
      where: { orgId: org.id, employmentStatus: 'ACTIVE' },
    }),
    db.leaveRequest.count({
      where: {
        orgId: org.id,
        status: 'APPROVED',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    }),
    db.leaveRequest.count({
      where: { orgId: org.id, status: 'PENDING' },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome back, {session.name}
        </p>
      </div>

      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Active Employees"
            value={activeEmployees}
            icon={<Users className="h-5 w-5 text-blue-600" />}
          />
          <MetricCard
            title="On Leave Today"
            value={onLeaveToday}
            icon={<CalendarDays className="h-5 w-5 text-amber-600" />}
          />
          <MetricCard
            title="Pending Requests"
            value={pendingRequests}
            icon={<Clock className="h-5 w-5 text-purple-600" />}
          />
          <MetricCard
            title="Documents"
            value={0}
            icon={<FileText className="h-5 w-5 text-green-600" />}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My Leave Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Check your available leave days in the Leave section.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Track your attendance in the Attendance section.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
