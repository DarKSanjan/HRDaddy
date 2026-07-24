'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, FormField, Input } from '@/core/ui'
import { submitLeaveRequest } from '@/modules/leave/actions'
import type { ActionResult } from '@/modules/leave/actions'

interface LeaveType {
  id: string
  name: string
  color: string
}

interface LeaveRequestFormProps {
  orgSlug: string
  leaveTypes: LeaveType[]
}

const initialState: ActionResult = { success: false }

export function LeaveRequestForm({ orgSlug, leaveTypes }: LeaveRequestFormProps) {
  const router = useRouter()

  const [state, action, isPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const result = await submitLeaveRequest(orgSlug, formData)
      if (result.success) {
        router.push(`/${orgSlug}/leave`)
      }
      return result
    },
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Leave Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error && (
            <div className="rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger">
              {state.error}
            </div>
          )}

          <FormField label="Leave Type" htmlFor="leaveTypeId" error={state.fieldErrors?.leaveTypeId}>
            <select
              id="leaveTypeId"
              name="leaveTypeId"
              required
              className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" htmlFor="startDate" error={state.fieldErrors?.startDate}>
              <Input id="startDate" type="date" name="startDate" required />
            </FormField>
            <FormField label="End Date" htmlFor="endDate" error={state.fieldErrors?.endDate}>
              <Input id="endDate" type="date" name="endDate" required />
            </FormField>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-text">
              <input type="checkbox" name="isHalfDay" value="true" className="rounded" />
              Half day
            </label>
            <select
              name="halfDayPeriod"
              className="h-8 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-[12px] text-text"
            >
              <option value="AM">Morning (AM)</option>
              <option value="PM">Afternoon (PM)</option>
            </select>
          </div>

          <FormField label="Reason (optional)" htmlFor="reason" error={state.fieldErrors?.reason}>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Optional reason for your leave..."
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
