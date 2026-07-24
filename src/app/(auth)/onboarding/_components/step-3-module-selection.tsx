'use client'

import { useState, useTransition } from 'react'
import {
  Users,
  CalendarDays,
  Clock,
  ClipboardList,
  FileText,
  CreditCard,
  Check,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/core/ui'
import { completeStep3 } from '../actions'
import type { Step3Data, WizardData } from '../schemas'

// Module descriptions — this is where we explain the product
const MODULE_CARDS: {
  id: string
  name: string
  description: string
  benefits: string[]
  icon: LucideIcon
  locked?: boolean
}[] = [
  {
    id: 'employees',
    name: 'Employees',
    description: 'Your team directory — profiles, departments, job titles, and org structure all in one place.',
    benefits: ['People directory', 'Org chart', 'Job history'],
    icon: Users,
    locked: true,
  },
  {
    id: 'leave',
    name: 'Leave',
    description: 'Requests, approvals, and balances. Singapore-compliant statutory types built in.',
    benefits: ['Leave requests & approvals', 'Balance tracking', 'Statutory types'],
    icon: CalendarDays,
  },
  {
    id: 'attendance',
    name: 'Attendance',
    description: 'Clock in/out with one tap. Timesheets auto-generate for payroll.',
    benefits: ['Clock in/out', 'Timesheet generation', 'Overtime tracking'],
    icon: Clock,
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    description: 'Checklists that guide new hires from day one — no one falls through the cracks.',
    benefits: ['Task checklists', 'Progress tracking', 'Template library'],
    icon: ClipboardList,
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Secure, categorised storage for contracts, IDs, and certificates.',
    benefits: ['Secure storage', 'Categories & tags', 'Expiry alerts'],
    icon: FileText,
  },
  {
    id: 'payroll',
    name: 'Payroll',
    description: 'CPF-ready payroll processing with compliant payslips generated automatically.',
    benefits: ['CPF calculation', 'Compliant payslips', 'Salary history'],
    icon: CreditCard,
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
  const [justSelected, setJustSelected] = useState<string | null>(null)

  function toggleModule(id: string) {
    if (id === 'employees') return // locked
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
      if (!prev.includes(id)) {
        setJustSelected(id)
        setTimeout(() => setJustSelected(null), 200)
      }
      return next
    })
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
          const Icon = mod.icon

          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggleModule(mod.id)}
              disabled={isLocked}
              aria-pressed={isSelected}
              aria-label={`${mod.name}${isLocked ? ' (always enabled)' : ''}`}
              className={cn(
                'group relative flex flex-col rounded-[var(--radius-md)] border p-4 text-left transition-all duration-150',
                isSelected
                  ? 'border-accent-500 bg-accent-50/50'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
                isLocked ? 'cursor-default' : 'cursor-pointer',
                justSelected === mod.id && 'module-card-pop',
              )}
            >
              {/* Selection indicator */}
              <div className="absolute right-3 top-3">
                {isSelected ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500">
                    <Check
                      className="h-3 w-3 text-white"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-border group-hover:border-border-strong" />
                )}
              </div>

              {/* Icon */}
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors',
                isSelected ? 'bg-accent-100 text-accent-700' : 'bg-surface-hover text-text-muted',
              )}>
                {isLocked ? (
                  <Lock className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </div>

              {/* Content */}
              <h3 className="mt-3 text-[14px] font-semibold text-text">
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

              {/* Benefit list */}
              <ul className="mt-2 space-y-0.5">
                {mod.benefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-center gap-1.5 text-[11px] text-text-subtle"
                  >
                    <Check className="h-3 w-3 shrink-0 text-accent-500" strokeWidth={2.5} aria-hidden="true" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-[13px] text-danger" role="alert" id="step3-error" aria-live="assertive">
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
