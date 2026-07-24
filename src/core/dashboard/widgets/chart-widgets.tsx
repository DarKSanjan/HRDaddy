/**
 * Chart widgets for the Owner/HR dashboard.
 */
import * as React from 'react'
import type { WidgetProps } from '@/core/dashboard'
import {
  getHeadcountOverTime,
  getHeadcountByDepartment,
  getAttendanceThisWeek,
  getLeaveUsageByType,
} from '@/core/dashboard/chart-queries'
import { HeadcountLineChart } from './chart-clients/headcount-line'
import { DepartmentBarChart } from './chart-clients/department-bar'
import { AttendanceStackedBar } from './chart-clients/attendance-bar'
import { LeaveDonut } from './chart-clients/leave-donut'

// ─────────────────────────────────────────────
// Headcount Over Time
// ─────────────────────────────────────────────

export async function HeadcountOverTimeWidget(props: WidgetProps) {
  const data = await getHeadcountOverTime(props.orgId, props.userId, props.orgTimezone)
  return <HeadcountLineChart data={data} />
}

// ─────────────────────────────────────────────
// Headcount by Department
// ─────────────────────────────────────────────

export async function HeadcountByDepartmentWidget(props: WidgetProps) {
  const data = await getHeadcountByDepartment(props.orgId, props.userId)
  return <DepartmentBarChart data={data} />
}

// ─────────────────────────────────────────────
// Attendance This Week
// ─────────────────────────────────────────────

export async function AttendanceThisWeekWidget(props: WidgetProps) {
  const data = await getAttendanceThisWeek(props.orgId, props.userId, props.orgTimezone)
  return <AttendanceStackedBar data={data} />
}

// ─────────────────────────────────────────────
// Leave Usage by Type
// ─────────────────────────────────────────────

export async function LeaveUsageByTypeWidget(props: WidgetProps) {
  const data = await getLeaveUsageByType(props.orgId, props.userId, props.orgTimezone)
  return <LeaveDonut data={data} />
}
