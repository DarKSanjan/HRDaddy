import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/core/ui'
import { getEmployeeIdForUser } from '@/core/employees'
import { listTeamPendingRequests, listAllLeaveRequests } from '@/modules/leave/queries'
import { leaveListParamsSchema } from '@/modules/leave/schemas'
import { ApprovalList } from '../_components/approval-list'
import { ClipboardCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LeaveApprovalsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()
  const { org, enabledModules, membership } = await getOrgContext(orgSlug)
  moduleGuard('leave', enabledModules)
  await requirePermission(org.id, 'leave.request.approve')

  const employeeId = await getEmployeeIdForUser(org.id, session.userId)
  const role = membership.role

  let pendingRequests
  if (role === 'MANAGER' && employeeId) {
    pendingRequests = await listTeamPendingRequests(session.userId, org.id, employeeId)
  } else {
    // Owner or HR_ADMIN sees all pending
    const params = leaveListParamsSchema.parse({ status: 'PENDING', page: 1, pageSize: 50 })
    const result = await listAllLeaveRequests(session.userId, org.id, params)
    pendingRequests = result.requests
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Leave', href: `/${orgSlug}/leave` }, { label: 'Approvals' }]}
        title="Leave Approvals"
      />

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-muted">No pending leave requests.</p>
            </div>
          ) : (
            <ApprovalList requests={pendingRequests} orgSlug={orgSlug} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
