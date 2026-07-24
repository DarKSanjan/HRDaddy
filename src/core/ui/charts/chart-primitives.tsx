'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Table, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

// ─── ChartCard ──────────────────────────────────────────────────
export interface ChartCardProps {
  title: string
  description?: string
  filterRow?: React.ReactNode
  children: React.ReactNode
  tableView?: React.ReactNode
  className?: string
}

/**
 * ChartCard — wraps a chart with title, optional filter row, and table toggle.
 */
export function ChartCard({
  title,
  description,
  filterRow,
  children,
  tableView,
  className,
}: ChartCardProps) {
  const [showTable, setShowTable] = React.useState(false)

  return (
    <div className={cn('rounded-[var(--radius-md)] border border-border bg-surface', className)}>
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <h3 className="text-[13px] font-semibold text-text">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[11px] text-text-subtle">{description}</p>
          )}
        </div>
        {tableView && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] text-text-subtle transition-colors hover:bg-surface-hover hover:text-text-muted"
            aria-label={showTable ? 'Show chart' : 'Show table'}
            aria-pressed={showTable}
          >
            <Table className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {filterRow && (
        <div className="px-4 pt-2">{filterRow}</div>
      )}
      <div className="p-4">
        {showTable && tableView ? tableView : children}
      </div>
    </div>
  )
}

// ─── ChartEmpty ─────────────────────────────────────────────────
export interface ChartEmptyProps {
  message?: string
}

export function ChartEmpty({ message = 'No data to display' }: ChartEmptyProps) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-[12px] text-text-subtle">{message}</p>
    </div>
  )
}

// ─── ChartSkeleton ──────────────────────────────────────────────
export function ChartSkeleton() {
  return (
    <div className="flex h-[200px] items-end gap-2 px-4 pb-4" aria-hidden="true">
      {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t-[2px] bg-border"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

// ─── ChartError ─────────────────────────────────────────────────
export interface ChartErrorProps {
  message?: string
  onRetry?: () => void
}

export function ChartError({ message = 'Failed to load chart data', onRetry }: ChartErrorProps) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2">
      <p className="text-[12px] text-danger">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[12px] font-medium text-accent-500 hover:text-accent-600"
        >
          Retry
        </button>
      )}
    </div>
  )
}

// ─── StatTile ───────────────────────────────────────────────────
export interface StatTileProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  sparkline?: React.ReactNode
  className?: string
}

/**
 * StatTile — label, big number, optional delta with direction, optional sparkline.
 * Sometimes the right answer is not a chart.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  sparkline,
  className,
}: StatTileProps) {
  const deltaIcon = delta === undefined ? null
    : delta > 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    : delta < 0 ? <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
    : <Minus className="h-3 w-3" aria-hidden="true" />

  const deltaColor = delta === undefined ? ''
    : delta > 0 ? 'text-success'
    : delta < 0 ? 'text-danger'
    : 'text-text-subtle'

  return (
    <div className={cn('rounded-[var(--radius-md)] border border-border bg-surface p-4', className)}>
      <p className="text-[11px] font-medium text-text-subtle">{label}</p>
      <div className="mt-1 flex items-end gap-3">
        <span className="text-[24px] font-semibold leading-none text-text tabular-nums">
          {value}
        </span>
        {sparkline && <div className="mb-0.5 flex-1">{sparkline}</div>}
      </div>
      {delta !== undefined && (
        <div className={cn('mt-1.5 flex items-center gap-0.5 text-[11px] font-medium', deltaColor)}>
          {deltaIcon}
          <span className="tabular-nums">{Math.abs(delta)}%</span>
          {deltaLabel && (
            <span className="ml-1 text-text-subtle font-normal">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
