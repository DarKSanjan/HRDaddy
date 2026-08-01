/**
 * Asset Request module unit tests.
 *
 * Tests state-machine transitions, permission gating, ownership checks,
 * and fulfillment validation (AVAILABLE status + category match).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const REQUEST_ID = 'clreq00000000000000000001'
const ASSET_ID = 'classet00000000000000001'
const EMPLOYEE_ID = 'clemployee000000000000001'
const REVIEWER_EMPLOYEE_ID = 'clreviewer00000000000001'
const CATEGORY_ID = 'clcategory0000000000000001'

const mockRequest = {
  id: REQUEST_ID,
  orgId: 'org-1',
  employeeId: EMPLOYEE_ID,
  categoryId: CATEGORY_ID,
  requestedAssetId: null,
  reason: 'Need a monitor for work',
  status: 'PENDING' as string,
  requestedAt: new Date(),
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  fulfilledAssetId: null,
  employee: { id: EMPLOYEE_ID, firstName: 'Alice', lastName: 'Smith', userId: 'user-employee', managerId: null },
  category: { id: CATEGORY_ID, name: 'Monitor' },
}

const assetRequestFindFirst = vi.fn()
const assetRequestCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: REQUEST_ID,
  ...args.data,
}))
const assetRequestUpdate = vi.fn(async () => ({}))
const assetRequestDelete = vi.fn(async () => ({}))
const assetRequestCount = vi.fn(async () => 0)

const assetFindFirst = vi.fn()
const assetUpdate = vi.fn(async () => ({}))

const assetAssignmentCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: 'assignment-1',
  ...args.data,
}))
const assetAssignmentFindFirst = vi.fn(async () => null)

const categoryFindFirst = vi.fn()
const employeeFindFirst = vi.fn()

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      assetRequest: {
        findFirst: assetRequestFindFirst,
        create: assetRequestCreate,
        update: assetRequestUpdate,
        delete: assetRequestDelete,
        count: assetRequestCount,
      },
      asset: { findFirst: assetFindFirst, findUnique: assetFindFirst, update: assetUpdate },
      assetAssignment: { create: assetAssignmentCreate, findFirst: assetAssignmentFindFirst },
      assetCategory: { findFirst: categoryFindFirst },
      employee: { findFirst: employeeFindFirst },
    })
  ),
}))

vi.mock('@/core/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/core/notifications', () => ({
  getNotificationAdapter: () => ({ send: vi.fn() }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let callerEmployeeId: string | null = REVIEWER_EMPLOYEE_ID

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
  requestAsset,
  cancelAssetRequest,
  approveAssetRequest,
  rejectAssetRequest,
  fulfillAssetRequest,
} from '../actions'

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Asset Requests — state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callerEmployeeId = REVIEWER_EMPLOYEE_ID
    categoryFindFirst.mockResolvedValue({ id: CATEGORY_ID })
  })

  describe('requestAsset', () => {
    it('creates a PENDING request for valid input', async () => {
      callerEmployeeId = EMPLOYEE_ID
      categoryFindFirst.mockResolvedValue({ id: CATEGORY_ID })

      const result = await requestAsset('test', {
        categoryId: CATEGORY_ID,
        reason: 'Need a monitor',
      })

      expect(result.success).toBe(true)
      expect(assetRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org-1',
            employeeId: EMPLOYEE_ID,
            categoryId: CATEGORY_ID,
            reason: 'Need a monitor',
            status: 'PENDING',
          }),
        })
      )
    })

    it('rejects if category not found', async () => {
      callerEmployeeId = EMPLOYEE_ID
      categoryFindFirst.mockResolvedValue(null)

      const result = await requestAsset('test', {
        categoryId: 'nonexistent',
        reason: 'Need something',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('category')
    })

    it('rejects if requested asset is not AVAILABLE', async () => {
      callerEmployeeId = EMPLOYEE_ID
      categoryFindFirst.mockResolvedValue({ id: CATEGORY_ID })
      assetFindFirst.mockResolvedValue({ id: ASSET_ID, status: 'ASSIGNED', categoryId: CATEGORY_ID })

      const result = await requestAsset('test', {
        categoryId: CATEGORY_ID,
        requestedAssetId: ASSET_ID,
        reason: 'Want this specific one',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not currently available')
    })

    it('rejects if no employee record', async () => {
      callerEmployeeId = null

      const result = await requestAsset('test', {
        categoryId: CATEGORY_ID,
        reason: 'Need one',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No employee record')
    })
  })

  describe('cancelAssetRequest', () => {
    it('allows the requester to cancel their own PENDING request', async () => {
      callerEmployeeId = EMPLOYEE_ID
      assetRequestFindFirst.mockResolvedValue({
        id: REQUEST_ID,
        employeeId: EMPLOYEE_ID,
        status: 'PENDING',
      })

      const result = await cancelAssetRequest('test', { requestId: REQUEST_ID })

      expect(result.success).toBe(true)
      expect(assetRequestDelete).toHaveBeenCalled()
    })

    it('rejects cancel if not the requester', async () => {
      callerEmployeeId = REVIEWER_EMPLOYEE_ID
      assetRequestFindFirst.mockResolvedValue({
        id: REQUEST_ID,
        employeeId: EMPLOYEE_ID,
        status: 'PENDING',
      })

      const result = await cancelAssetRequest('test', { requestId: REQUEST_ID })

      expect(result.success).toBe(false)
      expect(result.error).toContain('only cancel your own')
    })

    it('rejects cancel if status is not PENDING', async () => {
      callerEmployeeId = EMPLOYEE_ID
      assetRequestFindFirst.mockResolvedValue({
        id: REQUEST_ID,
        employeeId: EMPLOYEE_ID,
        status: 'APPROVED',
      })

      const result = await cancelAssetRequest('test', { requestId: REQUEST_ID })

      expect(result.success).toBe(false)
      expect(result.error).toContain('no longer pending')
    })
  })

  describe('approveAssetRequest', () => {
    it('transitions PENDING → APPROVED', async () => {
      assetRequestFindFirst.mockResolvedValue({ ...mockRequest, status: 'PENDING' })

      const result = await approveAssetRequest('test', { requestId: REQUEST_ID })

      expect(result.success).toBe(true)
      expect(assetRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      )
    })

    it('rejects if not PENDING', async () => {
      assetRequestFindFirst.mockResolvedValue({ ...mockRequest, status: 'APPROVED' })

      const result = await approveAssetRequest('test', { requestId: REQUEST_ID })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only pending')
    })
  })

  describe('rejectAssetRequest', () => {
    it('transitions PENDING → REJECTED with required note', async () => {
      assetRequestFindFirst.mockResolvedValue({ ...mockRequest, status: 'PENDING' })

      const result = await rejectAssetRequest('test', {
        requestId: REQUEST_ID,
        reviewNote: 'Budget constraints',
      })

      expect(result.success).toBe(true)
      expect(assetRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            reviewNote: 'Budget constraints',
          }),
        })
      )
    })

    it('rejects without a note', async () => {
      const result = await rejectAssetRequest('test', {
        requestId: REQUEST_ID,
        reviewNote: '',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rejection reason is required')
    })

    it('rejects if not PENDING', async () => {
      assetRequestFindFirst.mockResolvedValue({ ...mockRequest, status: 'FULFILLED' })

      const result = await rejectAssetRequest('test', {
        requestId: REQUEST_ID,
        reviewNote: 'Too late',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only pending')
    })
  })

  describe('fulfillAssetRequest', () => {
    it('transitions APPROVED → FULFILLED and assigns asset', async () => {
      assetRequestFindFirst.mockResolvedValue({
        ...mockRequest,
        status: 'APPROVED',
        category: { id: CATEGORY_ID },
        employee: { id: EMPLOYEE_ID, firstName: 'Alice', lastName: 'Smith', userId: 'user-employee' },
      })
      assetFindFirst.mockResolvedValue({
        id: ASSET_ID,
        status: 'AVAILABLE',
        categoryId: CATEGORY_ID,
        name: 'Dell Monitor',
        assetTag: 'MON-001',
      })

      const result = await fulfillAssetRequest('test', {
        requestId: REQUEST_ID,
        assetId: ASSET_ID,
      })

      expect(result.success).toBe(true)
      expect(assetAssignmentCreate).toHaveBeenCalled()
      expect(assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ASSIGNED' }),
        })
      )
      expect(assetRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FULFILLED', fulfilledAssetId: ASSET_ID }),
        })
      )
    })

    it('rejects if asset is not AVAILABLE', async () => {
      assetRequestFindFirst.mockResolvedValue({
        ...mockRequest,
        status: 'APPROVED',
        category: { id: CATEGORY_ID },
        employee: { id: EMPLOYEE_ID, firstName: 'Alice', lastName: 'Smith', userId: 'user-employee' },
      })
      assetFindFirst.mockResolvedValue({
        id: ASSET_ID,
        status: 'ASSIGNED',
        categoryId: CATEGORY_ID,
        name: 'Dell Monitor',
        assetTag: 'MON-001',
      })

      const result = await fulfillAssetRequest('test', {
        requestId: REQUEST_ID,
        assetId: ASSET_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('ASSIGNED')
    })

    it('rejects if asset category does not match request category', async () => {
      assetRequestFindFirst.mockResolvedValue({
        ...mockRequest,
        status: 'APPROVED',
        category: { id: CATEGORY_ID },
        employee: { id: EMPLOYEE_ID, firstName: 'Alice', lastName: 'Smith', userId: 'user-employee' },
      })
      assetFindFirst.mockResolvedValue({
        id: ASSET_ID,
        status: 'AVAILABLE',
        categoryId: 'different-category',
        name: 'MacBook',
        assetTag: 'LAP-001',
      })

      const result = await fulfillAssetRequest('test', {
        requestId: REQUEST_ID,
        assetId: ASSET_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('requested category')
    })

    it('rejects if request is not APPROVED', async () => {
      assetRequestFindFirst.mockResolvedValue({
        ...mockRequest,
        status: 'PENDING',
        category: { id: CATEGORY_ID },
        employee: { id: EMPLOYEE_ID, firstName: 'Alice', lastName: 'Smith', userId: 'user-employee' },
      })

      const result = await fulfillAssetRequest('test', {
        requestId: REQUEST_ID,
        assetId: ASSET_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only approved')
    })
  })
})
