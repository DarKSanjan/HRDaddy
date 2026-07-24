'use client'

import { useState, useTransition } from 'react'
import { Button, Input } from '@/core/ui'
import { completeStep4 } from '../actions'
import type { Step4Data, WizardData } from '../schemas'

// Singapore statutory defaults
const DEFAULT_DEPARTMENTS = [
  { name: 'Engineering' },
  { name: 'Operations' },
  { name: 'People & Culture' },
  { name: 'Finance' },
]

const DEFAULT_JOB_TITLES = [
  { title: 'Software Engineer' },
  { title: 'Senior Software Engineer' },
  { title: 'Engineering Manager' },
  { title: 'Product Manager' },
  { title: 'Designer' },
  { title: 'HR Manager' },
]

const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', daysPerYear: 14, description: '7-14 days based on years of service (EA s88A)' },
  { name: 'Outpatient Sick Leave', daysPerYear: 14, description: 'Paid sick leave with medical certificate (EA s89)' },
  { name: 'Hospitalisation Leave', daysPerYear: 60, description: 'Includes outpatient sick leave entitlement (EA s89)' },
  { name: 'Maternity Leave', daysPerYear: 112, description: '16 weeks for qualifying mothers (CDCA)' },
  { name: 'Paternity Leave', daysPerYear: 28, description: '4 weeks for qualifying fathers (CDCA)' },
  { name: 'Childcare Leave', daysPerYear: 6, description: '6 days/year per parent, child under 7 (CDCA)' },
]

interface Step4Props {
  defaultValues?: Step4Data
  selectedModules: string[]
  onNext: () => void
  onBack: () => void
  onSave: (data: Partial<WizardData>) => void
}

export function Step4SeedDefaults({
  defaultValues,
  selectedModules,
  onNext,
  onBack,
  onSave,
}: Step4Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [departments, setDepartments] = useState<{ name: string }[]>(
    defaultValues?.departments ?? DEFAULT_DEPARTMENTS
  )
  const [jobTitles, setJobTitles] = useState<{ title: string }[]>(
    defaultValues?.jobTitles ?? DEFAULT_JOB_TITLES
  )
  const [leaveTypes, setLeaveTypes] = useState<
    { name: string; daysPerYear: number; description: string }[]
  >(
    defaultValues?.leaveTypes ??
      DEFAULT_LEAVE_TYPES.map((lt) => ({ ...lt, description: lt.description ?? '' }))
  )

  const showLeave = selectedModules.includes('leave')

  // Departments
  function addDepartment() {
    setDepartments((prev) => [...prev, { name: '' }])
  }
  function removeDepartment(index: number) {
    setDepartments((prev) => prev.filter((_, i) => i !== index))
  }
  function updateDepartment(index: number, name: string) {
    setDepartments((prev) => prev.map((d, i) => (i === index ? { name } : d)))
  }

  // Job titles
  function addJobTitle() {
    setJobTitles((prev) => [...prev, { title: '' }])
  }
  function removeJobTitle(index: number) {
    setJobTitles((prev) => prev.filter((_, i) => i !== index))
  }
  function updateJobTitle(index: number, title: string) {
    setJobTitles((prev) => prev.map((j, i) => (i === index ? { title } : j)))
  }

  // Leave types
  function addLeaveType() {
    setLeaveTypes((prev) => [...prev, { name: '', daysPerYear: 1, description: '' }])
  }
  function removeLeaveType(index: number) {
    setLeaveTypes((prev) => prev.filter((_, i) => i !== index))
  }
  function updateLeaveType(
    index: number,
    field: 'name' | 'daysPerYear' | 'description',
    value: string | number
  ) {
    setLeaveTypes((prev) =>
      prev.map((lt, i) => (i === index ? { ...lt, [field]: value } : lt))
    )
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('departments', JSON.stringify(departments.filter((d) => d.name.trim())))
      fd.set('jobTitles', JSON.stringify(jobTitles.filter((j) => j.title.trim())))
      fd.set(
        'leaveTypes',
        JSON.stringify(leaveTypes.filter((lt) => lt.name.trim()))
      )

      const result = await completeStep4(fd)
      if (result.success) {
        onSave({
          step4: {
            departments: departments.filter((d) => d.name.trim()),
            jobTitles: jobTitles.filter((j) => j.title.trim()),
            leaveTypes: leaveTypes.filter((lt) => lt.name.trim()),
          },
        })
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
          Seed your defaults
        </h2>
        <p className="mt-1 text-[14px] text-text-muted">
          We&rsquo;ve pre-filled common values for Singapore companies. Edit, add, or remove as needed.
        </p>
      </div>

      {/* Departments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-text">Departments</h3>
          <Button variant="ghost" size="sm" onClick={addDepartment} type="button">
            + Add
          </Button>
        </div>
        <div className="space-y-2">
          {departments.map((dept, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={dept.name}
                onChange={(e) => updateDepartment(i, e.target.value)}
                placeholder="Department name"
                aria-label={`Department ${i + 1} name`}
              />
              <button
                type="button"
                onClick={() => removeDepartment(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-subtle hover:bg-surface-hover hover:text-danger"
                aria-label={`Remove department ${dept.name || i + 1}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {departments.length === 0 && (
            <p className="py-3 text-center text-[12px] text-text-subtle">
              No departments yet. Add at least one.
            </p>
          )}
        </div>
      </section>

      {/* Job Titles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-text">Job titles</h3>
          <Button variant="ghost" size="sm" onClick={addJobTitle} type="button">
            + Add
          </Button>
        </div>
        <div className="space-y-2">
          {jobTitles.map((jt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={jt.title}
                onChange={(e) => updateJobTitle(i, e.target.value)}
                placeholder="Job title"
                aria-label={`Job title ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeJobTitle(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-subtle hover:bg-surface-hover hover:text-danger"
                aria-label={`Remove job title ${jt.title || i + 1}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {jobTitles.length === 0 && (
            <p className="py-3 text-center text-[12px] text-text-subtle">
              No job titles yet. Add at least one.
            </p>
          )}
        </div>
      </section>

      {/* Leave Types (only if leave module selected) */}
      {showLeave && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-text">Leave types</h3>
            <Button variant="ghost" size="sm" onClick={addLeaveType} type="button">
              + Add
            </Button>
          </div>
          <p className="text-[12px] text-text-subtle">
            Singapore Employment Act statutory minimums pre-filled.
          </p>
          <div className="space-y-3">
            {leaveTypes.map((lt, i) => (
              <div
                key={i}
                className="rounded-[var(--radius-sm)] border border-border p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={lt.name}
                        onChange={(e) => updateLeaveType(i, 'name', e.target.value)}
                        placeholder="Leave type name"
                        aria-label={`Leave type ${i + 1} name`}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={lt.daysPerYear}
                        onChange={(e) =>
                          updateLeaveType(i, 'daysPerYear', parseInt(e.target.value) || 0)
                        }
                        aria-label={`${lt.name || 'Leave type'} days per year`}
                        className="w-20"
                        min={1}
                      />
                      <span className="flex items-center text-[12px] text-text-subtle">
                        days
                      </span>
                    </div>
                    {lt.description && (
                      <p className="text-[11px] text-text-subtle">
                        {lt.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLeaveType(i)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-subtle hover:bg-surface-hover hover:text-danger"
                    aria-label={`Remove leave type ${lt.name || i + 1}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {leaveTypes.length === 0 && (
              <p className="py-3 text-center text-[12px] text-text-subtle">
                No leave types yet. Add at least one if using the Leave module.
              </p>
            )}
          </div>
        </section>
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
        <Button onClick={handleSubmit} loading={isPending} disabled={isPending}>
          Continue
        </Button>
      </div>
    </div>
  )
}
