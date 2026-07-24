/**
 * Widget registrations — all dashboard widgets declared by their owning modules.
 *
 * Import this barrel to populate the widget registry. Analogous to
 * src/modules/register.ts for module manifests.
 *
 * Widget priority determines ordering: lower = higher on page.
 * Sizes: sm (3 cols), md (6 cols), lg (12 cols).
 */
import { registerWidget } from '@/core/dashboard'

import {
  ActiveEmployeesWidget,
  PresentTodayWidget,
  OnLeaveTodayWidget,
  PendingLeaveWidget,
  OverdueOnboardingWidget,
  ExpiringDocumentsWidget,
} from '@/core/dashboard/widgets/stat-widgets'

import {
  HeadcountOverTimeWidget,
  HeadcountByDepartmentWidget,
  AttendanceThisWeekWidget,
  LeaveUsageByTypeWidget,
} from '@/core/dashboard/widgets/chart-widgets'

import {
  UpcomingEventsWidget,
  RecentActivityWidget,
  PayrollStatusWidget,
} from '@/core/dashboard/widgets/list-widgets'

import {
  EmployeeLeaveBalanceWidget,
  EmployeePendingRequestsWidget,
  EmployeeOnboardingWidget,
  EmployeeExpiringDocsWidget,
} from '@/core/dashboard/widgets/employee-widgets'

// ─────────────────────────────────────────────
// Owner / HR Admin widgets
// ─────────────────────────────────────────────

registerWidget({
  id: 'active-employees',
  moduleId: 'employees',
  title: 'Active Employees',
  roles: ['owner', 'manager'],
  size: 'sm',
  priority: 10,
  component: ActiveEmployeesWidget,
})

registerWidget({
  id: 'present-today',
  moduleId: 'attendance',
  title: 'Present Today',
  permission: 'attendance.view_all',
  roles: ['owner', 'manager'],
  size: 'sm',
  priority: 20,
  component: PresentTodayWidget,
})

registerWidget({
  id: 'on-leave-today',
  moduleId: 'leave',
  title: 'On Leave Today',
  permission: 'leave.balance.view_all',
  roles: ['owner', 'manager'],
  size: 'sm',
  priority: 30,
  component: OnLeaveTodayWidget,
})

registerWidget({
  id: 'pending-leave',
  moduleId: 'leave',
  title: 'Pending Leave',
  permission: 'leave.request.approve',
  roles: ['owner', 'manager'],
  size: 'sm',
  priority: 40,
  component: PendingLeaveWidget,
})

registerWidget({
  id: 'overdue-onboarding',
  moduleId: 'onboarding',
  title: 'Overdue Onboarding',
  permission: 'onboarding.view_all',
  roles: ['owner'],
  size: 'sm',
  priority: 50,
  component: OverdueOnboardingWidget,
})

registerWidget({
  id: 'expiring-documents',
  moduleId: 'documents',
  title: 'Expiring Documents',
  permission: 'document.view_all',
  roles: ['owner'],
  size: 'sm',
  priority: 60,
  component: ExpiringDocumentsWidget,
})

registerWidget({
  id: 'headcount-over-time',
  moduleId: 'employees',
  title: 'Headcount Over Time',
  permission: 'employee.view_all',
  roles: ['owner'],
  size: 'md',
  priority: 100,
  component: HeadcountOverTimeWidget,
})

registerWidget({
  id: 'headcount-by-department',
  moduleId: 'employees',
  title: 'Headcount by Department',
  permission: 'employee.view_all',
  roles: ['owner'],
  size: 'md',
  priority: 110,
  component: HeadcountByDepartmentWidget,
})

registerWidget({
  id: 'attendance-this-week',
  moduleId: 'attendance',
  title: 'Attendance This Week',
  permission: 'attendance.view_all',
  roles: ['owner'],
  size: 'md',
  priority: 120,
  component: AttendanceThisWeekWidget,
})

registerWidget({
  id: 'leave-usage-by-type',
  moduleId: 'leave',
  title: 'Leave Usage by Type',
  permission: 'leave.balance.view_all',
  roles: ['owner'],
  size: 'md',
  priority: 130,
  component: LeaveUsageByTypeWidget,
})

registerWidget({
  id: 'upcoming-events',
  moduleId: 'employees',
  title: 'Upcoming',
  roles: ['owner', 'manager', 'employee'],
  size: 'md',
  priority: 200,
  component: UpcomingEventsWidget,
})

registerWidget({
  id: 'recent-activity',
  moduleId: 'employees',
  title: 'Recent Activity',
  permission: 'employee.view_all',
  roles: ['owner'],
  size: 'md',
  priority: 210,
  component: RecentActivityWidget,
})

registerWidget({
  id: 'payroll-status',
  moduleId: 'payroll',
  title: 'Payroll Status',
  permission: 'payroll.process',
  roles: ['owner'],
  size: 'sm',
  priority: 55,
  component: PayrollStatusWidget,
})

// ─────────────────────────────────────────────
// Employee widgets
// ─────────────────────────────────────────────

registerWidget({
  id: 'employee-leave-balance',
  moduleId: 'leave',
  title: 'Leave Balances',
  permission: 'leave.balance.view_own',
  roles: ['employee'],
  size: 'md',
  priority: 10,
  component: EmployeeLeaveBalanceWidget,
})

registerWidget({
  id: 'employee-pending-requests',
  moduleId: 'leave',
  title: 'Pending Requests',
  permission: 'leave.request.create',
  roles: ['employee'],
  size: 'sm',
  priority: 20,
  component: EmployeePendingRequestsWidget,
})

registerWidget({
  id: 'employee-onboarding',
  moduleId: 'onboarding',
  title: 'Onboarding Progress',
  permission: 'onboarding.complete_task',
  roles: ['employee'],
  size: 'md',
  priority: 30,
  component: EmployeeOnboardingWidget,
})

registerWidget({
  id: 'employee-expiring-docs',
  moduleId: 'documents',
  title: 'Expiring Documents',
  permission: 'document.view_own',
  roles: ['employee'],
  size: 'sm',
  priority: 40,
  component: EmployeeExpiringDocsWidget,
})
