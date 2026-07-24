/**
 * Employees module manifest — the core module, always enabled.
 * Carries the employee/department permission keys ported from the old permissions file.
 * Routes and UI are M3.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

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
  permissionNamespaces: ['employee', 'department'],

  permissions: [
    // Organisation

    // Employees
    { key: 'employee.view_all', description: 'View all employees', defaultRoles: ADMIN_ROLES },
    { key: 'employee.view_own', description: 'View own employee profile', defaultRoles: ALL_ROLES },
    { key: 'employee.view_team', description: 'View team members', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'employee.create', description: 'Create employees', defaultRoles: ADMIN_ROLES },
    { key: 'employee.edit', description: 'Edit employee records', defaultRoles: ADMIN_ROLES },
    { key: 'employee.archive', description: 'Archive employees', defaultRoles: ADMIN_ROLES },

    // Departments
    { key: 'department.view', description: 'View departments', defaultRoles: [...ADMIN_AND_MANAGER, 'EMPLOYEE'] },
    { key: 'department.manage', description: 'Create/edit departments', defaultRoles: ADMIN_ROLES },

    // Notifications & Audit (shared core)
  ],

  nav: [
    { label: 'Employees', href: '/employees', icon: 'Users', permission: 'employee.view_own' },
    { label: 'Departments', href: '/departments', icon: 'Building2', permission: 'department.view' },
  ],

  // TODO(M3) settings, widgets, events, seed, onEnable, onDisable
})
