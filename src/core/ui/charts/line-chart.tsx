'use client'

import * as React from 'react'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, CHART_MARGIN, formatChartNumber } from './palette'

export interface LineChartSeries {
  dataKey: string
  name: string
  colorIndex?: number
}

export interface LineChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: LineChartSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  xAxisFormatter?: (value: string) => string
  yAxisFormatter?: (value: number) => string
}

/**
 * LineChart — thin 2px lines, markers >= 8px.
 * Hover crosshair + tooltip is default.
 */
export function LineChart({
  data,
  xKey,
  series,
  height = 240,
  showGrid = true,
  showLegend,
  xAxisFormatter,
  yAxisFormatter = formatChartNumber,
}: LineChartProps) {
  const shouldShowLegend = showLegend ?? series.length >= 2

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={CHART_MARGIN}>
        {showGrid && (
          <CartesianGrid
            vertical={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
        )}
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tickFormatter={xAxisFormatter}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisFormatter}
          width={48}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: 'var(--text)',
          }}
          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
        />
        {shouldShowLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {series.map((s, i) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name}
            stroke={CHART_COLORS[s.colorIndex ?? i]}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLORS[s.colorIndex ?? i] }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
