/**
 * Kernel-owned permissions.
 *
 * Organisation administration, notifications and audit are properties of the
 * platform, not of any feature module. Declaring them in a module manifest
 * would mean an organisation that disables that module also loses the ability
 * to manage itself — an owner locked out of their own settings.
 *
 * These are registered under the reserved id CORE_MODULE_ID, which
 * resolvePermissions() always treats as enabled.
 */
import { registerPermissions, type PermissionDef } from './index'
import type { OrgRole } from '@prisma/client'

export const CORE_MODULE_ID = 'core'

const OWNER_ONLY: OrgRole[] = ['OWNER']
const ADMIN: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ALL: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']

export const KERNEL_PERMISSIONS: PermissionDef[] = [
  {
    key: 'org.view',
    description: 'View organisation details',
    defaultRoles: ALL,
  },
  {
    key: 'org.edit',
    description: 'Edit organisation details',
    defaultRoles: ADMIN,
  },
  {
    key: 'org.manage_settings',
    description: 'Change organisation settings',
    defaultRoles: ADMIN,
  },
  {
    key: 'org.manage_members',
    description: 'Add, remove and re-role organisation members',
    defaultRoles: ADMIN,
  },
  {
    key: 'org.manage_modules',
    description: 'Enable and disable modules for the organisation',
    defaultRoles: OWNER_ONLY,
  },
  {
    key: 'org.invite',
    description: 'Invite people to the organisation',
    defaultRoles: ADMIN,
  },
  {
    key: 'org.transfer_ownership',
    description: 'Transfer ownership of the organisation',
    defaultRoles: OWNER_ONLY,
  },
  {
    key: 'notification.view_own',
    description: 'View own notifications',
    defaultRoles: ALL,
  },
  {
    key: 'audit.view',
    description: 'View the audit log',
    defaultRoles: ADMIN,
    sensitive: true,
  },
]

registerPermissions(CORE_MODULE_ID, KERNEL_PERMISSIONS)
