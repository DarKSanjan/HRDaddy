'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, BarChart } from '@/core/ui/charts'
import type { DepartmentCount } from '@/core/dashboard/chart-queries'

interface Props {
  data: DepartmentCount[]
}

/**
 * Headcount by department — horizontal bar, sorted descending.
 * Categorical colour by identity (fixed order), never cycled.
 */
export function DepartmentBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <ChartCard title="Headcount by Department">
        <ChartEmpty message="No departments with active employees." />
      </ChartCard>
    )
  }

  const chartData = data as unknown as Record<string, unknown>[]

  return (
    <ChartCard title="Headcount by Department">
      <BarChart
        data={chartData}
        xKey="department"
        series={[{ dataKey: 'count', name: 'Employees', colorIndex: 0 }]}
        layout="vertical"
        height={Math.max(160, data.length * 36)}
        showLegend={false}
      />
    </ChartCard>
  )
}
