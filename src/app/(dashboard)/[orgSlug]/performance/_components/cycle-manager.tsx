'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/core/ui'
import { createCycle, openCycle, closeCycle } from '@/modules/performance/actions'
import { suggestNextCycle } from '@/modules/performance/utils'
import { PerformancePdfDownloadButton } from '@/modules/performance/pdf-download-button'
import type { CycleItemBase } from '@/modules/performance/utils'

interface CycleManagerProps {
  orgSlug: string
  cycles: CycleItemBase[]
  canPublish: boolean
}

const STATUS_VARIANTS: Record<string, 'neutral' | 'success' | 'default'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  CLOSED: 'neutral',
}

export function CycleManager({ orgSlug, cycles }: CycleManagerProps) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const suggestion = suggestNextCycle(cycles)

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createCycle(orgSlug, formData)
    if (result.success) {
      setShowCreate(false)
      router.refresh()
    } else {
      setError(result.error ?? 'Failed to create cycle.')
    }
    setCreating(false)
  }

  const handleOpen = async (cycleId: string) => {
    setActionLoading(cycleId)
    const result = await openCycle(orgSlug, cycleId)
    if (!result.success) {
      setError(result.error ?? 'Failed to open cycle.')
    }
    setActionLoading(null)
    router.refresh()
  }

  const handleClose = async (cycleId: string) => {
    setActionLoading(cycleId)
    const result = await closeCycle(orgSlug, cycleId)
    if (!result.success) {
      setError(result.error ?? 'Failed to close cycle.')
    }
    setActionLoading(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Review Cycles</CardTitle>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          aria-label="Start new cycle"
        >
          {showCreate ? 'Cancel' : 'Start New Cycle'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-[12px] text-danger">{error}</p>
        )}

        {showCreate && (
          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <label htmlFor="cycle-name" className="text-[12px] font-medium text-text-muted">
                Cycle Name
              </label>
              <input
                id="cycle-name"
                name="name"
                type="text"
                defaultValue={suggestion.name}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cycle-start" className="text-[12px] font-medium text-text-muted">
                  Start Date
                </label>
                <input
                  id="cycle-start"
                  name="startDate"
                  type="date"
                  defaultValue={toDateInputValue(suggestion.startDate)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="cycle-end" className="text-[12px] font-medium text-text-muted">
                  End Date
                </label>
                <input
                  id="cycle-end"
                  name="endDate"
                  type="date"
                  defaultValue={toDateInputValue(suggestion.endDate)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  required
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? 'Creating…' : 'Create Cycle'}
            </Button>
          </form>
        )}

        {cycles.length === 0 ? (
          <p className="text-[13px] text-text-muted">No review cycles yet.</p>
        ) : (
          <div className="space-y-2">
            {cycles.map((cycle) => (
              <div
                key={cycle.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text">{cycle.name}</span>
                    <Badge variant={STATUS_VARIANTS[cycle.status]}>
                      {cycle.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                    {' · '}
                    {cycle.submittedReviews} of {cycle.totalReviews} submitted
                  </p>
                </div>
                <div className="flex gap-2">
                  {cycle.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpen(cycle.id)}
                      disabled={actionLoading === cycle.id}
                    >
                      Open
                    </Button>
                  )}
                  {cycle.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleClose(cycle.id)}
                      disabled={actionLoading === cycle.id}
                    >
                      Close
                    </Button>
                  )}
                  {(cycle.status === 'ACTIVE' || cycle.status === 'CLOSED') && (
                    <PerformancePdfDownloadButton
                      orgSlug={orgSlug}
                      cycleId={cycle.id}
                      label="PDF"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Format a Date as yyyy-mm-dd for a date input's defaultValue using LOCAL
 * date parts — never toISOString() here, which converts to UTC and shifts
 * the date backward a day whenever the runtime's local offset is ahead of
 * UTC (the same class of bug already hit in attendance's average-start-time
 * calc — see TZDate usage there).
 */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
