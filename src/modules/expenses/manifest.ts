/**
 * Expenses module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

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

  widgets: [],
})
