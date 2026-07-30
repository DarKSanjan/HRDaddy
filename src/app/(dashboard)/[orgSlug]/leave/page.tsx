import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/core/ui'
import { getEmployeeIdForUser, getOrgSettings } from '@/core/employees'
import { getEmployeeBalances, listOwnLeaveRequests } from '@/modules/leave/queries'
import { leaveListParamsSchema } from '@/modules/leave/schemas'
import { LeaveRequestTable } from './_components/leave-request-table'
import { LeaveBalanceCards } from './_components/leave-balance-cards'
import { CalendarDays, Plus } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function LeavePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const rawSearchParams = await searchParams

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('leave', enabledModules)

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <CalendarDays className="h-10 w-10 text-text-subtle" aria-hidden="true" />
        <h3 className="mt-4 text-[16px] font-semibold text-text">No employee record</h3>
        <p className="mt-1 max-w-sm text-[13px] text-text-muted">
          You need an employee record to access leave management.
        </p>
      </div>
    )
  }

  const listParams = leaveListParamsSchema.safeParse({
    status: rawSearchParams.status as string | undefined,
    leaveTypeId: rawSearchParams.leaveTypeId as string | undefined,
    page: rawSearchParams.page as string | undefined,
    pageSize: rawSearchParams.pageSize as string | undefined,
  })
  const validParams = listParams.success ? listParams.data : { page: 1, pageSize: 20 }

  const [balances, { requests, total }, settings] = await Promise.all([
    getEmployeeBalances(session.userId, org.id, employeeId),
    listOwnLeaveRequests(session.userId, org.id, employeeId, validParams),
    getOrgSettings(org.id),
  ])

  const orgTimezone = settings?.timezone ?? 'UTC'
  const currentPage = validParams.page
  const pageSize = validParams.pageSize
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Leave' }]}
        title="Leave"
        actions={
          <Link href={`/${orgSlug}/leave/request`}>
            <Button size="md">
              <Plus className="h-4 w-4" />
              Request Leave
            </Button>
          </Link>
        }
      />

      <LeaveBalanceCards balances={balances} />

      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="py-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No leave requests yet.</p>
            </div>
          ) : (
            <LeaveRequestTable
              requests={requests}
              total={total}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              orgSlug={orgSlug}
              orgTimezone={orgTimezone}
              showEmployee={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
