'use client'

import * as React from 'react'
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, CHART_MARGIN, formatChartNumber } from './palette'

export interface AreaChartSeries {
  dataKey: string
  name: string
  colorIndex?: number
  stacked?: boolean
}

export interface AreaChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: AreaChartSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  stacked?: boolean
  xAxisFormatter?: (value: string) => string
  yAxisFormatter?: (value: number) => string
}

/**
 * AreaChart — filled areas with opacity gradient.
 */
export function AreaChart({
  data,
  xKey,
  series,
  height = 240,
  showGrid = true,
  showLegend,
  stacked = false,
  xAxisFormatter,
  yAxisFormatter = formatChartNumber,
}: AreaChartProps) {
  const shouldShowLegend = showLegend ?? series.length >= 2

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          {series.map((s, i) => {
            const color = CHART_COLORS[s.colorIndex ?? i]
            return (
              <linearGradient key={s.dataKey} id={`area-grad-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
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
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{value}</span>
            )}
          />
        )}
        {series.map((s, i) => {
          const color = CHART_COLORS[s.colorIndex ?? i]
          return (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={color}
              strokeWidth={2}
              fill={`url(#area-grad-${s.dataKey})`}
              stackId={stacked || s.stacked ? 'stack' : undefined}
              dot={false}
              activeDot={{ r: 4, fill: color }}
              isAnimationActive={false}
            />
          )
        })}
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}
