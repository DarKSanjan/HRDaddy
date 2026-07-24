'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import { Button, Input, FormField } from '@/core/ui'
import { completeStep2, checkSlugAvailability } from '../actions'
import {
  COMPANY_SIZES,
  INDUSTRIES,
  WORKING_DAYS,
  type Step2Data,
  type WizardData,
} from '../schemas'

interface Step2Props {
  defaultValues?: Step2Data
  onNext: () => void
  onBack: () => void
  onSave: (data: Partial<WizardData>) => void
}

export function Step2CompanyProfile({
  defaultValues,
  onNext,
  onBack,
  onSave,
}: Step2Props) {
  const [isPending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [slugMessage, setSlugMessage] = useState('')
  const slugCheckTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  const [formValues, setFormValues] = useState({
    legalName: defaultValues?.legalName ?? '',
    slug: defaultValues?.slug ?? '',
    companySize: defaultValues?.companySize ?? '1-10',
    industry: defaultValues?.industry ?? 'Technology',
    country: defaultValues?.country ?? 'Singapore',
    timezone: defaultValues?.timezone ?? 'Asia/Singapore',
    currency: defaultValues?.currency ?? 'SGD',
    leaveYearStart: defaultValues?.leaveYearStart ?? '01-01',
    workingDays: defaultValues?.workingDays ?? [1, 2, 3, 4, 5],
    workingHoursStart: defaultValues?.workingHoursStart ?? '09:00',
    workingHoursEnd: defaultValues?.workingHoursEnd ?? '18:00',
  })

  // Auto-generate slug from company name
  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
  }, [])

  // Debounced slug availability check
  const checkSlug = useCallback((slug: string) => {
    if (slugCheckTimeout.current) {
      clearTimeout(slugCheckTimeout.current)
    }

    if (slug.length < 3) {
      setSlugStatus('idle')
      setSlugMessage('')
      return
    }

    setSlugStatus('checking')
    slugCheckTimeout.current = setTimeout(async () => {
      const result = await checkSlugAvailability(slug)
      if (result.available) {
        setSlugStatus('available')
        setSlugMessage('Available')
      } else {
        setSlugStatus('taken')
        setSlugMessage(result.reason ?? 'Unavailable')
      }
    }, 400)
  }, [])

  // When name changes, auto-update slug if user hasn't manually edited it
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!defaultValues?.slug)

  function handleNameChange(name: string) {
    setFormValues((prev) => {
      const patch: typeof prev = { ...prev, legalName: name }
      if (!slugManuallyEdited) {
        const newSlug = generateSlug(name)
        patch.slug = newSlug
        if (newSlug.length >= 3) {
          checkSlug(newSlug)
        }
      }
      return patch
    })
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true)
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setFormValues((prev) => ({ ...prev, slug: sanitized }))
    checkSlug(sanitized)
  }

  function toggleWorkingDay(day: number) {
    setFormValues((prev) => {
      const days = prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort()
      return { ...prev, workingDays: days }
    })
  }

  function handleSubmit() {
    setFieldErrors({})
    startTransition(async () => {
      const fd = new FormData()
      fd.set('legalName', formValues.legalName)
      fd.set('slug', formValues.slug)
      fd.set('companySize', formValues.companySize)
      fd.set('industry', formValues.industry)
      fd.set('country', formValues.country)
      fd.set('timezone', formValues.timezone)
      fd.set('currency', formValues.currency)
      fd.set('leaveYearStart', formValues.leaveYearStart)
      fd.set('workingDays', JSON.stringify(formValues.workingDays))
      fd.set('workingHoursStart', formValues.workingHoursStart)
      fd.set('workingHoursEnd', formValues.workingHoursEnd)

      const result = await completeStep2(fd)
      if (result.success) {
        onSave({ step2: formValues as Step2Data })
        onNext()
      } else {
        setFieldErrors(result.fieldErrors ?? {})
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-text">
          Company profile
        </h2>
        <p className="mt-1 text-[14px] text-text-muted">
          Tell us about your organisation. You can change these later.
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          label="Company name"
          htmlFor="legalName"
          required
          error={fieldErrors.legalName?.[0]}
        >
          <Input
            id="legalName"
            value={formValues.legalName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Acme Pte Ltd"
          />
        </FormField>

        <FormField
          label="URL slug"
          htmlFor="slug"
          required
          hint={
            slugStatus === 'checking'
              ? 'Checking...'
              : slugStatus === 'available'
                ? '✓ ' + slugMessage
                : slugStatus === 'taken'
                  ? undefined
                  : 'app.hrdaddy.co/your-slug'
          }
          error={
            fieldErrors.slug?.[0] ??
            (slugStatus === 'taken' ? slugMessage : undefined)
          }
        >
          <Input
            id="slug"
            value={formValues.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="acme-pte-ltd"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Company size"
            htmlFor="companySize"
            error={fieldErrors.companySize?.[0]}
          >
            <select
              id="companySize"
              className="flex h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[14px] text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              value={formValues.companySize}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, companySize: e.target.value as typeof formValues.companySize }))
              }
            >
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} employees
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Industry"
            htmlFor="industry"
            error={fieldErrors.industry?.[0]}
          >
            <select
              id="industry"
              className="flex h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[14px] text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              value={formValues.industry}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, industry: e.target.value as typeof formValues.industry }))
              }
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Working hours start"
            htmlFor="workingHoursStart"
            error={fieldErrors.workingHoursStart?.[0]}
          >
            <Input
              id="workingHoursStart"
              type="time"
              value={formValues.workingHoursStart}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, workingHoursStart: e.target.value }))
              }
            />
          </FormField>

          <FormField
            label="Working hours end"
            htmlFor="workingHoursEnd"
            error={fieldErrors.workingHoursEnd?.[0]}
          >
            <Input
              id="workingHoursEnd"
              type="time"
              value={formValues.workingHoursEnd}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, workingHoursEnd: e.target.value }))
              }
            />
          </FormField>
        </div>

        <FormField
          label="Working days"
          htmlFor="workingDays"
          error={fieldErrors.workingDays?.[0]}
        >
          <div className="flex flex-wrap gap-2" id="workingDays" role="group" aria-label="Working days">
            {WORKING_DAYS.map((day) => {
              const selected = formValues.workingDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWorkingDay(day.value)}
                  className={`rounded-[var(--radius-xs)] border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    selected
                      ? 'border-accent-500 bg-accent-50 text-accent-700'
                      : 'border-border bg-surface text-text-muted hover:bg-surface-hover'
                  }`}
                  aria-pressed={selected}
                >
                  {day.label.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </FormField>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          loading={isPending}
          disabled={isPending || slugStatus === 'taken' || slugStatus === 'checking'}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
