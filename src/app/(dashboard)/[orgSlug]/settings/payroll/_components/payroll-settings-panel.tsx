'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { togglePayrollComplexity } from '@/modules/payroll/settings-actions'
import type { PayrollComplexity } from '@/modules/payroll/settings'

interface PayrollSettingsPanelProps {
  orgSlug: string
  currentComplexity: PayrollComplexity
}

export function PayrollSettingsPanel({ orgSlug, currentComplexity }: PayrollSettingsPanelProps) {
  const router = useRouter()
  const [complexity, setComplexity] = useState<PayrollComplexity>(currentComplexity)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdvanced = complexity === 'advanced'

  const handleToggle = async () => {
    const newValue: PayrollComplexity = isAdvanced ? 'simple' : 'advanced'
    setSaving(true)
    setError(null)

    const result = await togglePayrollComplexity(orgSlug, newValue)
    if (result.success) {
      setComplexity(newValue)
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to update setting.')
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Mode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isAdvanced}
                  onChange={handleToggle}
                  disabled={saving}
                  aria-label="Toggle advanced payroll mode"
                />
                <div className="peer h-5 w-9 rounded-full bg-surface-hover after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-accent-200" />
              </label>
              <span className="text-[13px] font-medium text-text">
                Advanced payroll (shift templates, overtime, hourly rates)
              </span>
            </div>
            <p className="mt-2 text-[12px] text-text-muted leading-relaxed">
              Turn off for a simple fixed-hours payroll. Your existing shift and rate data is kept and restored if you turn this back on.
            </p>
            {!isAdvanced && (
              <p className="mt-1 text-[11px] text-accent-600">
                Simple mode active — all employees are treated as salaried with standard hours. Overtime is not computed.
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-[12px] text-danger">{error}</p>
        )}

        {saving && (
          <p className="text-[12px] text-text-muted">Saving…</p>
        )}
      </CardContent>
    </Card>
  )
}
