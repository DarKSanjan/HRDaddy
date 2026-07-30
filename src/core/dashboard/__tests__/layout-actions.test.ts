/**
 * Tests for dashboard layout server actions.
 * Mocking pattern mirrors import-actions.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const { findUnique, upsert, deleteMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    dashboardLayout: { findUnique, upsert, deleteMany },
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/core/auth', () => ({
  verifySession: vi.fn(async () => ({
    userId: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
  })),
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    membership: { id: 'mem-1', role: 'EMPLOYEE', isActive: true },
    enabledModules: ['employees'],
  })),
}))

import {
  getDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
} from '../layout-actions'

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('getDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for a user with no saved layout', async () => {
    findUnique.mockResolvedValue(null)

    const result = await getDashboardLayout('test-org')

    expect(result.success).toBe(true)
    expect(result.layout).toBeNull()
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_orgId: { userId: 'user-1', orgId: 'org-1' } },
      select: { layout: true },
    })
  })

  it('returns the saved layout', async () => {
    const savedLayout = { widgets: [{ id: 'w1', hidden: false }] }
    findUnique.mockResolvedValue({ layout: savedLayout })

    const result = await getDashboardLayout('test-org')

    expect(result.success).toBe(true)
    expect(result.layout).toEqual(savedLayout)
  })
})

describe('saveDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsert.mockResolvedValue({})
  })

  it('upserts a valid layout', async () => {
    const widgets = [
      { id: 'widget-a', hidden: false },
      { id: 'widget-b', hidden: true },
    ]

    const result = await saveDashboardLayout('test-org', widgets)

    expect(result.success).toBe(true)
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_orgId: { userId: 'user-1', orgId: 'org-1' } },
      create: {
        userId: 'user-1',
        orgId: 'org-1',
        layout: { widgets },
      },
      update: {
        layout: { widgets },
      },
    })
  })

  it('rejects invalid input — empty widget id', async () => {
    const widgets = [{ id: '', hidden: false }]

    const result = await saveDashboardLayout('test-org', widgets)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid layout data.')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejects invalid input — missing hidden field', async () => {
    const widgets = [{ id: 'widget-a' }] as unknown as Array<{ id: string; hidden: boolean }>

    const result = await saveDashboardLayout('test-org', widgets)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid layout data.')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejects invalid input — not an array', async () => {
    const widgets = { id: 'widget-a', hidden: false } as unknown as Array<{ id: string; hidden: boolean }>

    const result = await saveDashboardLayout('test-org', widgets)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid layout data.')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejects input exceeding max length (100)', async () => {
    const widgets = Array.from({ length: 101 }, (_, i) => ({
      id: `widget-${i}`,
      hidden: false,
    }))

    const result = await saveDashboardLayout('test-org', widgets)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid layout data.')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('accepts exactly 100 widgets', async () => {
    const widgets = Array.from({ length: 100 }, (_, i) => ({
      id: `widget-${i}`,
      hidden: false,
    }))

    const result = await saveDashboardLayout('test-org', widgets)

    expect(result.success).toBe(true)
    expect(upsert).toHaveBeenCalled()
  })
})

describe('resetDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteMany.mockResolvedValue({ count: 1 })
  })

  it('deletes the user layout row', async () => {
    const result = await resetDashboardLayout('test-org')

    expect(result.success).toBe(true)
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', orgId: 'org-1' },
    })
  })

  it('succeeds even if no row existed', async () => {
    deleteMany.mockResolvedValue({ count: 0 })

    const result = await resetDashboardLayout('test-org')

    expect(result.success).toBe(true)
  })
})
