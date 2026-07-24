import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { verifySession, getOrgBySlug, getOrgMembership } from '@/lib/dal'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Pencil } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string; employeeId: string }>
}) {
  const { orgSlug, employeeId } = await params
  const session = await verifySession()

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/sign-in')

  const membership = await getOrgMembership(session.userId, org.id)
  if (!membership || !membership.isActive) redirect('/sign-in')

  if (!hasPermission(membership.role, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
    redirect(`/${orgSlug}/dashboard`)
  }

  const employee = await db.employee.findFirst({
    where: { id: employeeId, orgId: org.id },
    include: {
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
      employmentType: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  })

  if (!employee) {
    notFound()
  }

  const canEdit = hasPermission(membership.role, PERMISSIONS.EMPLOYEE_EDIT)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/${orgSlug}/employees`}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {employee.firstName} {employee.lastName}
          </h1>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" disabled>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Full Name" value={`${employee.firstName} ${employee.lastName}`} />
            <InfoRow label="Work Email" value={employee.workEmail} />
            <InfoRow label="Personal Email" value={employee.personalEmail} />
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow
              label="Date of Birth"
              value={employee.dateOfBirth?.toLocaleDateString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Status" value={employee.employmentStatus} />
            <InfoRow label="Department" value={employee.department?.name} />
            <InfoRow label="Job Title" value={employee.jobTitle?.name} />
            <InfoRow label="Employment Type" value={employee.employmentType?.name} />
            <InfoRow
              label="Start Date"
              value={employee.startDate?.toLocaleDateString()}
            />
            <InfoRow
              label="Manager"
              value={
                employee.manager
                  ? `${employee.manager.firstName} ${employee.manager.lastName}`
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value ?? '—'}</span>
    </div>
  )
}
