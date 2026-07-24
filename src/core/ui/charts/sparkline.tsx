'use client'

import * as React from 'react'
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from './palette'

export interface SparklineProps {
  data: number[]
  height?: number
  width?: number | string
  colorIndex?: number
  /** Whether positive slope is green and negative is red */
  statusColored?: boolean
}

/**
 * Sparkline — minimal inline chart, no axes, no tooltip.
 * Used inside StatTile and table cells.
 */
export function Sparkline({
  data,
  height = 32,
  width = '100%',
  colorIndex = 0,
  statusColored = false,
}: SparklineProps) {
  const chartData = data.map((value, i) => ({ value, i }))

  let strokeColor: string = CHART_COLORS[colorIndex]
  if (statusColored && data.length >= 2) {
    const trend = data[data.length - 1] - data[0]
    strokeColor = trend > 0 ? 'var(--success)' : trend < 0 ? 'var(--danger)' : 'var(--text-subtle)'
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
