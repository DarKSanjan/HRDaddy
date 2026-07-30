/**
 * Assets module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export const assetsModule = defineModule({
  id: 'assets',
  name: 'Assets',
  version: '1.0.0',
  description: 'Company asset register, assignment tracking, and lifecycle management',
  dependsOn: ['employees'],
  permissionNamespaces: ['asset'],

  permissions: [
    { key: 'asset.manage', description: 'Create, edit, and archive assets and categories', defaultRoles: ADMIN_ROLES },
    { key: 'asset.assign', description: 'Assign and return assets to employees', defaultRoles: ADMIN_ROLES },
    { key: 'asset.view_all', description: 'View the full asset register', defaultRoles: ADMIN_ROLES },
    { key: 'asset.view_own', description: 'View own assigned assets', defaultRoles: ALL_ROLES },
  ],

  nav: [
    {
      label: 'Assets',
      href: '/assets',
      icon: 'Package',
      permission: 'asset.view_own',
      children: [
        { label: 'Asset Register', href: '/assets/register', icon: 'ClipboardList', permission: 'asset.view_all' },
      ],
    },
  ],

  widgets: [],
})
