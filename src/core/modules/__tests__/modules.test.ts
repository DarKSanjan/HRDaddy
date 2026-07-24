/**
 * Module dependency resolution tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  defineModule,
  enableModule,
  disableModule,
  getAllModules,
  _resetModules,
} from '@/core/modules'
import { _resetPermissions } from '@/core/permissions'

// Mock dbAdmin for module tests
vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    organisationModule: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('Module Registry', () => {
  beforeEach(() => {
    _resetModules()
    _resetPermissions()
  })

  it('defineModule registers a module', () => {
    defineModule({
      id: 'test-module',
      name: 'Test',
      version: '1.0.0',
      description: 'A test module',
      dependsOn: [],
      permissions: [],
      nav: [],
    })

    expect(getAllModules()).toHaveLength(1)
    expect(getAllModules()[0].id).toBe('test-module')
  })

  it('enableModule fails when dependency is not enabled', async () => {
    defineModule({
      id: 'base',
      name: 'Base',
      version: '1.0.0',
      description: 'Base module',
      dependsOn: [],
      permissions: [],
      nav: [],
    })

    defineModule({
      id: 'dependent',
      name: 'Dependent',
      version: '1.0.0',
      description: 'Depends on base',
      dependsOn: ['base'],
      permissions: [],
      nav: [],
    })

    // base is not enabled for this org
    const { dbAdmin } = await import('@/core/db/admin')
    vi.mocked(dbAdmin.organisationModule.findMany).mockResolvedValue([])

    await expect(
      enableModule('org-1', 'dependent', { orgId: 'org-1', userId: 'user-1' })
    ).rejects.toThrow("Cannot enable 'dependent': dependency 'base' is not enabled")
  })

  it('enableModule succeeds when dependencies are met', async () => {
    defineModule({
      id: 'base',
      name: 'Base',
      version: '1.0.0',
      description: 'Base module',
      dependsOn: [],
      required: true,
      permissions: [],
      nav: [],
    })

    defineModule({
      id: 'dependent',
      name: 'Dependent',
      version: '1.0.0',
      description: 'Depends on base',
      dependsOn: ['base'],
      permissions: [],
      nav: [],
    })

    // base is required (always enabled)
    const { dbAdmin } = await import('@/core/db/admin')
    vi.mocked(dbAdmin.organisationModule.findMany).mockResolvedValue([])
    vi.mocked(dbAdmin.organisationModule.upsert).mockResolvedValue({} as never)

    await expect(
      enableModule('org-1', 'dependent', { orgId: 'org-1', userId: 'user-1' })
    ).resolves.toBeUndefined()
  })

  it('disableModule fails for a required module', async () => {
    defineModule({
      id: 'employees',
      name: 'Employees',
      version: '1.0.0',
      description: 'Core module',
      dependsOn: [],
      required: true,
      permissions: [],
      nav: [],
    })

    await expect(
      disableModule('org-1', 'employees', { orgId: 'org-1', userId: 'user-1' })
    ).rejects.toThrow('Cannot disable required module: employees')
  })

  it('disableModule fails when another module depends on it', async () => {
    defineModule({
      id: 'base',
      name: 'Base',
      version: '1.0.0',
      description: 'Base module',
      dependsOn: [],
      permissions: [],
      nav: [],
    })

    defineModule({
      id: 'dependent',
      name: 'Dependent',
      version: '1.0.0',
      description: 'Depends on base',
      dependsOn: ['base'],
      permissions: [],
      nav: [],
    })

    const { dbAdmin } = await import('@/core/db/admin')
    // dependent is enabled for this org
    vi.mocked(dbAdmin.organisationModule.findMany).mockResolvedValue([
      { moduleId: 'dependent' } as never,
    ])

    await expect(
      disableModule('org-1', 'base', { orgId: 'org-1', userId: 'user-1' })
    ).rejects.toThrow("Cannot disable 'base': module 'dependent' depends on it")
  })
})
