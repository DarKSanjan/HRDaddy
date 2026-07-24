'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import type { EmployeeProfile } from '@/modules/employees/queries'

interface PersonalTabProps {
  employee: EmployeeProfile
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-[12px] font-medium text-text-muted">{label}</dt>
      <dd className="text-[13px] text-text">{value || '—'}</dd>
    </div>
  )
}

export function PersonalTab({ employee }: PersonalTabProps) {
  return (
    <div className="space-y-6">
      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Work Email" value={employee.workEmail} />
            <Field
              label="Personal Email"
              value={employee.personalEmail !== undefined ? employee.personalEmail : undefined}
            />
            <Field
              label="Phone"
              value={employee.phone !== undefined ? employee.phone : undefined}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Date of Birth"
              value={
                employee.dateOfBirth !== undefined && employee.dateOfBirth
                  ? new Date(employee.dateOfBirth).toLocaleDateString()
                  : employee.dateOfBirth === undefined
                    ? 'Restricted'
                    : null
              }
            />
            <Field
              label="Gender"
              value={employee.gender !== undefined ? employee.gender : undefined}
            />
            <Field
              label="National ID"
              value={
                employee.nationalId !== undefined
                  ? employee.nationalId
                  : 'Restricted'
              }
            />
            <Field
              label="Address"
              value={
                employee.address !== undefined
                  ? employee.address
                  : 'Restricted'
              }
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
