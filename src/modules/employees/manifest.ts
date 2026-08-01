/**
 * Employees module manifest — the core module, always enabled.
 * Carries the employee/department permission keys ported from the old permissions file.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import {
  ActiveEmployeesWidget,
} from '@/core/dashboard/widgets/stat-widgets'
import {
  HeadcountOverTimeWidget,
  HeadcountByDepartmentWidget,
} from '@/core/dashboard/widgets/chart-widgets'
import {
  UpcomingEventsWidget,
  RecentActivityWidget,
} from '@/core/dashboard/widgets/list-widgets'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const employeesModule = defineModule({
  id: 'employees',
  name: 'Employees',
  version: '1.0.0',
  description: 'Employee records, departments, job titles, and org structure',
  dependsOn: [],
  required: true,
  permissionNamespaces: ['employee', 'department', 'audit'],

  permissions: [
    // Audit log
    { key: 'audit.view', description: 'View organisation audit log', defaultRoles: ADMIN_ROLES },

    // Employees
    { key: 'employee.view_all', description: 'View all employees', defaultRoles: ADMIN_ROLES },
    { key: 'employee.view_own', description: 'View own employee profile', defaultRoles: ALL_ROLES },
    { key: 'employee.view_team', description: 'View team members', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'employee.create', description: 'Create employees', defaultRoles: ADMIN_ROLES },
    { key: 'employee.edit', description: 'Edit employee records', defaultRoles: ADMIN_ROLES },
    { key: 'employee.edit_own', description: 'Edit own contact/emergency info', defaultRoles: ALL_ROLES },
    { key: 'employee.archive', description: 'Archive employees', defaultRoles: ADMIN_ROLES },

    // Departments
    { key: 'department.view', description: 'View departments', defaultRoles: [...ADMIN_AND_MANAGER, 'EMPLOYEE'] },
    { key: 'department.manage', description: 'Create/edit departments', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    {
      label: 'Employees',
      href: '/employees',
      icon: 'Users',
      permission: 'employee.view_own',
      children: [
        { label: 'Org Chart', href: '/employees/org-chart', icon: 'GitBranch', permission: 'employee.view_all' },
      ],
    },
  ],

  widgets: [
    {
      id: 'active-employees',
      title: 'Active Employees',
      description: 'Total active employees or direct reports.',
      roles: ['owner', 'manager'],
      size: 'sm',
      priority: 10,
      component: ActiveEmployeesWidget,
    },
    {
      id: 'headcount-over-time',
      title: 'Headcount Over Time',
      description: 'Monthly headcount trend with joiners and leavers.',
      permission: 'employee.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 100,
      component: HeadcountOverTimeWidget,
    },
    {
      id: 'headcount-by-department',
      title: 'Headcount by Department',
      description: 'Employee distribution across departments.',
      permission: 'employee.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 110,
      component: HeadcountByDepartmentWidget,
    },
    {
      id: 'upcoming-events',
      title: 'Upcoming',
      description: 'Birthdays and work anniversaries this week.',
      roles: ['owner', 'manager', 'employee'],
      size: 'md',
      priority: 200,
      component: UpcomingEventsWidget,
    },
    {
      id: 'recent-activity',
      title: 'Recent Activity',
      description: 'Latest admin actions across the organisation.',
      permission: 'employee.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 210,
      component: RecentActivityWidget,
    },
  ],
})
