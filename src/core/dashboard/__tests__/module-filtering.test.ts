/**
 * Integration test: a disabled module's widget neither renders nor queries.
 * Also tests that all registered widgets are properly filtered.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveWidgets, registerWidget, _resetWidgets } from '@/core/dashboard'
import { registerPermissions, _resetPermissions } from '@/core/permissions'

function MockWidget() {
  return null
}

describe('Widget module filtering (integration)', () => {
  beforeEach(() => {
    _resetWidgets()
    _resetPermissions()

    // Register full permission set as in production
    registerPermissions('employees', [
      { key: 'employee.view_all', description: '', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'employee.view_own', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])
    registerPermissions('leave', [
      { key: 'leave.request.create', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { key: 'leave.request.approve', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER'] },
      { key: 'leave.balance.view_own', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { key: 'leave.balance.view_all', description: '', defaultRoles: ['OWNER', 'HR_ADMIN'] },
    ])
    registerPermissions('attendance', [
      { key: 'attendance.view_all', description: '', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'attendance.clock', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])
    registerPermissions('onboarding', [
      { key: 'onboarding.view_all', description: '', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'onboarding.complete_task', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])
    registerPermissions('documents', [
      { key: 'document.view_all', description: '', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'document.view_own', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])
    registerPermissions('payroll', [
      { key: 'payroll.process', description: '', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'payroll.view_own', description: '', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])

    // Register full widget set
    registerWidget({ id: 'active-employees', moduleId: 'employees', title: '', roles: ['owner', 'manager'], size: 'sm', priority: 10, component: MockWidget })
    registerWidget({ id: 'present-today', moduleId: 'attendance', title: '', permission: 'attendance.view_all', roles: ['owner', 'manager'], size: 'sm', priority: 20, component: MockWidget })
    registerWidget({ id: 'on-leave-today', moduleId: 'leave', title: '', permission: 'leave.balance.view_all', roles: ['owner', 'manager'], size: 'sm', priority: 30, component: MockWidget })
    registerWidget({ id: 'pending-leave', moduleId: 'leave', title: '', permission: 'leave.request.approve', roles: ['owner', 'manager'], size: 'sm', priority: 40, component: MockWidget })
    registerWidget({ id: 'overdue-onboarding', moduleId: 'onboarding', title: '', permission: 'onboarding.view_all', roles: ['owner'], size: 'sm', priority: 50, component: MockWidget })
    registerWidget({ id: 'expiring-docs', moduleId: 'documents', title: '', permission: 'document.view_all', roles: ['owner'], size: 'sm', priority: 60, component: MockWidget })
    registerWidget({ id: 'payroll-status', moduleId: 'payroll', title: '', permission: 'payroll.process', roles: ['owner'], size: 'sm', priority: 70, component: MockWidget })
    registerWidget({ id: 'employee-balance', moduleId: 'leave', title: '', permission: 'leave.balance.view_own', roles: ['employee'], size: 'md', priority: 10, component: MockWidget })
    registerWidget({ id: 'employee-onboarding', moduleId: 'onboarding', title: '', permission: 'onboarding.complete_task', roles: ['employee'], size: 'md', priority: 20, component: MockWidget })
  })

  it('org with all modules enabled shows all owner widgets', () => {
    const allModules = ['employees', 'leave', 'attendance', 'onboarding', 'documents', 'payroll']
    const widgets = resolveWidgets('OWNER', allModules)

    expect(widgets.map((w) => w.id)).toEqual([
      'active-employees',
      'present-today',
      'on-leave-today',
      'pending-leave',
      'overdue-onboarding',
      'expiring-docs',
      'payroll-status',
    ])
  })

  it('org with only employees module shows minimal dashboard', () => {
    const widgets = resolveWidgets('OWNER', ['employees'])
    expect(widgets.map((w) => w.id)).toEqual(['active-employees'])
  })

  it('disabling leave hides leave-related widgets', () => {
    const modules = ['employees', 'attendance', 'onboarding', 'documents', 'payroll']
    const widgets = resolveWidgets('OWNER', modules)

    const leaveWidgetIds = widgets.filter((w) => w.moduleId === 'leave').map((w) => w.id)
    expect(leaveWidgetIds).toEqual([])
  })

  it('disabling payroll hides payroll widget', () => {
    const modules = ['employees', 'leave', 'attendance', 'onboarding', 'documents']
    const widgets = resolveWidgets('OWNER', modules)

    expect(widgets.find((w) => w.id === 'payroll-status')).toBeUndefined()
  })

  it('employee only sees employee widgets for enabled modules', () => {
    const allModules = ['employees', 'leave', 'attendance', 'onboarding', 'documents', 'payroll']
    const widgets = resolveWidgets('EMPLOYEE', allModules)

    expect(widgets.map((w) => w.id)).toEqual(['employee-balance', 'employee-onboarding'])
  })

  it('employee with onboarding disabled does not see onboarding widget', () => {
    const modules = ['employees', 'leave', 'attendance', 'documents', 'payroll']
    const widgets = resolveWidgets('EMPLOYEE', modules)

    expect(widgets.map((w) => w.id)).toEqual(['employee-balance'])
  })

  it('manager sees manager widgets scoped by permission', () => {
    const allModules = ['employees', 'leave', 'attendance', 'onboarding', 'documents', 'payroll']
    const widgets = resolveWidgets('MANAGER', allModules)

    // Manager sees: active-employees, on-leave-today (has leave.balance.view_all? No — manager doesn't have view_all)
    // Manager has: leave.request.approve → pending-leave
    // Manager doesn't have: attendance.view_all → no present-today
    // Manager doesn't have: leave.balance.view_all → no on-leave-today
    expect(widgets.map((w) => w.id)).toEqual(['active-employees', 'pending-leave'])
  })
})
