'use client'

import { CHART_COLORS } from '@/core/ui/charts/palette'

interface HoursMiniBarsProps {
  regular: number
  overtime: number
}

/**
 * Compact regular-vs-overtime comparison for tight spaces (review form,
 * profile metrics card). Plain divs instead of a recharts BarChart —
 * a single stacked bar with an auto-generated axis reads badly at this size.
 */
export function HoursMiniBars({ regular, overtime }: HoursMiniBarsProps) {
  const max = Math.max(regular, overtime, 1)

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="text-[10px] text-text-muted">Hours</p>
      <MiniBarRow label="Regular" value={regular} max={max} color={CHART_COLORS[0]} />
      <MiniBarRow label="OT" value={overtime} max={max} color={CHART_COLORS[1]} />
    </div>
  )
}

function MiniBarRow({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] text-text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-text">{value}h</span>
    </div>
  )
}
