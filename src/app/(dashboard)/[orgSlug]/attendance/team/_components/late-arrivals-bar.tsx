'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, BarChart } from '@/core/ui/charts'
import type { EmployeeAttendanceOverview } from '@/modules/attendance/queries'

interface Props {
  employees: EmployeeAttendanceOverview[]
}

/**
 * Late arrivals ranking — horizontal bar showing who has the most late days this month.
 * Only shows employees with at least 1 late day, capped at top 8 for readability.
 */
export function LateArrivalsBar({ employees }: Props) {
  const lateEmployees = employees
    .filter((e) => e.lateCount > 0)
    .sort((a, b) => b.lateCount - a.lateCount)
    .slice(0, 8)
    .map((e) => ({
      employee: `${e.firstName} ${e.lastName[0]}.`,
      lateDays: e.lateCount,
    }))

  if (lateEmployees.length === 0) {
    return (
      <ChartCard title="Late Arrivals">
        <ChartEmpty message="No late arrivals this month." />
      </ChartCard>
    )
  }

  const chartData = lateEmployees as unknown as Record<string, unknown>[]

  return (
    <ChartCard title="Late Arrivals This Month">
      <BarChart
        data={chartData}
        xKey="employee"
        series={[{ dataKey: 'lateDays', name: 'Late Days', colorIndex: 3 }]}
        layout="vertical"
        height={Math.max(160, lateEmployees.length * 36)}
        showLegend={false}
      />
    </ChartCard>
  )
}
