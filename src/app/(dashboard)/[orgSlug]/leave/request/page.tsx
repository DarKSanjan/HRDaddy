import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { PageHeader } from '@/core/ui'
import { listLeaveTypes } from '@/modules/leave/queries'
import { LeaveRequestForm } from '../_components/leave-request-form'

export const dynamic = 'force-dynamic'

export default async function LeaveRequestPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('leave', enabledModules)

  const leaveTypes = await listLeaveTypes(session.userId, org.id)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: 'Leave', href: `/${orgSlug}/leave` }, { label: 'New Request' }]}
        title="New Leave Request"
      />

      <div className="max-w-2xl">
        <LeaveRequestForm orgSlug={orgSlug} leaveTypes={leaveTypes} />
      </div>
    </div>
  )
}
