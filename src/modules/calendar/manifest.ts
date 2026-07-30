import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

import { CalendarUpcomingWidget } from '@/core/dashboard/widgets/calendar-widgets'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const calendarModule = defineModule({
  id: 'calendar',
  name: 'Calendar',
  version: '1.0.0',
  description: 'Org-wide calendar with public holidays, important dates, and events',
  dependsOn: ['employees'],
  required: true,
  permissionNamespaces: ['calendar'],

  permissions: [
    { key: 'calendar.view', description: 'View the calendar page', defaultRoles: ALL_ROLES },
    { key: 'calendar.holiday.manage', description: 'Create, edit, delete, and import holidays', defaultRoles: ADMIN_ROLES },
    { key: 'calendar.event.create', description: 'Create calendar events', defaultRoles: ADMIN_AND_MANAGER },
  ],

  nav: [
    {
      label: 'Calendar',
      href: '/calendar',
      icon: 'CalendarDays',
      permission: 'calendar.view',
    },
  ],

  widgets: [
    {
      id: 'calendar-upcoming',
      title: 'Upcoming',
      description: 'Next few holidays, important dates, and leave days.',
      permission: 'calendar.view',
      roles: ['owner', 'manager', 'employee'],
      size: 'md',
      priority: 25,
      component: CalendarUpcomingWidget,
    },
  ],

  async seed(ctx) {
    const { seedCalendarForOrg } = await import('./seed')
    await seedCalendarForOrg(ctx.orgId, ctx.userId)
  },
})
