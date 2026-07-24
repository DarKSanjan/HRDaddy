import Link from 'next/link'
import { redirect } from 'next/navigation'
import { verifySession, getOrgBySlug, getOrgMembership } from '@/lib/dal'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await verifySession()

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/sign-in')

  const membership = await getOrgMembership(session.userId, org.id)
  if (!membership || !membership.isActive) redirect('/sign-in')

  if (!hasPermission(membership.role, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
    redirect(`/${orgSlug}/dashboard`)
  }

  const employees = await db.employee.findMany({
    where: { orgId: org.id },
    include: {
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const canCreate = hasPermission(membership.role, PERMISSIONS.EMPLOYEE_CREATE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500">
            Manage your organisation&apos;s employees
          </p>
        </div>
        {canCreate && (
          <Link href={`/${orgSlug}/employees/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Employee Directory ({employees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">
                No employees yet.{' '}
                {canCreate && (
                  <Link
                    href={`/${orgSlug}/employees/new`}
                    className="text-blue-600 hover:underline"
                  >
                    Add your first employee
                  </Link>
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Department</th>
                    <th className="pb-3 pr-4 font-medium">Job Title</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/${orgSlug}/employees/${employee.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {employee.firstName} {employee.lastName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {employee.workEmail}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {employee.department?.name ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {employee.jobTitle?.name ?? '—'}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={employee.employmentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    DRAFT: 'bg-gray-100 text-gray-700',
    INVITED: 'bg-blue-100 text-blue-700',
    SUSPENDED: 'bg-amber-100 text-amber-700',
    DEACTIVATED: 'bg-red-100 text-red-700',
    ARCHIVED: 'bg-gray-100 text-gray-500',
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}
