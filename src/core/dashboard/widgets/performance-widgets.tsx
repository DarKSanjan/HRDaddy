/**
 * Performance module dashboard widgets.
 */
import * as React from 'react'
import { TrendingUp } from 'lucide-react'
import { StatTile, ChartCard } from '@/core/ui/charts'
import type { WidgetProps } from '@/core/dashboard'
import {
  getActiveCycleInfo,
  getMyPendingReviewCount,
} from '@/core/dashboard/widget-queries'

// ─────────────────────────────────────────────
// Performance Cycle Status (admin/manager)
// ─────────────────────────────────────────────

export async function PerformanceCycleStatusWidget(props: WidgetProps) {
  const cycle = await getActiveCycleInfo(props.orgId, props.userId)

  if (!cycle) {
    return (
      <ChartCard title="Performance Cycle">
        <div className="flex items-center gap-3 py-2">
          <TrendingUp className="h-5 w-5 text-text-subtle" aria-hidden="true" />
          <div>
            <p className="text-[13px] text-text">No active cycle</p>
            <p className="text-[11px] text-text-subtle">
              Create a review cycle to get started.
            </p>
          </div>
        </div>
      </ChartCard>
    )
  }

  const progress = cycle.totalReviews > 0
    ? Math.round((cycle.submittedReviews / cycle.totalReviews) * 100)
    : 0

  return (
    <ChartCard title="Performance Cycle">
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-text">{cycle.name}</p>
          <span className="rounded-[var(--radius-xs)] bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            Active
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-text-subtle">
            {cycle.submittedReviews} of {cycle.totalReviews} reviews submitted
          </p>
          <p className="text-[11px] font-medium text-text tabular-nums">{progress}%</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </ChartCard>
  )
}

// ─────────────────────────────────────────────
// My Reviews (employee)
// ─────────────────────────────────────────────

export async function MyReviewsWidget(props: WidgetProps) {
  if (!props.employeeId) {
    return <StatTile label="Pending Reviews" value={0} />
  }

  const count = await getMyPendingReviewCount(
    props.orgId,
    props.userId,
    props.employeeId
  )

  return (
    <StatTile label="Pending Reviews" value={count} />
  )
}
