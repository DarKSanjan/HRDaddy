'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/core/ui'
import { completeStep3 } from '../actions'
import type { Step3Data, WizardData } from '../schemas'

// Module descriptions — this is where we explain the product
const MODULE_CARDS: {
  id: string
  name: string
  description: string
  icon: string
  locked?: boolean
}[] = [
  {
    id: 'employees',
    name: 'Employees',
    description: 'Your team directory — profiles, departments, job titles, and org structure all in one place.',
    icon: '👥',
    locked: true,
  },
  {
    id: 'leave',
    name: 'Leave',
    description: 'Requests, approvals, and balances. Singapore-compliant statutory types built in.',
    icon: '🏖️',
  },
  {
    id: 'attendance',
    name: 'Attendance',
    description: 'Clock in/out with one tap. Timesheets auto-generate for payroll.',
    icon: '⏱️',
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    description: 'Checklists that guide new hires from day one — no one falls through the cracks.',
    icon: '🚀',
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Secure, categorised storage for contracts, IDs, and certificates.',
    icon: '📄',
  },
  {
    id: 'payroll',
    name: 'Payroll',
    description: 'CPF-ready payroll processing with compliant payslips generated automatically.',
    icon: '💰',
  },
]

interface Step3Props {
  defaultValues?: Step3Data
  onNext: () => void
  onBack: () => void
  onSave: (data: Partial<WizardData>) => void
}

export function Step3ModuleSelection({
  defaultValues,
  onNext,
  onBack,
  onSave,
}: Step3Props) {
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>(
    defaultValues?.modules ?? ['employees']
  )
  const [error, setError] = useState<string | null>(null)

  function toggleModule(id: string) {
    if (id === 'employees') return // locked
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('modules', JSON.stringify(selected))

      const result = await completeStep3(fd)
      if (result.success) {
        onSave({ step3: { modules: selected } })
        onNext()
      } else {
        setError(result.error ?? 'Validation failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-text">
          Choose your modules
        </h2>
        <p className="mt-1 text-[14px] text-text-muted">
          Start with what you need. You can enable more modules anytime from settings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODULE_CARDS.map((mod) => {
          const isSelected = selected.includes(mod.id)
          const isLocked = mod.locked

          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggleModule(mod.id)}
              disabled={isLocked}
              aria-pressed={isSelected}
              aria-label={`${mod.name}${isLocked ? ' (always enabled)' : ''}`}
              className={`group relative flex flex-col rounded-[var(--radius-md)] border p-4 text-left transition-all ${
                isSelected
                  ? 'border-accent-500 bg-accent-50/50'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover'
              } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {/* Selection indicator */}
              <div className="absolute right-3 top-3">
                {isSelected ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-border group-hover:border-border-strong" />
                )}
              </div>

              {/* Icon + content */}
              <span className="text-[20px]" aria-hidden="true">
                {mod.icon}
              </span>
              <h3 className="mt-2 text-[14px] font-semibold text-text">
                {mod.name}
                {isLocked && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-text-subtle">
                    Always on
                  </span>
                )}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
                {mod.description}
              </p>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <Button onClick={handleSubmit} loading={isPending} disabled={isPending}>
          Continue
        </Button>
      </div>
    </div>
  )
}
