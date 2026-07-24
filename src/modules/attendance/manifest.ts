/**
 * Attendance module manifest.
 */
import { defineModule } from '@/core/modules'
import type { OrgRole } from '@prisma/client'

const ALL_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']
const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']
const ADMIN_AND_MANAGER: OrgRole[] = ['OWNER', 'HR_ADMIN', 'MANAGER']

export const attendanceModule = defineModule({
  id: 'attendance',
  name: 'Attendance',
  version: '1.0.0',
  description: 'Clock in/out, timesheets and attendance tracking',
  dependsOn: ['employees'],

  permissions: [
    { key: 'attendance.clock', description: 'Clock in and out', defaultRoles: ALL_ROLES },
    { key: 'attendance.view_all', description: 'View all attendance records', defaultRoles: ADMIN_AND_MANAGER },
    { key: 'attendance.correct', description: 'Correct attendance entries', defaultRoles: ADMIN_ROLES },
  ],

  nav: [
    { label: 'Attendance', href: '/attendance', icon: 'Clock', permission: 'attendance.clock' },
  ],
})
