/**
 * Payroll module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export const payrollModule = defineModule({
  id: 'payroll',
  name: 'Payroll',
  version: '1.0.0',
  description: 'Payroll processing with CPF calculations and compliant payslips',
  dependsOn: ['employees'],

  permissions: [
    { key: 'payroll.process', description: 'Process payroll runs', defaultRoles: ADMIN_ROLES },
    { key: 'payroll.approve', description: 'Approve payroll for payment', defaultRoles: ['OWNER'] },
    { key: 'payroll.view_all', description: 'View all payslips', defaultRoles: ADMIN_ROLES },
    { key: 'payroll.view_own', description: 'View own payslips', defaultRoles: ALL_ROLES },
  ],

  nav: [
    { label: 'Payroll', href: '/payroll', icon: 'DollarSign', permission: 'payroll.view_own' },
  ],
})
