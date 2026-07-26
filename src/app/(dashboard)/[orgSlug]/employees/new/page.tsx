import { verifySession, getOrgContext, requirePermission } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb } from '@/core/ui'
import { listDepartments, listJobTitles, listWorkLocations, listEmploymentTypes, getShiftTemplates } from '@/modules/employees/queries'
import { getPayrollComplexity } from '@/modules/payroll/settings'
import { EmployeeForm } from '../_components/employee-form'

export const dynamic = 'force-dynamic'

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  const session = await verifySession()
  const { org, enabledModules } = await getOrgContext(orgSlug)
  moduleGuard('employees', enabledModules)
  await requirePermission(org.id, 'employee.create')

  // Fetch org structure for form selects
  const [departments, jobTitles, locations, employmentTypes, shiftTemplates] = await Promise.all([
    listDepartments(session.userId, org.id),
    listJobTitles(session.userId, org.id),
    listWorkLocations(session.userId, org.id),
    listEmploymentTypes(session.userId, org.id),
    getShiftTemplates(session.userId, org.id),
  ])

  const payrollComplexity = await getPayrollComplexity(org.id)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Employees', href: `/${orgSlug}/employees` },
          { label: 'Add Employee' },
        ]}
      />

      <h1 className="text-[20px] font-bold text-text">Add Employee</h1>

      <EmployeeForm
        orgSlug={orgSlug}
        departments={departments}
        jobTitles={jobTitles}
        locations={locations}
        employmentTypes={employmentTypes}
        shiftTemplates={shiftTemplates}
        isSimplePayroll={payrollComplexity === 'simple'}
      />
    </div>
  )
}
