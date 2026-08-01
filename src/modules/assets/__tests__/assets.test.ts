/**
 * Asset module unit tests.
 *
 * Tests state-machine transitions, permission gating, and category CRUD.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ASSET_ID = 'classet00000000000000001'
const EMPLOYEE_ID = 'clemployee000000000000001'
const ASSIGNER_EMPLOYEE_ID = 'classigner00000000000001'
const ASSIGNMENT_ID = 'classignment0000000000001'

const mockAsset = {
  id: ASSET_ID,
  orgId: 'org-1',
  categoryId: 'cat-1',
  name: 'MacBook Pro 16',
  assetTag: 'IT-LAP-001',
  status: 'AVAILABLE' as string,
  purchaseDate: null,
  purchaseValueCents: null,
  notes: null,
  currentAssignmentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const assetFindFirst = vi.fn()
const assetCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: ASSET_ID,
  ...args.data,
}))
const assetUpdate = vi.fn(async () => ({}))
const assetCount = vi.fn(async () => 0)

const assignmentFindFirst = vi.fn()
const assignmentCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: ASSIGNMENT_ID,
  ...args.data,
}))
const assignmentUpdate = vi.fn(async () => ({}))

const categoryFindFirst = vi.fn()
const categoryCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: 'cat-new',
  ...args.data,
}))
const categoryUpdate = vi.fn(async () => ({}))

const employeeFindFirst = vi.fn(async () => ({
  id: EMPLOYEE_ID,
  firstName: 'Alice',
  lastName: 'Smith',
  userId: 'user-employee',
}))

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      asset: { findFirst: assetFindFirst, findUnique: assetFindFirst, create: assetCreate, update: assetUpdate, count: assetCount },
      assetAssignment: { findFirst: assignmentFindFirst, create: assignmentCreate, update: assignmentUpdate },
      assetCategory: { findFirst: categoryFindFirst, create: categoryCreate, update: categoryUpdate },
      employee: { findFirst: employeeFindFirst },
    })
  ),
}))

vi.mock('@/core/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/core/notifications', () => ({
  getNotificationAdapter: () => ({ send: vi.fn() }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let callerEmployeeId: string | null = ASSIGNER_EMPLOYEE_ID

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: ['employees', 'assets'],
    membership: { id: 'mem-1', role: 'OWNER', isActive: true },
  })),
  requirePermission: vi.fn(async () => ({ userId: 'user-1', role: 'OWNER' })),
  verifySession: vi.fn(async () => ({ userId: 'user-1', email: 'test@test.com', name: 'Test' })),
}))

vi.mock('@/core/permissions', () => ({
  hasPermission: vi.fn(() => true),
}))

vi.mock('@/core/employees', () => ({
  getEmployeeIdForUser: vi.fn(async () => callerEmployeeId),
}))

import {
  createAssetCategory,
  updateAssetCategory,
  createAsset,
  assignAsset,
  returnAsset,
  markAssetInMaintenance,
  markAssetAvailable,
  retireAsset,
  reportAssetLost,
} from '../actions'

describe('Asset Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callerEmployeeId = ASSIGNER_EMPLOYEE_ID
    // Default: asset.findFirst returns a valid asset (AVAILABLE)
    assetFindFirst.mockImplementation(async () => ({ ...mockAsset }))
    // Default: no open assignment found
    assignmentFindFirst.mockImplementation(async () => null)
    // Default: category exists
    categoryFindFirst.mockImplementation(async () => ({ id: 'cat-1', name: 'Laptops', isArchived: false }))
  })

  // ─────────────────────────────────────────────
  // Category CRUD
  // ─────────────────────────────────────────────

  describe('createAssetCategory', () => {
    it('creates a category with valid input', async () => {
      const result = await createAssetCategory('test', { name: 'Laptops' })
      expect(result.success).toBe(true)
      expect(categoryCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Laptops' }) })
      )
    })

    it('rejects empty name', async () => {
      const result = await createAssetCategory('test', { name: '' })
      expect(result.success).toBe(false)
      expect(result.fieldErrors?.name).toBeDefined()
    })
  })

  describe('updateAssetCategory', () => {
    it('updates a category name', async () => {
      const result = await updateAssetCategory('test', { categoryId: 'cat-1', name: 'New Name' })
      expect(result.success).toBe(true)
      expect(categoryUpdate).toHaveBeenCalled()
    })

    it('returns error for missing category', async () => {
      categoryFindFirst.mockImplementation(async () => null)
      const result = await updateAssetCategory('test', { categoryId: 'nonexistent', name: 'X' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not found/i)
    })
  })

  // ─────────────────────────────────────────────
  // Asset CRUD
  // ─────────────────────────────────────────────

  describe('createAsset', () => {
    it('creates an asset with valid input', async () => {
      // asset.findFirst for tag uniqueness check returns null (no duplicate)
      assetFindFirst.mockImplementation(async () => null)
      const result = await createAsset('test', {
        categoryId: 'cat-1',
        name: 'MacBook Pro',
        assetTag: 'IT-001',
      })
      expect(result.success).toBe(true)
      expect(assetCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'MacBook Pro', assetTag: 'IT-001', status: 'AVAILABLE' }),
        })
      )
    })

    it('rejects duplicate asset tag', async () => {
      // asset.findFirst for tag uniqueness check returns existing
      assetFindFirst.mockImplementation(async () => ({ id: 'existing' }))
      const result = await createAsset('test', {
        categoryId: 'cat-1',
        name: 'MacBook Pro',
        assetTag: 'IT-001',
      })
      expect(result.success).toBe(false)
      expect(result.fieldErrors?.assetTag).toMatch(/already in use/i)
    })
  })

  // ─────────────────────────────────────────────
  // State machine: assignAsset
  // ─────────────────────────────────────────────

  describe('assignAsset', () => {
    it('assigns an AVAILABLE asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))
      assignmentFindFirst.mockImplementation(async () => null)

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })
      expect(result.success).toBe(true)
      expect(assignmentCreate).toHaveBeenCalled()
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ASSIGNED' }),
        })
      )
    })

    it('rejects assigning an ASSIGNED asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED' }))

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/ASSIGNED/)
      expect(assignmentCreate).not.toHaveBeenCalled()
    })

    it('rejects assigning an IN_MAINTENANCE asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'IN_MAINTENANCE' }))

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/IN_MAINTENANCE/)
    })

    it('rejects assigning a RETIRED asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'RETIRED' }))

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/RETIRED/)
    })

    it('rejects when caller has no employee record', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))
      callerEmployeeId = null

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/no employee record/i)
    })
  })

  // ─────────────────────────────────────────────
  // State machine: returnAsset
  // ─────────────────────────────────────────────

  describe('returnAsset', () => {
    it('returns an ASSIGNED asset to AVAILABLE', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED', currentAssignmentId: ASSIGNMENT_ID }))
      assignmentFindFirst.mockImplementation(async () => ({ id: ASSIGNMENT_ID }))

      const result = await returnAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
      expect(assignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ returnedAt: expect.any(Date) }),
        })
      )
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'AVAILABLE', currentAssignmentId: null }),
        })
      )
    })

    it('returns an ASSIGNED asset to IN_MAINTENANCE when requested', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED', currentAssignmentId: ASSIGNMENT_ID }))
      assignmentFindFirst.mockImplementation(async () => ({ id: ASSIGNMENT_ID }))

      const result = await returnAsset('test', { assetId: ASSET_ID, returnToMaintenance: true })
      expect(result.success).toBe(true)
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'IN_MAINTENANCE' }),
        })
      )
    })

    it('rejects returning an AVAILABLE asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))

      const result = await returnAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/AVAILABLE/)
    })

    it('rejects when no open assignment exists', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED' }))
      assignmentFindFirst.mockImplementation(async () => null)

      const result = await returnAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/no open assignment/i)
    })
  })

  // ─────────────────────────────────────────────
  // State machine: markAssetInMaintenance
  // ─────────────────────────────────────────────

  describe('markAssetInMaintenance', () => {
    it('marks an AVAILABLE asset as IN_MAINTENANCE', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))

      const result = await markAssetInMaintenance('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'IN_MAINTENANCE' }),
        })
      )
    })

    it('rejects on ASSIGNED asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED' }))

      const result = await markAssetInMaintenance('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/ASSIGNED/)
    })
  })

  // ─────────────────────────────────────────────
  // State machine: markAssetAvailable
  // ─────────────────────────────────────────────

  describe('markAssetAvailable', () => {
    it('marks an IN_MAINTENANCE asset as AVAILABLE', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'IN_MAINTENANCE' }))

      const result = await markAssetAvailable('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'AVAILABLE' }),
        })
      )
    })

    it('rejects on AVAILABLE asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))

      const result = await markAssetAvailable('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/AVAILABLE/)
    })
  })

  // ─────────────────────────────────────────────
  // State machine: retireAsset
  // ─────────────────────────────────────────────

  describe('retireAsset', () => {
    it('retires an AVAILABLE asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))

      const result = await retireAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RETIRED' }),
        })
      )
    })

    it('retires an IN_MAINTENANCE asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'IN_MAINTENANCE' }))

      const result = await retireAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
    })

    it('rejects retiring an ASSIGNED asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED' }))

      const result = await retireAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/return it first/i)
    })

    it('rejects retiring an already RETIRED asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'RETIRED' }))

      const result = await retireAsset('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
    })
  })

  // ─────────────────────────────────────────────
  // State machine: reportAssetLost
  // ─────────────────────────────────────────────

  describe('reportAssetLost', () => {
    it('marks an AVAILABLE asset as LOST', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'AVAILABLE' }))

      const result = await reportAssetLost('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'LOST' }),
        })
      )
    })

    it('marks an ASSIGNED asset as LOST and closes assignment', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'ASSIGNED' }))
      assignmentFindFirst.mockImplementation(async () => ({ id: ASSIGNMENT_ID }))

      const result = await reportAssetLost('test', { assetId: ASSET_ID })
      expect(result.success).toBe(true)
      expect(assignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conditionAtReturn: 'LOST' }),
        })
      )
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'LOST', currentAssignmentId: null }),
        })
      )
    })

    it('rejects reporting a RETIRED asset as lost', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'RETIRED' }))

      const result = await reportAssetLost('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/RETIRED/)
    })

    it('rejects reporting an already LOST asset', async () => {
      assetFindFirst.mockImplementation(async () => ({ ...mockAsset, status: 'LOST' }))

      const result = await reportAssetLost('test', { assetId: ASSET_ID })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/LOST/)
    })
  })
})
