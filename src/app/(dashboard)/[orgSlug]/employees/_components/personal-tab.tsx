'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button, Input, FormField, Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { updateEmployee, type ActionResult } from '@/modules/employees/actions'
import type { EmployeeProfile } from '@/modules/employees/queries'

interface PersonalTabProps {
  employee: EmployeeProfile
  orgSlug: string
  canEdit: boolean
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-[12px] font-medium text-text-muted">{label}</dt>
      <dd className="text-[13px] text-text">{value || '—'}</dd>
    </div>
  )
}

const initialState: ActionResult = { success: false }

export function PersonalTab({ employee, orgSlug, canEdit }: PersonalTabProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  const action = async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    const result = await updateEmployee(orgSlug, formData)
    if (result.success) {
      setEditing(false)
      router.refresh()
    }
    return result
  }

  const [state, formAction, pending] = useActionState(action, initialState)

  if (editing) {
    return (
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="employeeId" value={employee.id} />

        {state.error && (
          <div
            className="rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger"
            role="alert"
          >
            {state.error}
          </div>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contact Information</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Work Email" htmlFor="workEmail" required error={state.fieldErrors?.workEmail}>
                <Input id="workEmail" name="workEmail" type="email" required defaultValue={employee.workEmail} />
              </FormField>
              <FormField label="Personal Email" htmlFor="personalEmail" error={state.fieldErrors?.personalEmail}>
                <Input
                  id="personalEmail"
                  name="personalEmail"
                  type="email"
                  defaultValue={employee.personalEmail ?? ''}
                />
              </FormField>
              <FormField label="Phone" htmlFor="phone" error={state.fieldErrors?.phone}>
                <Input id="phone" name="phone" type="tel" defaultValue={employee.phone ?? ''} />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="First Name" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
                <Input id="firstName" name="firstName" required defaultValue={employee.firstName} />
              </FormField>
              <FormField label="Last Name" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
                <Input id="lastName" name="lastName" required defaultValue={employee.lastName} />
              </FormField>
              <FormField label="Date of Birth" htmlFor="dateOfBirth">
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={
                    employee.dateOfBirth
                      ? new Date(employee.dateOfBirth).toISOString().split('T')[0]
                      : ''
                  }
                />
              </FormField>
              <FormField label="Gender" htmlFor="gender">
                <select
                  id="gender"
                  name="gender"
                  defaultValue={employee.gender ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </FormField>
              <FormField label="National ID" htmlFor="nationalId">
                <Input id="nationalId" name="nationalId" defaultValue={employee.nationalId ?? ''} />
              </FormField>
              <FormField label="Address" htmlFor="address">
                <Input id="address" name="address" defaultValue={employee.address ?? ''} />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>
            Save Changes
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-6">
      {/* Edit button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      )}

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
