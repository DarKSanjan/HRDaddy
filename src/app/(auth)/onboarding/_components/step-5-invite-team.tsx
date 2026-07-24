'use client'

import { useState, useTransition } from 'react'
import { Button, Input } from '@/core/ui'
import { completeStep5 } from '../actions'
import type { Step5Data, WizardData } from '../schemas'

const ROLES = [
  { value: 'HR_ADMIN', label: 'HR Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
] as const

interface Step5Props {
  defaultValues?: Step5Data
  onBack: () => void
  onSave: (data: Partial<WizardData>) => void
}

export function Step5InviteTeam({ defaultValues, onBack, onSave }: Step5Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<
    { email: string; role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE' }[]
  >(defaultValues?.invitations ?? [])

  function addInvitation() {
    setInvitations((prev) => [...prev, { email: '', role: 'EMPLOYEE' }])
  }

  function removeInvitation(index: number) {
    setInvitations((prev) => prev.filter((_, i) => i !== index))
  }

  function updateInvitation(
    index: number,
    field: 'email' | 'role',
    value: string
  ) {
    setInvitations((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, [field]: value } : inv))
    )
  }

  function handleSubmit(skip: boolean) {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set(
        'invitations',
        JSON.stringify(
          skip ? [] : invitations.filter((inv) => inv.email.trim())
        )
      )
      fd.set('skip', String(skip))

      onSave({
        step5: {
          invitations: skip ? [] : invitations.filter((inv) => inv.email.trim()),
          skip,
        },
      })

      const result = await completeStep5(fd)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
      }
      // On success, the action redirects — no need to handle here
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-text">
          Invite your team
        </h2>
        <p className="mt-1 text-[14px] text-text-muted">
          Add colleagues now, or skip and invite them later from settings.
        </p>
      </div>

      <div className="space-y-3">
        {invitations.map((inv, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="email"
              value={inv.email}
              onChange={(e) => updateInvitation(i, 'email', e.target.value)}
              placeholder="colleague@company.com"
              aria-label={`Invitation ${i + 1} email`}
              className="flex-1"
            />
            <select
              value={inv.role}
              onChange={(e) => updateInvitation(i, 'role', e.target.value)}
              aria-label={`Invitation ${i + 1} role`}
              className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-[13px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeInvitation(i)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-subtle hover:bg-surface-hover hover:text-danger"
              aria-label={`Remove invitation ${inv.email || i + 1}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <Button variant="secondary" size="sm" onClick={addInvitation} type="button">
          + Add team member
        </Button>
      </div>

      {invitations.length === 0 && (
        <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle p-6 text-center">
          <p className="text-[13px] text-text-muted">
            No invitations yet. You can always invite people later.
          </p>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => handleSubmit(true)}
            loading={isPending}
            disabled={isPending}
          >
            Skip for now
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            loading={isPending}
            disabled={isPending || invitations.filter((i) => i.email.trim()).length === 0}
          >
            Create organisation
          </Button>
        </div>
      </div>
    </div>
  )
}
