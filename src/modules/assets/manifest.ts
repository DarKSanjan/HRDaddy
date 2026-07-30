/**
 * Assets module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import {
  AssetOverviewWidget,
  MyAssetsWidget,
  PendingAssetRequestsWidget,
} from '@/core/dashboard/widgets/asset-widgets'

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
    { key: 'asset.request', description: 'Request an asset to be assigned', defaultRoles: ALL_ROLES },
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
        { label: 'Asset Requests', href: '/assets/requests', icon: 'FileQuestion', permission: 'asset.assign' },
      ],
    },
  ],

  widgets: [
    {
      id: 'asset-overview',
      title: 'Asset Overview',
      description: 'Breakdown of assets by status: available, assigned, and in maintenance.',
      permission: 'asset.view_all',
      roles: ['owner', 'manager'],
      size: 'md',
      priority: 50,
      component: AssetOverviewWidget,
    },
    {
      id: 'my-assets',
      title: 'My Assets',
      description: 'Number of assets currently assigned to you.',
      permission: 'asset.view_own',
      roles: ['employee'],
      size: 'sm',
      priority: 30,
      component: MyAssetsWidget,
    },
    {
      id: 'pending-asset-requests',
      title: 'Pending Asset Requests',
      description: 'Asset requests awaiting admin review.',
      permission: 'asset.assign',
      roles: ['owner', 'manager'],
      size: 'sm',
      priority: 45,
      component: PendingAssetRequestsWidget,
    },
  ],
})
