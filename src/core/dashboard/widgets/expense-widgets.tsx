/**
 * Expense module dashboard widgets.
 */
import * as React from 'react'
import { StatTile } from '@/core/ui/charts'
import type { WidgetProps } from '@/core/dashboard'
import {
  getPendingExpenseClaims,
  getMyExpenseSummary,
  getExpenseTrend,
} from '@/core/dashboard/widget-queries'
import { ExpenseTrendChart } from './chart-clients/expense-trend'

// ─────────────────────────────────────────────
// Pending Expense Claims (admin/manager)
// ─────────────────────────────────────────────

export async function PendingExpenseClaimsWidget(props: WidgetProps) {
  const summary = await getPendingExpenseClaims(props.orgId, props.userId)

  const formattedAmount = summary.totalAmountCents > 0
    ? `$${(summary.totalAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '$0'

  return (
    <StatTile
      label="Pending Expenses"
      value={summary.count}
      deltaLabel={`${formattedAmount} awaiting approval`}
    />
  )
}

// ─────────────────────────────────────────────
// My Expenses (employee)
// ─────────────────────────────────────────────

export async function MyExpensesWidget(props: WidgetProps) {
  if (!props.employeeId) {
    return <StatTile label="My Expenses" value={0} />
  }

  const summary = await getMyExpenseSummary(
    props.orgId,
    props.userId,
    props.employeeId,
    props.orgTimezone
  )

  const formattedAmount = summary.pendingAmountCents > 0
    ? `$${(summary.pendingAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '$0'

  return (
    <StatTile
      label="My Expenses"
      value={summary.submittedCount}
      deltaLabel={`${formattedAmount} pending this period`}
    />
  )
}

// ─────────────────────────────────────────────
// Expense Trend (owner — bar chart)
// ─────────────────────────────────────────────

export async function ExpenseTrendWidget(props: WidgetProps) {
  const data = await getExpenseTrend(props.orgId, props.userId, props.orgTimezone)
  return <ExpenseTrendChart data={data} />
}
