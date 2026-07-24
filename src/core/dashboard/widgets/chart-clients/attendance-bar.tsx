'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, BarChart } from '@/core/ui/charts'
import type { WeekdayAttendance } from '@/core/dashboard/chart-queries'

interface Props {
  data: WeekdayAttendance[]
}

/**
 * Attendance this week — stacked bar per day.
 * Segments: present / remote / on leave / absent.
 * Fixed colour assignment by identity, not rank.
 */
export function AttendanceStackedBar({ data }: Props) {
  const hasData = data.some((d) => d.present + d.remote + d.onLeave + d.absent > 0)

  if (!hasData) {
    return (
      <ChartCard title="Attendance This Week">
        <ChartEmpty message="No attendance data this week yet." />
      </ChartCard>
    )
  }

  const chartData = data as unknown as Record<string, unknown>[]

  return (
    <ChartCard title="Attendance This Week">
      <BarChart
        data={chartData}
        xKey="day"
        series={[
          { dataKey: 'present', name: 'Present', colorIndex: 0 },
          { dataKey: 'remote', name: 'Remote', colorIndex: 1 },
          { dataKey: 'onLeave', name: 'On Leave', colorIndex: 3 },
          { dataKey: 'absent', name: 'Absent', colorIndex: 2 },
        ]}
        stacked
        height={200}
      />
    </ChartCard>
  )
}
