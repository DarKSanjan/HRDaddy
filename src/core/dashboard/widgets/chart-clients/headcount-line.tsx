'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, LineChart } from '@/core/ui/charts'
import type { HeadcountMonth } from '@/core/dashboard/chart-queries'

interface Props {
  data: HeadcountMonth[]
}

/**
 * Headcount over 12 months — line chart with joiners/leavers as separate view.
 * Never a dual-axis chart: two separate series at different scales = two charts.
 */
export function HeadcountLineChart({ data }: Props) {
  const [view, setView] = React.useState<'active' | 'movement'>('active')

  const hasData = data.some((d) => d.active > 0 || d.joiners > 0 || d.leavers > 0)
  const chartData = data as unknown as Record<string, unknown>[]

  if (!hasData) {
    return (
      <ChartCard title="Headcount Over Time">
        <ChartEmpty message="No headcount data yet. Add employees to see trends." />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Headcount Over Time"
      filterRow={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('active')}
            className={`rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-medium transition-colors ${
              view === 'active'
                ? 'bg-surface-hover text-text'
                : 'text-text-subtle hover:text-text-muted'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setView('movement')}
            className={`rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-medium transition-colors ${
              view === 'movement'
                ? 'bg-surface-hover text-text'
                : 'text-text-subtle hover:text-text-muted'
            }`}
          >
            Joiners / Leavers
          </button>
        </div>
      }
    >
      {view === 'active' ? (
        <LineChart
          data={chartData}
          xKey="month"
          series={[{ dataKey: 'active', name: 'Active Employees', colorIndex: 0 }]}
          height={200}
        />
      ) : (
        <LineChart
          data={chartData}
          xKey="month"
          series={[
            { dataKey: 'joiners', name: 'Joiners', colorIndex: 0 },
            { dataKey: 'leavers', name: 'Leavers', colorIndex: 2 },
          ]}
          height={200}
        />
      )}
    </ChartCard>
  )
}
