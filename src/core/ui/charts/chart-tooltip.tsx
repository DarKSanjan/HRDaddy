'use client'

/**
 * Shared custom tooltip content for Recharts charts.
 * Styled consistently with the app's design system.
 */
import * as React from 'react'

interface TooltipPayloadEntry {
  name?: string
  value?: number
  color?: string
  dataKey?: string
}

interface ChartTooltipContentProps {
  /** Whether tooltip is active */
  active?: boolean
  /** Tooltip payload entries from Recharts */
  payload?: TooltipPayloadEntry[]
  /** X-axis label value */
  label?: string | number
  /** Total for percentage computation (used in donut charts) */
  total?: number
  /** Whether to show percentage of total alongside value */
  showPercentage?: boolean
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  total,
  showPercentage,
}: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 shadow-md"
      style={{ minWidth: 120 }}
    >
      {/* Category label (x-axis value for bar charts) */}
      {label && (
        <p className="mb-1.5 text-[11px] font-medium text-text-muted">{label}</p>
      )}

      <div className="space-y-1">
        {payload.map((entry, i) => {
          const value = entry.value ?? 0
          const percentage = total && total > 0
            ? ((value / total) * 100).toFixed(0)
            : null

          return (
            <div key={i} className="flex items-center gap-2">
              {/* Color swatch */}
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              {/* Series name */}
              <span className="text-[11px] text-text-muted">{entry.name}</span>
              {/* Value */}
              <span className="ml-auto text-[12px] font-semibold text-text tabular-nums">
                {typeof value === 'number' ? value.toLocaleString() : value}
                {showPercentage && percentage && (
                  <span className="ml-1 font-normal text-text-muted">({percentage}%)</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
