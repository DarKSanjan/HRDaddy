/**
 * Onboarding module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export const onboardingModule = defineModule({
  id: 'onboarding',
  name: 'Onboarding',
  version: '1.0.0',
  description: 'Checklists and task assignment for new hires',
  dependsOn: ['employees'],

  permissions: [
    { key: 'onboarding.template.manage', description: 'Manage onboarding templates', defaultRoles: ADMIN_ROLES },
    { key: 'onboarding.assign', description: 'Assign onboarding to employees', defaultRoles: ADMIN_ROLES },
    { key: 'onboarding.complete_task', description: 'Complete onboarding tasks', defaultRoles: ALL_ROLES },
  ],

  nav: [
    { label: 'Onboarding', href: '/onboarding-tasks', icon: 'ClipboardCheck', permission: 'onboarding.complete_task' },
  ],
})
