/**
 * Owner/HR dashboard widgets — stat tiles for the headline row.
 */
import * as React from 'react'
import { Users } from 'lucide-react'
import { StatTile } from '@/core/ui/charts'
import { EmptyState } from '@/core/ui/empty-state'
import type { WidgetProps } from '@/core/dashboard'
import {
  getActiveEmployeeCount,
  getActiveEmployeeCountLastMonth,
  getPresentToday,
  getOnLeaveToday,
  getPendingLeaveCount,
  getOverdueOnboardingTaskCount,
  getExpiringDocumentCount,
} from '@/core/dashboard/queries'

// ─────────────────────────────────────────────
// Active Employees
// ─────────────────────────────────────────────

export async function ActiveEmployeesWidget(props: WidgetProps) {
  const { orgId, userId, orgTimezone, managedEmployeeIds } = props

  const [count, lastMonth] = await Promise.all([
    getActiveEmployeeCount(orgId, userId, managedEmployeeIds),
    getActiveEmployeeCountLastMonth(orgId, userId, orgTimezone),
  ])

  if (count === 0 && !managedEmployeeIds) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No employees yet"
        description="Add your first employee to get started."
        action={{ label: 'Add employee', onClick: () => {} }}
      />
    )
  }

  const delta = lastMonth > 0
    ? Math.round(((count - lastMonth) / lastMonth) * 100)
    : 0

  return (
    <StatTile
      label={managedEmployeeIds ? 'Active Reports' : 'Active Employees'}
      value={count}
      delta={delta}
      deltaLabel="vs last month"
    />
  )
}

// ─────────────────────────────────────────────
// Present Today
// ─────────────────────────────────────────────

export async function PresentTodayWidget(props: WidgetProps) {
  const { orgId, userId, orgTimezone, managedEmployeeIds } = props
  const count = await getPresentToday(orgId, userId, orgTimezone, managedEmployeeIds)

  return (
    <StatTile
      label={managedEmployeeIds ? 'Team Present Today' : 'Present Today'}
      value={count}
    />
  )
}

// ─────────────────────────────────────────────
// On Leave Today
// ─────────────────────────────────────────────

export async function OnLeaveTodayWidget(props: WidgetProps) {
  const { orgId, userId, orgTimezone, managedEmployeeIds } = props
  const count = await getOnLeaveToday(orgId, userId, orgTimezone, managedEmployeeIds)

  return (
    <StatTile
      label={managedEmployeeIds ? 'Team On Leave' : 'On Leave Today'}
      value={count}
    />
  )
}

// ─────────────────────────────────────────────
// Pending Leave Approvals
// ─────────────────────────────────────────────

export async function PendingLeaveWidget(props: WidgetProps) {
  const { orgId, userId, managedEmployeeIds } = props
  const count = await getPendingLeaveCount(orgId, userId, managedEmployeeIds)

  return (
    <StatTile
      label="Pending Leave"
      value={count}
    />
  )
}

// ─────────────────────────────────────────────
// Overdue Onboarding Tasks
// ─────────────────────────────────────────────

export async function OverdueOnboardingWidget(props: WidgetProps) {
  const { orgId, userId, orgTimezone, managedEmployeeIds } = props
  const count = await getOverdueOnboardingTaskCount(
    orgId, userId, orgTimezone, managedEmployeeIds
  )

  return (
    <StatTile
      label="Overdue Onboarding"
      value={count}
    />
  )
}

// ─────────────────────────────────────────────
// Expiring Documents
// ─────────────────────────────────────────────

export async function ExpiringDocumentsWidget(props: WidgetProps) {
  const { orgId, userId, orgTimezone, managedEmployeeIds } = props
  const count = await getExpiringDocumentCount(
    orgId, userId, orgTimezone, managedEmployeeIds
  )

  return (
    <StatTile
      label="Expiring Documents"
      value={count}
    />
  )
}
