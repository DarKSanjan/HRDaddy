/**
 * Leave module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import {
  OnLeaveTodayWidget,
  PendingLeaveWidget,
} from '@/core/dashboard/widgets/stat-widgets'
import {
  LeaveUsageByTypeWidget,
} from '@/core/dashboard/widgets/chart-widgets'
import {
  EmployeeLeaveBalanceWidget,
  EmployeePendingRequestsWidget,
} from '@/core/dashboard/widgets/employee-widgets'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const leaveModule = defineModule({
  id: 'leave',
  name: 'Leave',
  version: '1.0.0',
  description: 'Leave types, balances, requests and approvals',
  dependsOn: ['employees'],

  permissions: [
    { key: 'leave.request.create', description: 'Submit leave requests', defaultRoles: ALL_ROLES },
    { key: 'leave.request.approve', description: 'Approve/reject leave requests', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'leave.request.override', description: 'Override leave decisions', defaultRoles: ADMIN_ROLES },
    { key: 'leave.balance.view_own', description: 'View own leave balance', defaultRoles: ALL_ROLES },
    { key: 'leave.balance.view_all', description: 'View all leave balances', defaultRoles: ADMIN_ROLES },
    { key: 'leave.type.manage', description: 'Manage leave types', defaultRoles: ADMIN_ROLES },
    { key: 'leave.policy.manage', description: 'Manage leave policies', defaultRoles: ADMIN_ROLES },
    { key: 'leave.calendar.view_team', description: 'View team leave calendar', defaultRoles: ADMIN_AND_MANAGER },
  ],

  nav: [
    {
      label: 'Leave',
      href: '/leave',
      icon: 'CalendarDays',
      permission: 'leave.request.create',
      children: [
        { label: 'Leave Approvals', href: '/leave/approvals', icon: 'ClipboardCheck', permission: 'leave.request.approve' },
        { label: 'Team Calendar', href: '/leave/calendar', icon: 'Calendar', permission: 'leave.calendar.view_team' },
      ],
    },
  ],

  widgets: [
    {
      id: 'on-leave-today',
      title: 'On Leave Today',
      description: 'Number of employees on approved leave today.',
      permission: 'leave.balance.view_all',
      roles: ['owner', 'manager'],
      size: 'sm',
      priority: 30,
      component: OnLeaveTodayWidget,
    },
    {
      id: 'pending-leave',
      title: 'Pending Leave',
      description: 'Leave requests awaiting approval.',
      permission: 'leave.request.approve',
      roles: ['owner', 'manager'],
      size: 'sm',
      priority: 40,
      component: PendingLeaveWidget,
    },
    {
      id: 'leave-usage-by-type',
      title: 'Leave Usage by Type',
      description: 'Breakdown of leave days taken by type this year.',
      permission: 'leave.balance.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 130,
      component: LeaveUsageByTypeWidget,
    },
    {
      id: 'employee-leave-balance',
      title: 'Leave Balances',
      description: 'Your personal leave balances and usage.',
      permission: 'leave.balance.view_own',
      roles: ['employee'],
      size: 'md',
      priority: 10,
      component: EmployeeLeaveBalanceWidget,
    },
    {
      id: 'employee-pending-requests',
      title: 'Pending Requests',
      description: 'Your leave requests awaiting approval.',
      permission: 'leave.request.create',
      roles: ['employee'],
      size: 'sm',
      priority: 20,
      component: EmployeePendingRequestsWidget,
    },
  ],
})
