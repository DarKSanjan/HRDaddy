import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
import {
  listDepartments,
  listJobTitles,
  listWorkLocations,
  listEmploymentTypes,
} from '@/modules/employees/queries'
import { OrgStructurePanel } from './_components/org-structure-panel'

export const dynamic = 'force-dynamic'

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)
  await requirePermission(org.id, 'department.manage')

  const [departments, jobTitles, locations, employmentTypes] = await Promise.all([
    listDepartments(session.userId, org.id),
    listJobTitles(session.userId, org.id),
    listWorkLocations(session.userId, org.id),
    listEmploymentTypes(session.userId, org.id),
  ])

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Organisation' },
        ]}
      />

      <h1 className="text-[20px] font-bold text-text">Organisation Structure</h1>
      <p className="text-[13px] text-text-muted">
        Manage departments, job titles, work locations, and employment types.
      </p>

      <OrgStructurePanel
        orgSlug={orgSlug}
        departments={departments}
        jobTitles={jobTitles}
        locations={locations}
        employmentTypes={employmentTypes}
      />
    </div>
  )
}
