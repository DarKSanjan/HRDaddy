import { verifySession, getOrgContext, retryOnce } from '@/core/auth'
import { moduleGuard } from '@/core/modules'
import { Breadcrumb, Button, EmptyState } from '@/core/ui'
import { listEmployees, listDepartments, listEmploymentTypes, listWorkLocations } from '@/modules/employees/queries'
import { EmployeeTable } from './_components/employee-table'
import { EmployeeFilters } from './_components/employee-filters'
import { employeeListParamsSchema } from '@/modules/employees/schemas'
import { Users, Plus, Upload } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage({
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
  moduleGuard('employees', enabledModules)

  // Parse search params
  const listParams = employeeListParamsSchema.safeParse({
    search: rawSearchParams.search as string | undefined,
    departmentId: rawSearchParams.departmentId as string | undefined,
    status: rawSearchParams.status as string | undefined,
    employmentTypeId: rawSearchParams.employmentTypeId as string | undefined,
    locationId: rawSearchParams.locationId as string | undefined,
    sortBy: rawSearchParams.sortBy as string | undefined,
    sortOrder: rawSearchParams.sortOrder as string | undefined,
    page: rawSearchParams.page as string | undefined,
    pageSize: rawSearchParams.pageSize as string | undefined,
  })

  const validParams = listParams.success ? listParams.data : {}

  // Sequential rather than Promise.all: each call opens its own dbAs()
  // transaction, and four of those firing at once against this page was the
  // single largest concurrent-transaction load of any route in the app —
  // directly implicated in intermittent connection contention in production.
  //
  // This route still does more total DB round trips than any other single
  // page (getOrgContext's 3 reads + these 4 transactions), which measurably
  // correlates with a higher chance of hitting a transient pooler hiccup on
  // at least one of them. Retry the whole batch once on any failure rather
  // than trying to guess which individual call is the flaky one.
  const fetchEmployeesPageData = () =>
    Promise.resolve().then(async () => {
      const { employees, total } = await listEmployees(session.userId, org.id, validParams)
      const departments = await listDepartments(session.userId, org.id)
      const employmentTypes = await listEmploymentTypes(session.userId, org.id)
      const locations = await listWorkLocations(session.userId, org.id)
      return { employees, total, departments, employmentTypes, locations }
    })

  // Reuses retryOnce's cold-start backoff (150/400/1000ms + a final try)
  // instead of a hand-rolled single retry — same underlying cause as every
  // other cold-Lambda-connection fix in core/auth/dal.ts, so it gets the
  // same tuned schedule rather than a one-off guess at the right delay.
  // This batch always returns a populated object or throws, so there's no
  // "empty result" case to detect — only retry on throw.
  const pageData = await retryOnce(fetchEmployeesPageData, () => false)
  const { employees, total, departments, employmentTypes, locations } = pageData

  const hasFiltersApplied = !!(
    validParams.search ||
    validParams.departmentId ||
    validParams.status ||
    validParams.employmentTypeId ||
    validParams.locationId
  )

  const pageSize = validParams.pageSize ?? 20
  const currentPage = validParams.page ?? 1
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumb items={[{ label: 'Employees' }]} />
          <h1 className="text-[20px] font-bold text-text">Employees</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${orgSlug}/employees/import`}>
            <Button variant="secondary" size="md">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href={`/${orgSlug}/employees/new`}>
            <Button size="md">
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </Link>
        </div>
      </div>

      <EmployeeFilters
        departments={departments}
        employmentTypes={employmentTypes}
        locations={locations}
        currentParams={validParams}
        orgSlug={orgSlug}
      />

      {employees.length === 0 && !hasFiltersApplied ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="mb-4" aria-hidden="true">
            <Users className="h-10 w-10 text-text-subtle" />
          </div>
          <h3 className="text-[16px] font-semibold text-text">No employees yet</h3>
          <p className="mt-1 max-w-sm text-[13px] text-text-muted">
            Add your first employee to get started with workforce management.
          </p>
          <Link href={`/${orgSlug}/employees/new`} className="mt-4">
            <Button>Add Employee</Button>
          </Link>
        </div>
      ) : employees.length === 0 && hasFiltersApplied ? (
        <EmptyState
          icon={<Users className="h-10 w-10 text-text-subtle" />}
          title="No results"
          description="No employees match your current filters. Try adjusting your search criteria."
        />
      ) : (
        <EmployeeTable
          employees={employees}
          total={total}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          orgSlug={orgSlug}
        />
      )}
    </div>
  )
}
