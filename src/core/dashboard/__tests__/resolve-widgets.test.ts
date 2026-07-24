/**
 * Tests for the dashboard kernel: widget resolution by role, module, permission.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveWidgets, registerWidget, _resetWidgets } from '@/core/dashboard'
import { registerPermissions, _resetPermissions } from '@/core/permissions'

// Mock component for testing
function MockWidget() {
  return null
}

describe('Dashboard kernel', () => {
  beforeEach(() => {
    _resetWidgets()
    _resetPermissions()

    // Register test permissions
    registerPermissions('employees', [
      { key: 'employee.view_all', description: 'View all', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'employee.view_own', description: 'View own', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])
    registerPermissions('leave', [
      { key: 'leave.request.approve', description: 'Approve', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER'] },
      { key: 'leave.balance.view_own', description: 'View own balance', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])
    registerPermissions('attendance', [
      { key: 'attendance.view_all', description: 'View all', defaultRoles: ['OWNER', 'HR_ADMIN'] },
    ])
  })

  it('returns widgets for owner role filtered by enabled modules', () => {
    registerWidget({
      id: 'active-employees',
      moduleId: 'employees',
      title: 'Active Employees',
      roles: ['owner'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })
    registerWidget({
      id: 'attendance-chart',
      moduleId: 'attendance',
      title: 'Attendance',
      permission: 'attendance.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 20,
      component: MockWidget,
    })

    // With attendance enabled
    const withAttendance = resolveWidgets('OWNER', ['employees', 'attendance'])
    expect(withAttendance).toHaveLength(2)
    expect(withAttendance.map((w) => w.id)).toEqual(['active-employees', 'attendance-chart'])

    // Without attendance enabled — widget excluded
    const withoutAttendance = resolveWidgets('OWNER', ['employees'])
    expect(withoutAttendance).toHaveLength(1)
    expect(withoutAttendance[0].id).toBe('active-employees')
  })

  it('disabled module widget does not appear', () => {
    registerWidget({
      id: 'leave-widget',
      moduleId: 'leave',
      title: 'Leave',
      permission: 'leave.request.approve',
      roles: ['owner'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })

    const result = resolveWidgets('OWNER', ['employees'])
    expect(result).toHaveLength(0)
  })

  it('filters by viewer role — manager sees manager widgets only', () => {
    registerWidget({
      id: 'owner-only',
      moduleId: 'employees',
      title: 'Owner Only',
      roles: ['owner'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })
    registerWidget({
      id: 'manager-widget',
      moduleId: 'employees',
      title: 'Manager Widget',
      roles: ['manager'],
      size: 'sm',
      priority: 20,
      component: MockWidget,
    })

    const ownerResult = resolveWidgets('OWNER', ['employees'])
    expect(ownerResult.map((w) => w.id)).toEqual(['owner-only'])

    const managerResult = resolveWidgets('MANAGER', ['employees'])
    expect(managerResult.map((w) => w.id)).toEqual(['manager-widget'])
  })

  it('employee only sees employee-targeted widgets', () => {
    registerWidget({
      id: 'employee-balance',
      moduleId: 'leave',
      title: 'Balance',
      permission: 'leave.balance.view_own',
      roles: ['employee'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })
    registerWidget({
      id: 'owner-chart',
      moduleId: 'employees',
      title: 'Headcount',
      permission: 'employee.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 20,
      component: MockWidget,
    })

    const result = resolveWidgets('EMPLOYEE', ['employees', 'leave'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('employee-balance')
  })

  it('permission check prevents widget from appearing', () => {
    registerWidget({
      id: 'admin-only',
      moduleId: 'attendance',
      title: 'Admin Attendance',
      permission: 'attendance.view_all',
      roles: ['manager'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })

    // MANAGER does not have attendance.view_all
    const result = resolveWidgets('MANAGER', ['employees', 'attendance'])
    expect(result).toHaveLength(0)
  })

  it('sorts widgets by priority', () => {
    registerWidget({
      id: 'low-priority',
      moduleId: 'employees',
      title: 'Low',
      roles: ['owner'],
      size: 'sm',
      priority: 100,
      component: MockWidget,
    })
    registerWidget({
      id: 'high-priority',
      moduleId: 'employees',
      title: 'High',
      roles: ['owner'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })
    registerWidget({
      id: 'mid-priority',
      moduleId: 'employees',
      title: 'Mid',
      roles: ['owner'],
      size: 'sm',
      priority: 50,
      component: MockWidget,
    })

    const result = resolveWidgets('OWNER', ['employees'])
    expect(result.map((w) => w.id)).toEqual(['high-priority', 'mid-priority', 'low-priority'])
  })

  it('HR_ADMIN sees owner-role widgets', () => {
    registerWidget({
      id: 'owner-widget',
      moduleId: 'employees',
      title: 'Owner Widget',
      roles: ['owner'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })

    const result = resolveWidgets('HR_ADMIN', ['employees'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('owner-widget')
  })

  it('widget with no permission check appears if role matches', () => {
    registerWidget({
      id: 'no-perm',
      moduleId: 'employees',
      title: 'No Perm',
      roles: ['owner', 'manager', 'employee'],
      size: 'md',
      priority: 10,
      component: MockWidget,
    })

    expect(resolveWidgets('OWNER', ['employees'])).toHaveLength(1)
    expect(resolveWidgets('MANAGER', ['employees'])).toHaveLength(1)
    expect(resolveWidgets('EMPLOYEE', ['employees'])).toHaveLength(1)
  })
})
