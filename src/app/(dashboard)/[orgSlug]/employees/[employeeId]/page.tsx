import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
import { getEmployeeProfile } from '@/modules/employees/queries'
import { notFound } from 'next/navigation'
import { ProfileHeader } from '../_components/profile-header'
import { ProfileTabs } from '../_components/profile-tabs'

export const dynamic = 'force-dynamic'

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; employeeId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug, employeeId } = await params
  const rawSearchParams = await searchParams
  const activeTab = (rawSearchParams.tab as string) ?? 'personal'

  const session = await verifySession()
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)

  const employee = await getEmployeeProfile(
    session.userId,
    membership.role,
    org.id,
    employeeId
  )

  if (!employee) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Employees', href: `/${orgSlug}/employees` },
          { label: `${employee.firstName} ${employee.lastName}` },
        ]}
      />

      <ProfileHeader
        employee={employee}
        orgSlug={orgSlug}
        viewerRole={membership.role}
      />

      <ProfileTabs
        employee={employee}
        orgSlug={orgSlug}
        activeTab={activeTab}
        viewerUserId={session.userId}
        viewerRole={membership.role}
        orgId={org.id}
      />
    </div>
  )
}
