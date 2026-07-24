import { OrgRole } from '@prisma/client'

/**
 * All permission keys in the system.
 */
export const PERMISSIONS = {
  // Organisation
  ORG_VIEW: 'org:view',
  ORG_EDIT: 'org:edit',
  ORG_MANAGE_SETTINGS: 'org:manage_settings',
  ORG_MANAGE_MEMBERS: 'org:manage_members',
  ORG_INVITE: 'org:invite',

  // Employees
  EMPLOYEE_VIEW_ALL: 'employee:view_all',
  EMPLOYEE_VIEW_OWN: 'employee:view_own',
  EMPLOYEE_VIEW_TEAM: 'employee:view_team',
  EMPLOYEE_CREATE: 'employee:create',
  EMPLOYEE_EDIT: 'employee:edit',
  EMPLOYEE_ARCHIVE: 'employee:archive',

  // Departments
  DEPARTMENT_VIEW: 'department:view',
  DEPARTMENT_MANAGE: 'department:manage',

  // Leave
  LEAVE_VIEW_OWN: 'leave:view_own',
  LEAVE_VIEW_TEAM: 'leave:view_team',
  LEAVE_VIEW_ALL: 'leave:view_all',
  LEAVE_REQUEST: 'leave:request',
  LEAVE_APPROVE: 'leave:approve',
  LEAVE_MANAGE_TYPES: 'leave:manage_types',
  LEAVE_MANAGE_POLICIES: 'leave:manage_policies',

  // Attendance
  ATTENDANCE_VIEW_OWN: 'attendance:view_own',
  ATTENDANCE_VIEW_TEAM: 'attendance:view_team',
  ATTENDANCE_VIEW_ALL: 'attendance:view_all',
  ATTENDANCE_CLOCK: 'attendance:clock',
  ATTENDANCE_CORRECT: 'attendance:correct',

  // Onboarding
  ONBOARDING_VIEW_OWN: 'onboarding:view_own',
  ONBOARDING_MANAGE: 'onboarding:manage',
  ONBOARDING_MANAGE_TEMPLATES: 'onboarding:manage_templates',

  // Documents
  DOCUMENT_VIEW_OWN: 'document:view_own',
  DOCUMENT_VIEW_ALL: 'document:view_all',
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_MANAGE: 'document:manage',

  // Payroll
  PAYROLL_VIEW_OWN: 'payroll:view_own',
  PAYROLL_VIEW_ALL: 'payroll:view_all',
  PAYROLL_MANAGE: 'payroll:manage',
  PAYROLL_APPROVE: 'payroll:approve',

  // Notifications
  NOTIFICATION_VIEW_OWN: 'notification:view_own',

  // Audit
  AUDIT_VIEW: 'audit:view',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * Role-to-permission mapping.
 */
const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),

  HR_ADMIN: [
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_EDIT,
    PERMISSIONS.ORG_MANAGE_SETTINGS,
    PERMISSIONS.ORG_MANAGE_MEMBERS,
    PERMISSIONS.ORG_INVITE,
    PERMISSIONS.EMPLOYEE_VIEW_ALL,
    PERMISSIONS.EMPLOYEE_VIEW_OWN,
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_EDIT,
    PERMISSIONS.EMPLOYEE_ARCHIVE,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.DEPARTMENT_MANAGE,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_MANAGE_TYPES,
    PERMISSIONS.LEAVE_MANAGE_POLICIES,
    PERMISSIONS.ATTENDANCE_VIEW_OWN,
    PERMISSIONS.ATTENDANCE_VIEW_ALL,
    PERMISSIONS.ATTENDANCE_CLOCK,
    PERMISSIONS.ATTENDANCE_CORRECT,
    PERMISSIONS.ONBOARDING_VIEW_OWN,
    PERMISSIONS.ONBOARDING_MANAGE,
    PERMISSIONS.ONBOARDING_MANAGE_TEMPLATES,
    PERMISSIONS.DOCUMENT_VIEW_OWN,
    PERMISSIONS.DOCUMENT_VIEW_ALL,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_MANAGE,
    PERMISSIONS.PAYROLL_VIEW_OWN,
    PERMISSIONS.PAYROLL_VIEW_ALL,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.NOTIFICATION_VIEW_OWN,
    PERMISSIONS.AUDIT_VIEW,
  ],

  MANAGER: [
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.EMPLOYEE_VIEW_OWN,
    PERMISSIONS.EMPLOYEE_VIEW_TEAM,
    PERMISSIONS.DEPARTMENT_VIEW,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_TEAM,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.ATTENDANCE_VIEW_OWN,
    PERMISSIONS.ATTENDANCE_VIEW_TEAM,
    PERMISSIONS.ATTENDANCE_CLOCK,
    PERMISSIONS.ATTENDANCE_CORRECT,
    PERMISSIONS.ONBOARDING_VIEW_OWN,
    PERMISSIONS.ONBOARDING_MANAGE,
    PERMISSIONS.DOCUMENT_VIEW_OWN,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.PAYROLL_VIEW_OWN,
    PERMISSIONS.NOTIFICATION_VIEW_OWN,
  ],

  EMPLOYEE: [
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.EMPLOYEE_VIEW_OWN,
    PERMISSIONS.LEAVE_VIEW_OWN,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.ATTENDANCE_VIEW_OWN,
    PERMISSIONS.ATTENDANCE_CLOCK,
    PERMISSIONS.ONBOARDING_VIEW_OWN,
    PERMISSIONS.DOCUMENT_VIEW_OWN,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.PAYROLL_VIEW_OWN,
    PERMISSIONS.NOTIFICATION_VIEW_OWN,
  ],
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(
  role: OrgRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(
  role: OrgRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: OrgRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]]
}
