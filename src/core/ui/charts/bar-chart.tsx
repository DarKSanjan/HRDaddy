'use client'

import * as React from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, CHART_MARGIN, formatChartNumber } from './palette'

export interface BarChartSeries {
  dataKey: string
  name: string
  colorIndex?: number
}

export interface BarChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: BarChartSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  stacked?: boolean
  layout?: 'vertical' | 'horizontal'
  xAxisFormatter?: (value: string) => string
  yAxisFormatter?: (value: number) => string
}

/**
 * BarChart — grouped or stacked. 4px rounded on data end, 2px gap between stacked.
 */
export function BarChart({
  data,
  xKey,
  series,
  height = 240,
  showGrid = true,
  showLegend,
  stacked = false,
  layout = 'horizontal',
  xAxisFormatter,
  yAxisFormatter = formatChartNumber,
}: BarChartProps) {
  const shouldShowLegend = showLegend ?? series.length >= 2
  const barGap = stacked ? 0 : 4
  const barCategoryGap = '20%'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={CHART_MARGIN}
        layout={layout}
        barGap={barGap}
        barCategoryGap={barCategoryGap}
      >
        {showGrid && (
          <CartesianGrid
            vertical={layout === 'vertical'}
            horizontal={layout === 'horizontal'}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
        )}
        {layout === 'horizontal' ? (
          <>
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
          </>
        ) : (
          <>
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={yAxisFormatter}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              width={80}
              tickFormatter={xAxisFormatter}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: 'var(--text)',
          }}
          cursor={{ fill: 'var(--surface-hover)' }}
        />
        {shouldShowLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            fill={CHART_COLORS[s.colorIndex ?? i]}
            stackId={stacked ? 'stack' : undefined}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
