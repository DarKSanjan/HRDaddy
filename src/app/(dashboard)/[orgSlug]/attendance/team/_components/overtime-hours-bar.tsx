'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, BarChart } from '@/core/ui/charts'
import type { EmployeeAttendanceOverview } from '@/modules/attendance/queries'

interface Props {
  employees: EmployeeAttendanceOverview[]
}

/**
 * Overtime hours by employee — horizontal bar showing top overtime contributors.
 * Only shows employees with at least 1 overtime day, capped at top 8.
 */
export function OvertimeHoursBar({ employees }: Props) {
  const overtimeEmployees = employees
    .filter((e) => e.overtimeCount > 0)
    .sort((a, b) => b.overtimeCount - a.overtimeCount)
    .slice(0, 8)
    .map((e) => ({
      employee: `${e.firstName} ${e.lastName[0]}.`,
      overtimeDays: e.overtimeCount,
    }))

  if (overtimeEmployees.length === 0) {
    return (
      <ChartCard title="Overtime">
        <ChartEmpty message="No overtime recorded this month." />
      </ChartCard>
    )
  }

  const chartData = overtimeEmployees as unknown as Record<string, unknown>[]

  return (
    <ChartCard title="Overtime Days This Month">
      <BarChart
        data={chartData}
        xKey="employee"
        series={[{ dataKey: 'overtimeDays', name: 'Overtime Days', colorIndex: 1 }]}
        layout="vertical"
        height={Math.max(160, overtimeEmployees.length * 36)}
        showLegend={false}
      />
    </ChartCard>
  )
}
