/**
 * Documents module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export const documentsModule = defineModule({
  id: 'documents',
  name: 'Documents',
  version: '1.0.0',
  description: 'Secure document storage with categories and access control',
  dependsOn: ['employees'],

  permissions: [
    { key: 'document.upload', description: 'Upload documents', defaultRoles: ADMIN_ROLES },
    { key: 'document.view_all', description: 'View all employee documents', defaultRoles: ADMIN_ROLES },
    { key: 'document.view_own', description: 'View own documents', defaultRoles: ALL_ROLES },
    { key: 'document.category.manage', description: 'Manage document categories', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    { label: 'Documents', href: '/documents', icon: 'FileText', permission: 'document.view_own' },
  ],
})
