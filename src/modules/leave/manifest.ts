/**
 * Leave module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

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
    { key: 'leave.balance.view_all', description: 'View all leave balances', defaultRoles: ADMIN_ROLES },
    { key: 'leave.type.manage', description: 'Manage leave types', defaultRoles: ADMIN_ROLES },
    { key: 'leave.policy.manage', description: 'Manage leave policies', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    { label: 'Leave', href: '/leave', icon: 'CalendarDays', permission: 'leave.request.create' },
  ],
})
