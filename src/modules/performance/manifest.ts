/**
 * Performance module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import {
  PerformanceCycleStatusWidget,
  MyReviewsWidget,
} from '@/core/dashboard/widgets/performance-widgets'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const performanceModule = defineModule({
  id: 'performance',
  name: 'Performance',
  version: '1.0.0',
  description: 'Performance review cycles with competency scoring and auto-metrics',
  dependsOn: ['employees'],

  permissions: [
    { key: 'performance.review.view_own', description: 'View own published reviews and auto-metrics', defaultRoles: ALL_ROLES },
    { key: 'performance.review.submit', description: 'Submit reviews for direct reports', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'performance.review.view_all', description: 'View all reviews org-wide', defaultRoles: ADMIN_ROLES },
    { key: 'performance.cycle.manage', description: 'Create, open, and close review cycles', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    {
      label: 'Performance',
      href: '/performance',
      icon: 'TrendingUp',
      permission: 'performance.review.view_own',
    },
  ],

  widgets: [
    {
      id: 'performance-cycle-status',
      title: 'Performance Cycle Status',
      description: 'Current active review cycle progress.',
      roles: ['owner', 'manager'],
      size: 'sm',
      priority: 55,
      component: PerformanceCycleStatusWidget,
    },
    {
      id: 'my-reviews',
      title: 'My Reviews',
      description: 'Pending reviews assigned to you as reviewer or reviewee.',
      roles: ['employee'],
      size: 'sm',
      priority: 35,
      component: MyReviewsWidget,
    },
  ],
})
