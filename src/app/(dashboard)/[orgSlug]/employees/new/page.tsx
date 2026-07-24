'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createEmployee, type EmployeeFormState } from '@/actions/employees'
import { Button } from '@/core/ui/button'
import { Input } from '@/core/ui/input'
import { FormField } from '@/core/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function NewEmployeePage() {
  const params = useParams<{ orgSlug: string }>()
  const [state, formAction, pending] = useActionState(createEmployee, {
    error: null,
    fieldErrors: {},
  } as EmployeeFormState)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/${params.orgSlug}/employees`}
          className="flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-[20px] font-bold text-text">Add Employee</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="orgSlug" value={params.orgSlug} />

            {state.error && (
              <div className="rounded-[var(--radius-sm)] bg-danger/10 p-3 text-[13px] text-danger" role="alert">
                {state.error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First Name" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
                <Input id="firstName" name="firstName" required />
              </FormField>
              <FormField label="Last Name" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
                <Input id="lastName" name="lastName" required />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Work Email" htmlFor="workEmail" required error={state.fieldErrors?.workEmail}>
                <Input id="workEmail" name="workEmail" type="email" required />
              </FormField>
              <FormField label="Personal Email" htmlFor="personalEmail">
                <Input id="personalEmail" name="personalEmail" type="email" />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" htmlFor="phone">
                <Input id="phone" name="phone" type="tel" />
              </FormField>
              <FormField label="Date of Birth" htmlFor="dateOfBirth">
                <Input id="dateOfBirth" name="dateOfBirth" type="date" />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start Date" htmlFor="startDate">
                <Input id="startDate" name="startDate" type="date" />
              </FormField>
              <FormField label="Employment Type" htmlFor="employmentType">
                <Input
                  id="employmentType"
                  name="employmentType"
                  placeholder="e.g. Full-time, Part-time"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Department" htmlFor="department">
                <Input
                  id="department"
                  name="department"
                  placeholder="e.g. Engineering"
                />
              </FormField>
              <FormField label="Job Title" htmlFor="jobTitle">
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  placeholder="e.g. Software Engineer"
                />
              </FormField>
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={pending}>
                Create Employee
              </Button>
              <Link href={`/${params.orgSlug}/employees`}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
