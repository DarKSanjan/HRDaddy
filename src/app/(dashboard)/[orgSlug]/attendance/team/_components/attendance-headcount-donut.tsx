'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, DonutChart } from '@/core/ui/charts'
import type { EmployeeAttendanceOverview } from '@/modules/attendance/queries'

interface Props {
  employees: EmployeeAttendanceOverview[]
  totalEmployees: number
}

/**
 * Present vs Absent headcount donut for the month overview.
 * "Present" = employees who have at least 1 day present.
 * "Absent" = employees with 0 days present (no attendance recorded).
 */
export function AttendanceHeadcountDonut({ employees, totalEmployees }: Props) {
  const presentCount = employees.filter((e) => e.daysPresent > 0).length
  const absentCount = totalEmployees - presentCount

  const data = [
    { name: 'Present', value: presentCount, colorIndex: 0 },
    { name: 'No Attendance', value: absentCount, colorIndex: 3 },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return (
      <ChartCard title="Attendance Headcount">
        <ChartEmpty message="No employee data this month." />
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Attendance Headcount">
      <DonutChart
        data={data}
        height={200}
        label="Employees"
        labelValue={totalEmployees}
      />
    </ChartCard>
  )
}
