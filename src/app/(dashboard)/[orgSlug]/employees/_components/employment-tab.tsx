'use client'

import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/core/ui'
import type { EmployeeProfile } from '@/modules/employees/queries'
import type { OrgRole } from '@prisma/client'

interface EmploymentTabProps {
  employee: EmployeeProfile
  viewerRole: OrgRole
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-[12px] font-medium text-text-muted">{label}</dt>
      <dd className="text-[13px] text-text">{value || '—'}</dd>
    </div>
  )
}

function formatCurrency(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null) return '—'
  const amount = cents / 100
  const cur = currency || 'USD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export function EmploymentTab({ employee, viewerRole }: EmploymentTabProps) {
  const showCompensation = ADMIN_ROLES.includes(viewerRole) || employee.compensationAmountCents !== undefined

  return (
    <div className="space-y-6">
      {/* Employment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Employment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Department" value={employee.department?.name} />
            <Field label="Job Title" value={employee.jobTitle?.name} />
            <Field label="Employment Type" value={employee.employmentType?.name} />
            <Field label="Location" value={employee.workLocation?.name} />
            <Field
              label="Start Date"
              value={employee.startDate ? new Date(employee.startDate).toLocaleDateString() : null}
            />
            <Field
              label="End Date"
              value={employee.endDate ? new Date(employee.endDate).toLocaleDateString() : null}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Reporting */}
      <Card>
        <CardHeader>
          <CardTitle>Reporting Line</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <dt className="text-[12px] font-medium text-text-muted">Manager</dt>
            <dd className="text-[13px] text-text">
              {employee.manager
                ? `${employee.manager.firstName} ${employee.manager.lastName}`
                : '—'}
            </dd>
          </div>

          {employee.directReports && employee.directReports.length > 0 && (
            <div className="space-y-2">
              <dt className="text-[12px] font-medium text-text-muted">
                Direct Reports ({employee.directReports.length})
              </dt>
              <div className="flex flex-wrap gap-2">
                {employee.directReports.map((report) => (
                  <Badge key={report.id} variant="neutral">
                    {report.firstName} {report.lastName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compensation */}
      {showCompensation && (
        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Salary"
                value={
                  employee.compensationAmountCents !== undefined
                    ? formatCurrency(employee.compensationAmountCents, employee.compensationCurrency)
                    : 'Restricted'
                }
              />
              <Field
                label="Currency"
                value={
                  employee.compensationCurrency !== undefined
                    ? employee.compensationCurrency
                    : undefined
                }
              />
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
