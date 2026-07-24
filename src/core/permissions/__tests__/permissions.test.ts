/**
 * Permission resolution tests, including the disabled-module case for OWNER.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerPermissions,
  resolvePermissions,
  hasPermission,
  _resetPermissions,
} from '@/core/permissions'

describe('Permissions', () => {
  beforeEach(() => {
    _resetPermissions()
  })

  it('resolves permissions for a role from enabled modules', () => {
    registerPermissions('employees', [
      { key: 'employee.view_all', description: 'View all', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'employee.view_own', description: 'View own', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])

    const perms = resolvePermissions('EMPLOYEE', ['employees'])
    expect(perms.has('employee.view_own')).toBe(true)
    expect(perms.has('employee.view_all')).toBe(false)
  })

  it('OWNER gets all permissions from enabled modules', () => {
    registerPermissions('employees', [
      { key: 'employee.view_all', description: 'View all', defaultRoles: ['OWNER', 'HR_ADMIN'] },
      { key: 'employee.create', description: 'Create', defaultRoles: ['OWNER', 'HR_ADMIN'] },
    ])

    const perms = resolvePermissions('OWNER', ['employees'])
    expect(perms.has('employee.view_all')).toBe(true)
    expect(perms.has('employee.create')).toBe(true)
  })

  it('permissions from disabled modules are NEVER granted, even for OWNER', () => {
    registerPermissions('leave', [
      { key: 'leave.approve', description: 'Approve leave', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER'] },
    ])
    registerPermissions('employees', [
      { key: 'employee.view_own', description: 'View own', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])

    // Only 'employees' is enabled, not 'leave'
    const enabledModules = ['employees']

    expect(hasPermission('OWNER', enabledModules, 'leave.approve')).toBe(false)
    expect(hasPermission('OWNER', enabledModules, 'employee.view_own')).toBe(true)
  })

  it('hasPermission returns false for unknown keys', () => {
    registerPermissions('employees', [
      { key: 'employee.view_own', description: 'View own', defaultRoles: ['OWNER'] },
    ])

    expect(hasPermission('OWNER', ['employees'], 'nonexistent.key')).toBe(false)
  })

  it('resolves permissions across multiple enabled modules', () => {
    registerPermissions('employees', [
      { key: 'employee.view_own', description: 'View own', defaultRoles: ['EMPLOYEE'] },
    ])
    registerPermissions('leave', [
      { key: 'leave.request', description: 'Request leave', defaultRoles: ['EMPLOYEE'] },
    ])

    const perms = resolvePermissions('EMPLOYEE', ['employees', 'leave'])
    expect(perms.has('employee.view_own')).toBe(true)
    expect(perms.has('leave.request')).toBe(true)
  })
})
