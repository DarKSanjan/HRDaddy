/**
 * Documents module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import {
  ExpiringDocumentsWidget,
} from '@/core/dashboard/widgets/stat-widgets'
import {
  EmployeeExpiringDocsWidget,
} from '@/core/dashboard/widgets/employee-widgets'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export const documentsModule = defineModule({
  id: 'documents',
  name: 'Documents',
  version: '1.0.0',
  description: 'Secure document storage with categories and access control',
  dependsOn: ['employees'],
  permissionNamespaces: ['document'],

  permissions: [
    { key: 'document.upload', description: 'Upload documents', defaultRoles: ADMIN_ROLES },
    { key: 'document.view_all', description: 'View all employee documents', defaultRoles: ADMIN_ROLES },
    { key: 'document.view_own', description: 'View own documents', defaultRoles: ALL_ROLES },
    { key: 'document.category.manage', description: 'Manage document categories', defaultRoles: ADMIN_ROLES },
    { key: 'document.archive', description: 'Archive documents', defaultRoles: ADMIN_ROLES },
    { key: 'document.delete', description: 'Delete archived documents', defaultRoles: ADMIN_ROLES, sensitive: true },
  ],

  nav: [
    { label: 'Documents', href: '/documents', icon: 'FileText', permission: 'document.view_own' },
  ],

  widgets: [
    {
      id: 'expiring-documents',
      title: 'Expiring Documents',
      permission: 'document.view_all',
      roles: ['owner'],
      size: 'sm',
      priority: 60,
      component: ExpiringDocumentsWidget,
    },
    {
      id: 'employee-expiring-docs',
      title: 'Expiring Documents',
      permission: 'document.view_own',
      roles: ['employee'],
      size: 'sm',
      priority: 40,
      component: EmployeeExpiringDocsWidget,
    },
  ],
})
