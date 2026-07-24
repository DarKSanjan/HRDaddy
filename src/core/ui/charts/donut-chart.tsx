'use client'

import * as React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from './palette'

export interface DonutChartDataPoint {
  name: string
  value: number
  colorIndex?: number
}

export interface DonutChartProps {
  data: DonutChartDataPoint[]
  height?: number
  showLegend?: boolean
  innerRadius?: number
  outerRadius?: number
  label?: string
  labelValue?: string | number
}

/**
 * DonutChart — hollow centre, can display a summary stat inside.
 */
export function DonutChart({
  data,
  height = 240,
  showLegend = true,
  innerRadius = 60,
  outerRadius = 90,
  label,
  labelValue,
}: DonutChartProps) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={CHART_COLORS[entry.colorIndex ?? i]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--text)',
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }}
              iconType="circle"
              iconSize={8}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {/* Centre label */}
      {label && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {labelValue !== undefined && (
              <p className="text-[20px] font-semibold text-text tabular-nums">{labelValue}</p>
            )}
            <p className="text-[11px] text-text-subtle">{label}</p>
          </div>
        </div>
      )}
    </div>
  )
}
