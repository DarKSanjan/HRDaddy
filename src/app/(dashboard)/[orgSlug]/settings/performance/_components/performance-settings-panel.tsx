'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { togglePerformanceReviewComplexity } from '@/modules/performance/settings-actions'
import type { ReviewComplexity } from '@/modules/performance/settings'

interface PerformanceSettingsPanelProps {
  orgSlug: string
  currentComplexity: ReviewComplexity
}

export function PerformanceSettingsPanel({ orgSlug, currentComplexity }: PerformanceSettingsPanelProps) {
  const router = useRouter()
  const [complexity, setComplexity] = useState<ReviewComplexity>(currentComplexity)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdvanced = complexity === 'advanced'

  const handleToggle = async () => {
    const newValue: ReviewComplexity = isAdvanced ? 'simple' : 'advanced'
    setSaving(true)
    setError(null)

    const result = await togglePerformanceReviewComplexity(orgSlug, newValue)
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
        <CardTitle>Review Mode</CardTitle>
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
                  aria-label="Toggle advanced review mode"
                />
                <div className="peer h-5 w-9 rounded-full bg-surface-hover after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-accent-200" />
              </label>
              <span className="text-[13px] font-medium text-text">
                Advanced mode (per-competency scoring)
              </span>
            </div>
            <p className="mt-2 text-[12px] text-text-muted leading-relaxed">
              In advanced mode, reviewers score each of 6 competencies (1–5) and the overall rating is computed as the rounded average. In simple mode, reviewers give one overall rating plus free-text feedback.
            </p>
            {!isAdvanced && (
              <p className="mt-1 text-[11px] text-accent-600">
                Simple mode active — reviewers provide a single overall score (1–5) and comments.
              </p>
            )}
            {isAdvanced && (
              <p className="mt-1 text-[11px] text-accent-600">
                Advanced mode active — reviewers score Job Knowledge, Quality of Work, Communication, Teamwork, Initiative, and Reliability separately.
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
