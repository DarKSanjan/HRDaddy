/**
 * Onboarding module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

// Import event handlers so they register on module import
import './events'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const onboardingModule = defineModule({
  id: 'onboarding',
  name: 'Onboarding',
  version: '1.0.0',
  description: 'Checklists and task assignment for new hires',
  dependsOn: ['employees'],

  permissions: [
    { key: 'onboarding.template.manage', description: 'Manage onboarding templates', defaultRoles: ADMIN_ROLES },
    { key: 'onboarding.template.view', description: 'View onboarding templates', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'onboarding.assign', description: 'Assign onboarding to employees', defaultRoles: ADMIN_ROLES },
    { key: 'onboarding.cancel', description: 'Cancel onboarding processes', defaultRoles: ADMIN_ROLES },
    { key: 'onboarding.complete_task', description: 'Complete onboarding tasks', defaultRoles: ALL_ROLES },
    { key: 'onboarding.view_all', description: 'View all onboarding progress', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    { label: 'Onboarding', href: '/onboarding', icon: 'ClipboardCheck', permission: 'onboarding.complete_task' },
  ],
})
