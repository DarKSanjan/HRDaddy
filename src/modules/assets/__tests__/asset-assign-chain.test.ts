import { describe, it, expect, vi, beforeEach } from 'vitest'

const ASSET_ID = 'classet00000000000000001'
const EMPLOYEE_ID = 'clemployee000000000000001'
const PIC_EMPLOYEE_ID = 'clpic0000000000000000001'
const MANAGER_L1_ID = 'clmgr1000000000000000001'
const MANAGER_L2_ID = 'clmgr2000000000000000001'
const SIBLING_EMPLOYEE_ID = 'clsibling000000000000001'
const ASSIGNER_EMPLOYEE_ID = 'classigner00000000000001'
const ASSIGNMENT_ID = 'classignment0000000000001'

const mockEmployeeChain: Record<string, { id: string; managerId: string | null }> = {
  [PIC_EMPLOYEE_ID]: { id: PIC_EMPLOYEE_ID, managerId: MANAGER_L1_ID },
  [MANAGER_L1_ID]: { id: MANAGER_L1_ID, managerId: MANAGER_L2_ID },
  [MANAGER_L2_ID]: { id: MANAGER_L2_ID, managerId: null },
  [SIBLING_EMPLOYEE_ID]: { id: SIBLING_EMPLOYEE_ID, managerId: MANAGER_L1_ID },
}

const assetFindFirst = vi.fn()
const assetUpdate = vi.fn(async () => ({}))
const assignmentCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: ASSIGNMENT_ID,
  ...args.data,
}))
const assignmentFindFirst = vi.fn(async () => null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const employeeFindFirst = vi.fn(async (args: any) => {
  const id = args?.where?.id
  if (!id) return null
  return mockEmployeeChain[id] ?? null
})

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({
      asset: { findFirst: assetFindFirst, update: assetUpdate },
      assetAssignment: { create: assignmentCreate, findFirst: assignmentFindFirst },
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
let mockRole = 'EMPLOYEE' as string
let mockEnabledModules = ['employees', 'assets']

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: mockEnabledModules,
    membership: { id: 'mem-1', role: mockRole, isActive: true },
  })),
  requirePermission: vi.fn(async () => ({ userId: 'user-1', role: mockRole })),
  verifySession: vi.fn(async () => ({ userId: 'user-1', email: 'test@test.com', name: 'Test' })),
}))

vi.mock('@/core/permissions', () => ({
  hasPermission: vi.fn((role: string) => role === 'OWNER' || role === 'HR_ADMIN'),
}))

vi.mock('@/core/employees', () => ({
  getEmployeeIdForUser: vi.fn(async () => callerEmployeeId),
}))

import { assignAsset } from '../actions'
import { isInAssetAssignChain } from '../queries'

describe('Asset Person-in-Charge Chain Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callerEmployeeId = ASSIGNER_EMPLOYEE_ID
    mockRole = 'EMPLOYEE'
    mockEnabledModules = ['employees', 'assets']

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employeeFindFirst.mockImplementation(async (args: any) => {
      const id = args?.where?.id
      if (!id) return null
      return mockEmployeeChain[id] ?? null
    })
  })

  describe('isInAssetAssignChain', () => {
    it('returns true when caller IS the person in charge', async () => {
      const result = await isInAssetAssignChain('user-1', 'org-1', PIC_EMPLOYEE_ID, PIC_EMPLOYEE_ID)
      expect(result).toBe(true)
    })

    it('returns true when caller is a direct manager of person in charge', async () => {
      const result = await isInAssetAssignChain('user-1', 'org-1', PIC_EMPLOYEE_ID, MANAGER_L1_ID)
      expect(result).toBe(true)
    })

    it('returns true when caller is a manager 2 levels up', async () => {
      const result = await isInAssetAssignChain('user-1', 'org-1', PIC_EMPLOYEE_ID, MANAGER_L2_ID)
      expect(result).toBe(true)
    })

    it('returns false for a sibling employee not in the chain', async () => {
      const result = await isInAssetAssignChain('user-1', 'org-1', PIC_EMPLOYEE_ID, SIBLING_EMPLOYEE_ID)
      expect(result).toBe(false)
    })

    it('returns false when personInChargeId does not exist', async () => {
      const result = await isInAssetAssignChain('user-1', 'org-1', 'nonexistent-id', MANAGER_L1_ID)
      expect(result).toBe(false)
    })
  })
  describe('assignAsset — person in charge can assign without role permission', () => {
    beforeEach(() => {
      assetFindFirst.mockResolvedValue({
        id: ASSET_ID,
        status: 'AVAILABLE',
        name: 'Test Laptop',
        assetTag: 'LAP-001',
        personInChargeId: PIC_EMPLOYEE_ID,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employeeFindFirst.mockImplementation(async (args: any) => {
        const id = args?.where?.id
        if (!id) return null
        if (id === EMPLOYEE_ID) return { id: EMPLOYEE_ID, firstName: 'Alice', lastName: 'Smith', userId: 'user-employee', managerId: null }
        return mockEmployeeChain[id] ?? null
      })
    })

    it('person in charge themselves can assign even without asset.assign role', async () => {
      callerEmployeeId = PIC_EMPLOYEE_ID
      mockRole = 'EMPLOYEE'

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })

      expect(result.success).toBe(true)
    })

    it('manager 2+ levels up the chain can assign', async () => {
      callerEmployeeId = MANAGER_L2_ID
      mockRole = 'EMPLOYEE'

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })

      expect(result.success).toBe(true)
    })

    it('sibling/unrelated employee without asset.assign cannot assign', async () => {
      callerEmployeeId = SIBLING_EMPLOYEE_ID
      mockRole = 'EMPLOYEE'

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('do not have permission')
    })

    it('user WITH asset.assign role permission can still assign regardless of chain', async () => {
      callerEmployeeId = SIBLING_EMPLOYEE_ID
      mockRole = 'OWNER'

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })

      expect(result.success).toBe(true)
    })

    it('personInChargeId unset (null) — non-role-permission users cannot assign', async () => {
      assetFindFirst.mockResolvedValue({
        id: ASSET_ID,
        status: 'AVAILABLE',
        name: 'Test Laptop',
        assetTag: 'LAP-001',
        personInChargeId: null,
      })
      callerEmployeeId = PIC_EMPLOYEE_ID
      mockRole = 'EMPLOYEE'

      const result = await assignAsset('test', {
        assetId: ASSET_ID,
        employeeId: EMPLOYEE_ID,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('do not have permission')
    })
  })
})
