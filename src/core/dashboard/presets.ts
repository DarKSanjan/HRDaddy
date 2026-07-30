/**
 * Dashboard layout presets — hardcoded starting points users can apply.
 *
 * A preset is just a SavedLayout-shaped widget list. When applied, it gets
 * filtered through the same security boundary as applyLayout() — any widget
 * ID not in the viewer's permitted set is silently dropped.
 *
 * Applying a preset does NOT save it — it loads into the local edit state,
 * and the user must explicitly hit "Save layout" to persist.
 */
import type { SavedLayoutWidget } from '@/core/dashboard'

export interface DashboardPreset {
  id: string
  name: string
  description: string
  widgets: SavedLayoutWidget[]
}

/**
 * "Default" — all widgets visible in priority order.
 * Equivalent to no customization (reset to default).
 */
const defaultPreset: DashboardPreset = {
  id: 'default',
  name: 'Default',
  description: 'All widgets visible in default order',
  widgets: [], // Empty = use default priority, same as having no saved layout
}

/**
 * "Focused" — a small curated set of the most important widgets.
 * Hides chart-heavy/secondary widgets, keeps the top stat tiles + upcoming.
 */
const focusedPreset: DashboardPreset = {
  id: 'focused',
  name: 'Focused',
  description: 'Just the essentials — key stats and upcoming events',
  widgets: [
    { id: 'active-employees', hidden: false },
    { id: 'on-leave-today', hidden: false },
    { id: 'pending-leave', hidden: false },
    { id: 'upcoming-events', hidden: false },
    { id: 'calendar-upcoming', hidden: false },
    { id: 'employee-leave-balance', hidden: false },
    { id: 'employee-pending-requests', hidden: false },
    // Hide the rest
    { id: 'headcount-over-time', hidden: true },
    { id: 'headcount-by-department', hidden: true },
    { id: 'leave-usage-by-type', hidden: true },
    { id: 'recent-activity', hidden: true },
    { id: 'asset-overview', hidden: true },
    { id: 'pending-asset-requests', hidden: true },
    { id: 'expense-trend', hidden: true },
    { id: 'performance-cycle-status', hidden: true },
    { id: 'pending-expense-claims', hidden: true },
    { id: 'my-assets', hidden: true },
    { id: 'my-expenses', hidden: true },
    { id: 'my-reviews', hidden: true },
  ],
}

/**
 * "Manager View" — attendance/leave/approvals weighted.
 * Shows what managers care about: team status, pending approvals, performance.
 */
const managerViewPreset: DashboardPreset = {
  id: 'manager-view',
  name: 'Manager View',
  description: 'Team status, leave approvals, and performance at a glance',
  widgets: [
    { id: 'active-employees', hidden: false },
    { id: 'on-leave-today', hidden: false },
    { id: 'pending-leave', hidden: false },
    { id: 'pending-expense-claims', hidden: false },
    { id: 'pending-asset-requests', hidden: false },
    { id: 'performance-cycle-status', hidden: false },
    { id: 'upcoming-events', hidden: false },
    // Hide charts/details
    { id: 'headcount-over-time', hidden: true },
    { id: 'headcount-by-department', hidden: true },
    { id: 'leave-usage-by-type', hidden: true },
    { id: 'recent-activity', hidden: true },
    { id: 'asset-overview', hidden: true },
    { id: 'expense-trend', hidden: true },
  ],
}

/**
 * "Finance View" — payroll/expense weighted.
 * Emphasises expense and financial widgets.
 */
const financeViewPreset: DashboardPreset = {
  id: 'finance-view',
  name: 'Finance View',
  description: 'Expense tracking, pending claims, and financial trends',
  widgets: [
    { id: 'pending-expense-claims', hidden: false },
    { id: 'expense-trend', hidden: false },
    { id: 'active-employees', hidden: false },
    { id: 'asset-overview', hidden: false },
    { id: 'pending-asset-requests', hidden: false },
    { id: 'upcoming-events', hidden: false },
    // Hide the rest
    { id: 'on-leave-today', hidden: true },
    { id: 'pending-leave', hidden: true },
    { id: 'headcount-over-time', hidden: true },
    { id: 'headcount-by-department', hidden: true },
    { id: 'leave-usage-by-type', hidden: true },
    { id: 'recent-activity', hidden: true },
    { id: 'performance-cycle-status', hidden: true },
  ],
}

export const DASHBOARD_PRESETS: DashboardPreset[] = [
  defaultPreset,
  focusedPreset,
  managerViewPreset,
  financeViewPreset,
]
