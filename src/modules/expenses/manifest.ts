/**
 * Expenses module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import {
  PendingExpenseClaimsWidget,
  MyExpensesWidget,
  ExpenseTrendWidget,
} from '@/core/dashboard/widgets/expense-widgets'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const expensesModule = defineModule({
  id: 'expenses',
  name: 'Expenses',
  version: '1.0.0',
  description: 'Expense claim submission, approval, and reimbursement tracking',
  dependsOn: ['employees'],
  permissionNamespaces: ['expense'],

  permissions: [
    { key: 'expense.submit', description: 'Submit expense claims', defaultRoles: ALL_ROLES },
    { key: 'expense.view_own', description: 'View own expense claims', defaultRoles: ALL_ROLES },
    { key: 'expense.view_all', description: 'View all expense claims', defaultRoles: ADMIN_ROLES },
    { key: 'expense.approve', description: 'Approve/reject expense claims', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'expense.reimburse', description: 'Mark expense claims as reimbursed', defaultRoles: ADMIN_ROLES },
    { key: 'expense.category.manage', description: 'Manage expense categories', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    {
      label: 'Expenses',
      href: '/expenses',
      icon: 'Receipt',
      permission: 'expense.view_own',
      children: [
        { label: 'Expense Approvals', href: '/expenses/approvals', icon: 'ClipboardCheck', permission: 'expense.approve' },
      ],
    },
  ],

  widgets: [
    {
      id: 'pending-expense-claims',
      title: 'Pending Expense Claims',
      description: 'Count and total amount of expense claims awaiting approval.',
      permission: 'expense.approve',
      roles: ['owner', 'manager'],
      size: 'sm',
      priority: 42,
      component: PendingExpenseClaimsWidget,
    },
    {
      id: 'my-expenses',
      title: 'My Expenses',
      description: 'Your submitted expenses and pending reimbursement this period.',
      permission: 'expense.submit',
      roles: ['employee'],
      size: 'sm',
      priority: 25,
      component: MyExpensesWidget,
    },
    {
      id: 'expense-trend',
      title: 'Expense Trend',
      description: 'Approved expense totals over the last 6 months.',
      permission: 'expense.approve',
      roles: ['owner'],
      size: 'md',
      priority: 120,
      component: ExpenseTrendWidget,
    },
  ],
})
