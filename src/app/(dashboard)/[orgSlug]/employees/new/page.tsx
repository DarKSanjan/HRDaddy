'use client'

import { useActionState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createEmployee, type EmployeeFormState } from '@/actions/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Employee</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="orgSlug" value={params.orgSlug} />

            {state.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {state.error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" required />
                {state.fieldErrors?.firstName && (
                  <p className="text-xs text-red-600">{state.fieldErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" required />
                {state.fieldErrors?.lastName && (
                  <p className="text-xs text-red-600">{state.fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workEmail">Work Email *</Label>
                <Input id="workEmail" name="workEmail" type="email" required />
                {state.fieldErrors?.workEmail && (
                  <p className="text-xs text-red-600">{state.fieldErrors.workEmail}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="personalEmail">Personal Email</Label>
                <Input id="personalEmail" name="personalEmail" type="email" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employmentType">Employment Type</Label>
                <Input
                  id="employmentType"
                  name="employmentType"
                  placeholder="e.g. Full-time, Part-time"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  name="department"
                  placeholder="e.g. Engineering"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  placeholder="e.g. Software Engineer"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating...' : 'Create Employee'}
              </Button>
              <Link href={`/${params.orgSlug}/employees`}>
                <Button type="button" variant="outline">
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
