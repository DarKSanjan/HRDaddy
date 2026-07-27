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
import { getPayrollComplexity } from '@/modules/payroll/settings'
import { getReviewComplexity } from '@/modules/performance/settings'
import { getEmployeeIdForUser } from '@/core/employees'
import { getEmployeeReviewHistory, getPerformanceAutoMetrics, listCycles } from '@/modules/performance/queries'
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

  const payrollComplexity = await getPayrollComplexity(org.id)

  // Performance data
  const performanceEnabled = enabledModules.includes('performance')
  let reviewHistory: Awaited<ReturnType<typeof getEmployeeReviewHistory>> = []
  let autoMetrics: Awaited<ReturnType<typeof getPerformanceAutoMetrics>> | null = null
  let reviewComplexity: 'simple' | 'advanced' = 'simple'

  if (performanceEnabled) {
    const callerEmployeeId = await getEmployeeIdForUser(org.id, session.userId)
    const isOwnProfile = callerEmployeeId === employeeId
    const canViewAll = hasPermission(membership.role, enabledModules, 'performance.review.view_all')
    const isManager = employee.manager?.id === callerEmployeeId

    if (isOwnProfile || canViewAll || isManager) {
      reviewHistory = await getEmployeeReviewHistory(
        session.userId,
        org.id,
        employeeId,
        isOwnProfile
      )

      // Auto-metrics: use active cycle's date range, or current quarter
      const cycles = await listCycles(session.userId, org.id)
      const activeCycle = cycles.find((c) => c.status === 'ACTIVE')
      const now = new Date()
      const metricsStart = activeCycle?.startDate ?? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      const metricsEnd = activeCycle?.endDate ?? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)

      autoMetrics = await getPerformanceAutoMetrics(
        session.userId,
        org.id,
        employeeId,
        metricsStart,
        metricsEnd
      )
    }

    reviewComplexity = await getReviewComplexity(org.id)
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
        performanceEnabled={performanceEnabled}
        isSimplePayroll={payrollComplexity === 'simple'}
        reviewHistory={reviewHistory}
        autoMetrics={autoMetrics}
        reviewComplexity={reviewComplexity}
      />
    </div>
  )
}
