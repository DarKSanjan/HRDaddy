import { verifySession, getOrgContext } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { hasPermission } from '@/core/permissions'
import { Breadcrumb } from '@/core/ui'
import {
  getEmployeeProfile,
  listDepartments,
  listJobTitles,
  listWorkLocations,
  listEmploymentTypes,
  listEmployees,
  getShiftTemplates,
} from '@/modules/employees/queries'
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

  const canEdit = hasPermission(membership.role, enabledModules, 'employee.edit')
  const documentsEnabled = enabledModules.includes('documents')
  const leaveEnabled = enabledModules.includes('leave')

  // Load org-structure data for the edit forms (only when user can edit)
  let departments: { id: string; name: string }[] = []
  let jobTitles: { id: string; name: string }[] = []
  let locations: { id: string; name: string }[] = []
  let employmentTypes: { id: string; name: string }[] = []
  let managers: { id: string; firstName: string; lastName: string }[] = []
  let shiftTemplates: { id: string; name: string }[] = []

  if (canEdit) {
    const [depts, jts, locs, ets, empList, shifts] = await Promise.all([
      listDepartments(session.userId, org.id),
      listJobTitles(session.userId, org.id),
      listWorkLocations(session.userId, org.id),
      listEmploymentTypes(session.userId, org.id),
      listEmployees(session.userId, org.id, { pageSize: 200 }),
      getShiftTemplates(session.userId, org.id),
    ])
    departments = depts.map((d) => ({ id: d.id, name: d.name }))
    jobTitles = jts.map((j) => ({ id: j.id, name: j.name }))
    locations = locs.map((l) => ({ id: l.id, name: l.name }))
    employmentTypes = ets.map((e) => ({ id: e.id, name: e.name }))
    managers = empList.employees.map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
    }))
    shiftTemplates = shifts.map((s) => ({ id: s.id, name: s.name }))
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
        viewerRole={membership.role}
        canEdit={canEdit}
        departments={departments}
        jobTitles={jobTitles}
        locations={locations}
        employmentTypes={employmentTypes}
        managers={managers}
        shiftTemplates={shiftTemplates}
        documentsEnabled={documentsEnabled}
        leaveEnabled={leaveEnabled}
      />
    </div>
  )
}
