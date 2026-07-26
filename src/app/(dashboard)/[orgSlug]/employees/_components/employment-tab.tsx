'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button, Input, FormField, Card, CardContent, CardHeader, CardTitle, Badge } from '@/core/ui'
import { updateEmployee, type ActionResult } from '@/modules/employees/actions'
import type { EmployeeProfile } from '@/modules/employees/queries'
import type { OrgRole } from '@prisma/client'

interface EmploymentTabProps {
  employee: EmployeeProfile
  orgSlug: string
  viewerRole: OrgRole
  canEdit: boolean
  departments?: { id: string; name: string }[]
  jobTitles?: { id: string; name: string }[]
  locations?: { id: string; name: string }[]
  employmentTypes?: { id: string; name: string }[]
  managers?: { id: string; firstName: string; lastName: string }[]
  shiftTemplates?: { id: string; name: string }[]
  isSimplePayroll?: boolean
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

function formatPayType(payType: string | null | undefined): string {
  if (!payType) return '—'
  return payType === 'HOURLY' ? 'Hourly' : 'Salaried'
}

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const initialState: ActionResult = { success: false }

export function EmploymentTab({
  employee,
  orgSlug,
  viewerRole,
  canEdit,
  departments = [],
  jobTitles = [],
  locations = [],
  employmentTypes = [],
  managers = [],
  shiftTemplates = [],
  isSimplePayroll = false,
}: EmploymentTabProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const showCompensation = ADMIN_ROLES.includes(viewerRole) || employee.compensationAmountCents !== undefined

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Employment Details</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Department" htmlFor="departmentId">
                <select
                  id="departmentId"
                  name="departmentId"
                  defaultValue={employee.department?.id ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Job Title" htmlFor="jobTitleId">
                <select
                  id="jobTitleId"
                  name="jobTitleId"
                  defaultValue={employee.jobTitle?.id ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">No job title</option>
                  {jobTitles.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Employment Type" htmlFor="employmentTypeId">
                <select
                  id="employmentTypeId"
                  name="employmentTypeId"
                  defaultValue={employee.employmentType?.id ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">Not specified</option>
                  {employmentTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Location" htmlFor="locationId">
                <select
                  id="locationId"
                  name="locationId"
                  defaultValue={employee.workLocation?.id ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">Not specified</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Start Date" htmlFor="startDate">
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={
                    employee.startDate
                      ? new Date(employee.startDate).toISOString().split('T')[0]
                      : ''
                  }
                />
              </FormField>
              <FormField label="Manager" htmlFor="managerId">
                <select
                  id="managerId"
                  name="managerId"
                  defaultValue={employee.manager?.id ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">No manager</option>
                  {managers.filter((m) => m.id !== employee.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </FormField>
              {!isSimplePayroll && (
              <FormField label="Shift Template" htmlFor="shiftTemplateId">
                <select
                  id="shiftTemplateId"
                  name="shiftTemplateId"
                  defaultValue={employee.shiftTemplate?.id ?? ''}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="">No shift template</option>
                  {shiftTemplates.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </FormField>
              )}
              {!isSimplePayroll && (
              <FormField label="Pay Type" htmlFor="payType">
                <select
                  id="payType"
                  name="payType"
                  defaultValue={employee.payType ?? 'SALARIED'}
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text"
                >
                  <option value="SALARIED">Salaried</option>
                  <option value="HOURLY">Hourly</option>
                </select>
              </FormField>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compensation */}
        {showCompensation && (
          <Card>
            <CardHeader>
              <CardTitle>Compensation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Salary (cents)" htmlFor="compensationAmountCents" hint="Enter amount in cents">
                  <Input
                    id="compensationAmountCents"
                    name="compensationAmountCents"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={employee.compensationAmountCents ?? ''}
                  />
                </FormField>
                <FormField label="Currency" htmlFor="compensationCurrency">
                  <Input
                    id="compensationCurrency"
                    name="compensationCurrency"
                    placeholder="USD"
                    maxLength={3}
                    defaultValue={employee.compensationCurrency ?? ''}
                  />
                </FormField>
              </div>

              {!isSimplePayroll && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="hidden" name="isWorkman" value="false" />
                <input
                  type="checkbox"
                  name="isWorkman"
                  value="true"
                  defaultChecked={employee.isWorkman ?? false}
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
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>Save Changes</Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
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
            {!isSimplePayroll && <Field label="Shift Template" value={employee.shiftTemplate?.name} />}
            {!isSimplePayroll && <Field label="Pay Type" value={formatPayType(employee.payType)} />}
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
              <Field
                label="Workman (MOM Part IV)"
                value={employee.isWorkman ? 'Yes' : 'No'}
              />
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
