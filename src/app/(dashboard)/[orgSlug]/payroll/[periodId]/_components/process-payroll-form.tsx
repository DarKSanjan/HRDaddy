'use client'

import { useActionState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/core/ui'
import { processPayroll, type ActionResult } from '@/modules/payroll/actions'

const initialState: ActionResult = { success: false }

export function ProcessPayrollForm({ orgSlug, periodId }: { orgSlug: string; periodId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => processPayroll(orgSlug, formData),
    initialState
  )

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="periodId" value={periodId} />
        <Button type="submit" size="md" loading={isPending}>
          {isPending ? 'Processing Payroll' : 'Process Payroll'}
        </Button>
      </form>

      {state.error && (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-[12px] text-danger" role="alert">
          {state.error}
        </div>
      )}
      {state.warning && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-surface-warning/10 px-3 py-2 text-[12px] text-text-muted" role="alert" aria-live="polite">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p>{state.warning}</p>
        </div>
      )}
    </div>
  )
}
