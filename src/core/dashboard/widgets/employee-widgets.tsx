/**
 * Employee-specific dashboard widgets.
 * Shows personal data: leave balances, pending requests, onboarding progress.
 */
import * as React from 'react'
import { CalendarDays, FileText } from 'lucide-react'
import { ChartCard, ChartEmpty } from '@/core/ui/charts'
import type { WidgetProps } from '@/core/dashboard'
import {
  getEmployeeLeaveBalances,
  getEmployeePendingRequests,
  getEmployeeOnboardingProgress,
} from '@/core/dashboard/chart-queries'
import { getExpiringDocumentCount } from '@/core/dashboard/queries'

// ─────────────────────────────────────────────
// Leave Balance Widget
// ─────────────────────────────────────────────

export async function EmployeeLeaveBalanceWidget(props: WidgetProps) {
  if (!props.employeeId) {
    return (
      <ChartCard title="Leave Balances">
        <ChartEmpty message="Your employee profile is not linked yet." />
      </ChartCard>
    )
  }

  const balances = await getEmployeeLeaveBalances(
    props.orgId, props.userId, props.employeeId, props.orgTimezone
  )

  if (balances.length === 0) {
    return (
      <ChartCard title="Leave Balances">
        <ChartEmpty message="No leave balances set up yet." />
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Leave Balances">
      <div className="space-y-3">
        {balances.map((b) => {
          const usedPercent = b.allowance > 0
            ? Math.min(100, Math.round(((b.used + b.pending) / b.allowance) * 100))
            : 0

          return (
            <div key={b.leaveType} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-text">{b.leaveType}</p>
                <p className="text-[11px] text-text-subtle tabular-nums">
                  {b.remaining} / {b.allowance} days
                </p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent-500 transition-all"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

// ─────────────────────────────────────────────
// Pending Requests Widget
// ─────────────────────────────────────────────

export async function EmployeePendingRequestsWidget(props: WidgetProps) {
  if (!props.employeeId) return null

  const count = await getEmployeePendingRequests(
    props.orgId, props.userId, props.employeeId
  )

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover">
          <CalendarDays className="h-4 w-4 text-text-subtle" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] text-text-subtle">Pending Requests</p>
          <p className="text-[18px] font-semibold text-text tabular-nums">{count}</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Onboarding Progress Widget
// ─────────────────────────────────────────────

export async function EmployeeOnboardingWidget(props: WidgetProps) {
  if (!props.employeeId) return null

  const progress = await getEmployeeOnboardingProgress(
    props.orgId, props.userId, props.employeeId
  )

  if (!progress) {
    return null // No active onboarding, don't render the widget
  }

  const percent = Math.round((progress.completed / progress.total) * 100)

  return (
    <ChartCard title="Onboarding Progress">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-text-subtle">
            {progress.completed} of {progress.total} tasks completed
          </p>
          <p className="text-[12px] font-medium text-text tabular-nums">{percent}%</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </ChartCard>
  )
}

// ─────────────────────────────────────────────
// Employee Expiring Documents
// ─────────────────────────────────────────────

export async function EmployeeExpiringDocsWidget(props: WidgetProps) {
  if (!props.employeeId) return null

  const count = await getExpiringDocumentCount(
    props.orgId, props.userId, props.orgTimezone, [props.employeeId]
  )

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover">
          <FileText className="h-4 w-4 text-text-subtle" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] text-text-subtle">Expiring Documents</p>
          <p className="text-[18px] font-semibold text-text tabular-nums">{count}</p>
        </div>
      </div>
    </div>
  )
}
