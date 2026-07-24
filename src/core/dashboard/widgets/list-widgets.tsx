/**
 * List-style widgets: upcoming events, activity feed, payroll status.
 */
import * as React from 'react'
import { Cake, Award, Activity, DollarSign } from 'lucide-react'
import { ChartCard, ChartEmpty } from '@/core/ui/charts'
import type { WidgetProps } from '@/core/dashboard'
import {
  getUpcomingBirthdays,
  getUpcomingAnniversaries,
  getRecentActivity,
} from '@/core/dashboard/chart-queries'
import { getPayrollStatus } from '@/core/dashboard/queries'
import { formatDistanceToNow } from 'date-fns'

// ─────────────────────────────────────────────
// Upcoming Birthdays & Anniversaries
// ─────────────────────────────────────────────

export async function UpcomingEventsWidget(props: WidgetProps) {
  const [birthdays, anniversaries] = await Promise.all([
    getUpcomingBirthdays(props.orgId, props.userId, props.orgTimezone),
    getUpcomingAnniversaries(props.orgId, props.userId, props.orgTimezone),
  ])

  const hasBirthdays = birthdays.length > 0
  const hasAnniversaries = anniversaries.length > 0

  if (!hasBirthdays && !hasAnniversaries) {
    return (
      <ChartCard title="Upcoming">
        <ChartEmpty message="No birthdays or anniversaries in the next 7 days." />
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Upcoming">
      <div className="space-y-3">
        {birthdays.map((b) => (
          <div key={b.id} className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover">
              <Cake className="h-3.5 w-3.5 text-text-subtle" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-text truncate">
                {b.firstName} {b.lastName}
              </p>
              <p className="text-[11px] text-text-subtle">
                {b.isToday ? 'Birthday today' : 'Birthday this week'}
              </p>
            </div>
            {b.isToday && (
              <span className="rounded-[var(--radius-xs)] bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                Today
              </span>
            )}
          </div>
        ))}
        {anniversaries.map((a) => (
          <div key={a.id} className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover">
              <Award className="h-3.5 w-3.5 text-text-subtle" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-text truncate">
                {a.firstName} {a.lastName}
              </p>
              <p className="text-[11px] text-text-subtle">
                {a.years} {a.years === 1 ? 'year' : 'years'}{a.isToday ? ' today' : ' this week'}
              </p>
            </div>
            {a.isToday && (
              <span className="rounded-[var(--radius-xs)] bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                Today
              </span>
            )}
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ─────────────────────────────────────────────
// Recent Activity (Audit Feed)
// ─────────────────────────────────────────────

function formatAction(action: string, targetType: string): string {
  // Convert action.targetType to human-readable
  const actionMap: Record<string, string> = {
    'create.employee': 'added a new employee',
    'update.employee': 'updated an employee record',
    'archive.employee': 'archived an employee',
    'create.leave_request': 'submitted a leave request',
    'approve.leave_request': 'approved a leave request',
    'reject.leave_request': 'rejected a leave request',
    'create.attendance': 'clocked in',
    'update.attendance': 'corrected an attendance record',
    'create.onboarding': 'assigned onboarding',
    'complete.onboarding_task': 'completed an onboarding task',
    'create.document': 'uploaded a document',
    'publish.payroll': 'published payroll',
    'approve.payroll': 'approved payroll',
  }
  return actionMap[`${action}.${targetType}`] ?? `${action} ${targetType.replace('_', ' ')}`
}

export async function RecentActivityWidget(props: WidgetProps) {
  const entries = await getRecentActivity(props.orgId, props.userId)

  if (entries.length === 0) {
    return (
      <ChartCard title="Recent Activity">
        <ChartEmpty message="No recent admin activity." />
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Recent Activity">
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface-hover">
              <Activity className="h-3 w-3 text-text-subtle" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-text">
                <span className="font-medium">{entry.actorName}</span>{' '}
                {formatAction(entry.action, entry.targetType)}
              </p>
              <p className="text-[11px] text-text-subtle">
                {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ─────────────────────────────────────────────
// Payroll Status
// ─────────────────────────────────────────────

const statusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-surface-hover text-text-subtle',
  UNDER_REVIEW: 'bg-warning/10 text-warning',
  APPROVED: 'bg-accent-500/10 text-accent-500',
  PUBLISHED: 'bg-success/10 text-success',
  PAID: 'bg-success/10 text-success',
}

export async function PayrollStatusWidget(props: WidgetProps) {
  const status = await getPayrollStatus(props.orgId, props.userId)

  if (!status) {
    return (
      <ChartCard title="Payroll Status">
        <div className="flex items-center gap-3 py-2">
          <DollarSign className="h-5 w-5 text-text-subtle" aria-hidden="true" />
          <div>
            <p className="text-[13px] text-text">No payroll periods yet</p>
            <p className="text-[11px] text-text-subtle">
              Set up your first payroll run to get started.
            </p>
          </div>
        </div>
      </ChartCard>
    )
  }

  const badgeClass = statusBadgeColors[status.status] ?? statusBadgeColors.DRAFT

  return (
    <ChartCard title="Payroll Status">
      <div className="flex items-center gap-3 py-2">
        <DollarSign className="h-5 w-5 text-text-subtle" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-[13px] font-medium text-text">{status.name}</p>
        </div>
        <span className={`rounded-[var(--radius-xs)] px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
          {status.status.replace('_', ' ')}
        </span>
      </div>
    </ChartCard>
  )
}
