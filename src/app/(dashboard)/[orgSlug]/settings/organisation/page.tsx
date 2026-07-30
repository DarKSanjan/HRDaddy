import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { PageHeader } from '@/core/ui'
import {
  listDepartments,
  listJobTitles,
  listWorkLocations,
  listEmploymentTypes,
  getShiftTemplates,
} from '@/modules/employees/queries'
import { OrgStructurePanel } from './_components/org-structure-panel'
import { SettingsNav } from '../_components/settings-nav'

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

  const [departments, jobTitles, locations, employmentTypes, shiftTemplates] = await Promise.all([
    listDepartments(session.userId, org.id),
    listJobTitles(session.userId, org.id),
    listWorkLocations(session.userId, org.id),
    listEmploymentTypes(session.userId, org.id),
    getShiftTemplates(session.userId, org.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: 'Settings', href: `/${orgSlug}/settings` },
          { label: 'Organisation' },
        ]}
        title="Organisation Structure"
        subtitle="Manage departments, job titles, work locations, and employment types."
      />

      <SettingsNav orgSlug={orgSlug} enabledModules={enabledModules} />

      <OrgStructurePanel
        orgSlug={orgSlug}
        departments={departments}
        jobTitles={jobTitles}
        locations={locations}
        employmentTypes={employmentTypes}
        shiftTemplates={shiftTemplates}
      />
    </div>
  )
}
