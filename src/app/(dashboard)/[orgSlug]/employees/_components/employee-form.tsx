'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, FormField, Card, CardContent, CardHeader, CardTitle, Select } from '@/core/ui'
import { createEmployee, updateEmployee, type ActionResult } from '@/modules/employees/actions'

interface Option {
  id: string
  name: string
}

interface EmploymentTypeOption {
  id: string
  name: string
  defaultShiftTemplateId: string | null
}

interface EmployeeFormProps {
  orgSlug: string
  departments: Option[]
  jobTitles: Option[]
  locations: Option[]
  employmentTypes: EmploymentTypeOption[]
  shiftTemplates?: Option[]
  defaultValues?: {
    employeeId?: string
    firstName?: string
    lastName?: string
    workEmail?: string
    personalEmail?: string | null
    phone?: string | null
    dateOfBirth?: Date | null
    gender?: string | null
    nationalId?: string | null
    address?: string | null
    startDate?: Date | null
    departmentId?: string | null
    jobTitleId?: string | null
    locationId?: string | null
    employmentTypeId?: string | null
    managerId?: string | null
    compensationAmountCents?: number | null
    compensationCurrency?: string | null
    isWorkman?: boolean
    shiftTemplateId?: string | null
    payType?: string | null
    bankName?: string | null
    bankAccountNumber?: string | null
  }
  managers?: { id: string; firstName: string; lastName: string }[]
  mode?: 'create' | 'edit'
  isSimplePayroll?: boolean
}

const initialState: ActionResult = { success: false }

export function EmployeeForm({
  orgSlug,
  departments,
  jobTitles,
  locations,
  employmentTypes,
  shiftTemplates = [],
  defaultValues,
  managers = [],
  mode = 'create',
  isSimplePayroll = false,
}: EmployeeFormProps) {
  const router = useRouter()
  const [shiftTemplateId, setShiftTemplateId] = useState(defaultValues?.shiftTemplateId ?? '')
  const [payType, setPayType] = useState(defaultValues?.payType ?? 'SALARIED')

  const handleEmploymentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    if (selectedId) {
      const et = employmentTypes.find((t) => t.id === selectedId)
      if (et?.defaultShiftTemplateId) {
        setShiftTemplateId(et.defaultShiftTemplateId)
      }
    }
  }

  const action = async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    const result = mode === 'create'
      ? await createEmployee(orgSlug, formData)
      : await updateEmployee(orgSlug, formData)

    if (result.success) {
      if (mode === 'create' && result.data && typeof result.data === 'object' && 'id' in result.data) {
        router.push(`/${orgSlug}/employees/${(result.data as { id: string }).id}`)
      } else if (mode === 'edit' && defaultValues?.employeeId) {
        router.push(`/${orgSlug}/employees/${defaultValues.employeeId}`)
      }
    }
    return result
  }

  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-6">
      {defaultValues?.employeeId && (
        <input type="hidden" name="employeeId" value={defaultValues.employeeId} />
      )}

      {state.error && (
        <div
          className="rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="First Name"
              htmlFor="firstName"
              required
              error={state.fieldErrors?.firstName}
            >
              <Input
                id="firstName"
                name="firstName"
                required
                defaultValue={defaultValues?.firstName ?? ''}
              />
            </FormField>
            <FormField
              label="Last Name"
              htmlFor="lastName"
              required
              error={state.fieldErrors?.lastName}
            >
              <Input
                id="lastName"
                name="lastName"
                required
                defaultValue={defaultValues?.lastName ?? ''}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Work Email"
              htmlFor="workEmail"
              required
              error={state.fieldErrors?.workEmail}
            >
              <Input
                id="workEmail"
                name="workEmail"
                type="email"
                required
                defaultValue={defaultValues?.workEmail ?? ''}
              />
            </FormField>
            <FormField label="Personal Email" htmlFor="personalEmail">
              <Input
                id="personalEmail"
                name="personalEmail"
                type="email"
                defaultValue={defaultValues?.personalEmail ?? ''}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone" htmlFor="phone">
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={defaultValues?.phone ?? ''}
              />
            </FormField>
            <FormField label="Date of Birth" htmlFor="dateOfBirth">
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                defaultValue={
                  defaultValues?.dateOfBirth
                    ? new Date(defaultValues.dateOfBirth).toISOString().split('T')[0]
                    : ''
                }
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Gender" htmlFor="gender">
              <Select
                id="gender"
                name="gender"
                defaultValue={defaultValues?.gender ?? ''}
                >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </Select>
            </FormField>
            <FormField label="National ID" htmlFor="nationalId">
              <Input
                id="nationalId"
                name="nationalId"
                defaultValue={defaultValues?.nationalId ?? ''}
              />
            </FormField>
          </div>

          <FormField label="Address" htmlFor="address">
            <Input
              id="address"
              name="address"
              defaultValue={defaultValues?.address ?? ''}
            />
          </FormField>
        </CardContent>
      </Card>

      {/* Employment Information */}
      <Card>
        <CardHeader>
          <CardTitle>Employment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start Date" htmlFor="startDate">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={
                  defaultValues?.startDate
                    ? new Date(defaultValues.startDate).toISOString().split('T')[0]
                    : ''
                }
              />
            </FormField>
            <FormField label="Department" htmlFor="departmentId">
              <Select
                id="departmentId"
                name="departmentId"
                defaultValue={defaultValues?.departmentId ?? ''}
                >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Job Title" htmlFor="jobTitleId">
              <Select
                id="jobTitleId"
                name="jobTitleId"
                defaultValue={defaultValues?.jobTitleId ?? ''}
              >
                <option value="">No job title</option>
                {jobTitles.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Employment Type" htmlFor="employmentTypeId">
              <Select
                id="employmentTypeId"
                name="employmentTypeId"
                defaultValue={defaultValues?.employmentTypeId ?? ''}
                onChange={handleEmploymentTypeChange}
              >
                <option value="">Not specified</option>
                {employmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Location" htmlFor="locationId">
              <Select
                id="locationId"
                name="locationId"
                defaultValue={defaultValues?.locationId ?? ''}
              >
                <option value="">Not specified</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Manager" htmlFor="managerId">
              <Select
                id="managerId"
                name="managerId"
                defaultValue={defaultValues?.managerId ?? ''}
              >
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isSimplePayroll && (
            <FormField label="Shift Template" htmlFor="shiftTemplateId">
              <Select
                id="shiftTemplateId"
                name="shiftTemplateId"
                value={shiftTemplateId}
                onChange={(e) => setShiftTemplateId(e.target.value)}
              >
                <option value="">No shift template</option>
                {shiftTemplates.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </Select>
            </FormField>
            )}
            {!isSimplePayroll && (
            <FormField label="Pay Type" htmlFor="payType">
              <Select
                id="payType"
                name="payType"
                value={payType}
                onChange={(e) => setPayType(e.target.value)}
              >
                <option value="SALARIED">Salaried</option>
                <option value="HOURLY">Hourly</option>
              </Select>
            </FormField>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Salary (cents)"
              htmlFor="compensationAmountCents"
              hint="Enter amount in cents (e.g. 500000 = $5,000)"
            >
              <Input
                id="compensationAmountCents"
                name="compensationAmountCents"
                type="number"
                min="0"
                step="1"
                defaultValue={defaultValues?.compensationAmountCents ?? ''}
              />
            </FormField>
            <FormField label="Currency" htmlFor="compensationCurrency">
              <Input
                id="compensationCurrency"
                name="compensationCurrency"
                placeholder="USD"
                maxLength={3}
                defaultValue={defaultValues?.compensationCurrency ?? ''}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Bank Name" htmlFor="bankName">
              <Input
                id="bankName"
                name="bankName"
                placeholder="DBS, OCBC, UOB..."
                defaultValue={defaultValues?.bankName ?? ''}
              />
            </FormField>
            <FormField label="Bank Account Number" htmlFor="bankAccountNumber">
              <Input
                id="bankAccountNumber"
                name="bankAccountNumber"
                placeholder="Account number"
                defaultValue={defaultValues?.bankAccountNumber ?? ''}
              />
            </FormField>
          </div>

          {!isSimplePayroll && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="hidden"
              name="isWorkman"
              value="false"
            />
            <input
              type="checkbox"
              name="isWorkman"
              value="true"
              defaultChecked={defaultValues?.isWorkman ?? false}
              className="rounded border-border"
            />
            <div>
              <div className="text-[13px] font-medium text-text">
                Workman (manual/production role)
              </div>
              <div className="text-[12px] text-text-muted">
                MOM Part IV applies a higher statutory overtime threshold ($4,500/mo) for workmen vs non-workmen ($2,600/mo).
              </div>
            </div>
          </label>
          )}
        </CardContent>
      </Card>

      {/* Portal access */}
      {mode === 'create' && (
        <Card>
          <CardContent className="pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="inviteToPortal"
                value="true"
                className="rounded border-border"
              />
              <div>
                <div className="text-[13px] font-medium text-text">
                  Invite to portal
                </div>
                <div className="text-[12px] text-text-muted">
                  Send an invitation email so this employee can access the self-service portal.
                </div>
              </div>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {mode === 'create' ? 'Create Employee' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/${orgSlug}/employees`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
