/**
 * Expense module unit tests.
 *
 * Tests permission gating, status transitions, self-approval prevention,
 * and that reject requires a reason.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CLAIM_ID = 'clclaim00000000000000001'
const EMPLOYEE_ID = 'clemployee000000000000001'
const MANAGER_EMPLOYEE_ID = 'clmanager0000000000000001'

const mockClaim = {
  id: CLAIM_ID,
  orgId: 'org-1',
  employeeId: EMPLOYEE_ID,
  categoryId: 'cat-1',
  amountCents: 5000,
  currency: 'SGD',
  description: 'Lunch with client',
  expenseDate: new Date('2026-07-01'),
  status: 'SUBMITTED' as string,
  receiptDocumentId: null,
  submittedAt: new Date(),
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  reimbursedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  employee: {
    id: EMPLOYEE_ID,
    firstName: 'Alice',
    lastName: 'Smith',
    userId: 'user-employee',
    managerId: MANAGER_EMPLOYEE_ID,
  },
}

const findFirst = vi.fn()
const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: CLAIM_ID,
  ...args.data,
}))
const update = vi.fn(async () => ({}))
const updateMany = vi.fn(async () => ({ count: 1 }))
const deleteFn = vi.fn(async () => ({}))

const { createReceiptDocument } = vi.hoisted(() => ({
  createReceiptDocument: vi.fn(async () => 'doc-1'),
}))

const storageUpload = vi.fn(async () => undefined)
const storageDelete = vi.fn(async () => undefined)

vi.mock('@/modules/register', () => ({}))

vi.mock('@/core/db', () => ({
  dbAs: vi.fn(async (_userId: string, fn: (tx: unknown) => unknown) =>
    fn({
      expenseClaim: { findFirst, create, update, updateMany, delete: deleteFn },
      expenseCategory: { findFirst: vi.fn(async () => ({ id: 'cat-1' })), create: vi.fn() },
      employeeDocument: { findFirst: vi.fn(async () => null) },
      employee: {
        findFirst: vi.fn(async () => ({
          firstName: 'Alice',
          lastName: 'Smith',
          manager: { userId: 'user-manager' },
        })),
      },
    })
  ),
}))

vi.mock('@/core/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/core/documents/receipts', () => ({ createReceiptDocument }))
vi.mock('@/core/notifications', () => ({
  getNotificationAdapter: () => ({ send: vi.fn() }),
}))
vi.mock('@/core/storage', () => ({
  getStorage: vi.fn(async () => ({ upload: storageUpload, delete: storageDelete })),
  buildStorageKey: vi.fn((orgId: string, employeeId: string, fileId: string) => `${orgId}/${employeeId}/${fileId}`),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let currentRole = 'OWNER'
let callerEmployeeId: string | null = MANAGER_EMPLOYEE_ID

vi.mock('@/core/auth', () => ({
  getOrgContext: vi.fn(async () => ({
    org: { id: 'org-1', name: 'Test', slug: 'test' },
    enabledModules: ['employees', 'expenses'],
    membership: { id: 'mem-1', role: currentRole, isActive: true },
  })),
  requirePermission: vi.fn(async () => ({ userId: 'user-1', role: currentRole })),
  verifySession: vi.fn(async () => ({ userId: 'user-1', email: 'test@test.com', name: 'Test' })),
}))

vi.mock('@/core/employees', () => ({
  getEmployeeIdForUser: vi.fn(async () => callerEmployeeId),
  getOrgSettings: vi.fn(async () => ({ timezone: 'Asia/Singapore', currency: 'SGD', workingDays: [1, 2, 3, 4, 5] })),
}))

import {
  submitExpenseClaim,
  approveExpenseClaim,
  rejectExpenseClaim,
  withdrawExpenseClaim,
  markExpenseReimbursed,
  uploadExpenseReceipt,
} from '../actions'

describe('Expense Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'OWNER'
    callerEmployeeId = MANAGER_EMPLOYEE_ID
    findFirst.mockImplementation(async () => ({ ...mockClaim }))
  })

  describe('submitExpenseClaim', () => {
    it('creates a SUBMITTED claim with valid input', async () => {
      callerEmployeeId = EMPLOYEE_ID
      const formData = new FormData()
      formData.set('categoryId', 'cat-1')
      formData.set('amountCents', '5000')
      formData.set('currency', 'SGD')
      formData.set('description', 'Lunch')
      formData.set('expenseDate', '2026-07-01')

      const result = await submitExpenseClaim('test', formData)
      expect(result.success).toBe(true)
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED',
            amountCents: 5000,
          }),
        })
      )
    })

    it('returns error when employee record is missing', async () => {
      callerEmployeeId = null
      const formData = new FormData()
      formData.set('categoryId', 'cat-1')
      formData.set('amountCents', '5000')
      formData.set('currency', 'SGD')
      formData.set('description', 'Lunch')
      formData.set('expenseDate', '2026-07-01')

      const result = await submitExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/no employee record/i)
    })
  })

  describe('approveExpenseClaim', () => {
    it('approves a SUBMITTED claim', async () => {
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await approveExpenseClaim('test', formData)
      expect(result.success).toBe(true)
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: CLAIM_ID, status: 'SUBMITTED' }),
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      )
    })

    it('rejects approval of own claim', async () => {
      callerEmployeeId = EMPLOYEE_ID
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await approveExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/cannot approve your own/i)
      expect(updateMany).not.toHaveBeenCalled()
    })

    it('rejects when the claim was already reviewed concurrently', async () => {
      updateMany.mockResolvedValueOnce({ count: 0 })
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await approveExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/already reviewed/i)
    })

    it('rejects approval of non-SUBMITTED claim', async () => {
      findFirst.mockImplementation(async () => ({ ...mockClaim, status: 'APPROVED' }))
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await approveExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/only submitted/i)
    })

    it('manager cannot approve claims from non-direct-reports', async () => {
      currentRole = 'MANAGER'
      // claim's managerId is MANAGER_EMPLOYEE_ID, but caller is a different manager
      callerEmployeeId = 'some-other-manager'
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await approveExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/direct reports/i)
    })
  })

  describe('rejectExpenseClaim', () => {
    it('rejects a SUBMITTED claim with a reason', async () => {
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)
      formData.set('reason', 'Missing receipt')

      const result = await rejectExpenseClaim('test', formData)
      expect(result.success).toBe(true)
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: CLAIM_ID, status: 'SUBMITTED' }),
          data: expect.objectContaining({
            status: 'REJECTED',
            reviewNotes: 'Missing receipt',
          }),
        })
      )
    })

    it('requires a reason for rejection', async () => {
      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)
      formData.set('reason', '')

      const result = await rejectExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/reason.*required/i)
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('withdrawExpenseClaim', () => {
    it('allows employee to withdraw own SUBMITTED claim', async () => {
      callerEmployeeId = EMPLOYEE_ID
      findFirst.mockImplementation(async () => ({
        id: CLAIM_ID,
        status: 'SUBMITTED',
      }))

      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await withdrawExpenseClaim('test', formData)
      expect(result.success).toBe(true)
      expect(deleteFn).toHaveBeenCalled()
    })

    it('rejects withdrawal of already-reviewed claim', async () => {
      callerEmployeeId = EMPLOYEE_ID
      findFirst.mockImplementation(async () => ({
        id: CLAIM_ID,
        status: 'APPROVED',
      }))

      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await withdrawExpenseClaim('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/already been reviewed/i)
    })
  })

  describe('uploadExpenseReceipt', () => {
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3])

    it('uploads a valid receipt via the dbAdmin-backed receipt helper', async () => {
      callerEmployeeId = EMPLOYEE_ID

      const result = await uploadExpenseReceipt(
        'test',
        { fileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: pdfBuffer.length },
        pdfBuffer
      )

      expect(result.success).toBe(true)
      expect(storageUpload).toHaveBeenCalled()
      expect(createReceiptDocument).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: EMPLOYEE_ID, mimeType: 'application/pdf' })
      )
    })

    it('rejects a disallowed file type', async () => {
      callerEmployeeId = EMPLOYEE_ID
      const result = await uploadExpenseReceipt(
        'test',
        { fileName: 'malware.exe', mimeType: 'application/x-msdownload', fileSize: pdfBuffer.length },
        pdfBuffer
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not allowed/i)
      expect(storageUpload).not.toHaveBeenCalled()
    })

    it('rejects a file over the size limit', async () => {
      callerEmployeeId = EMPLOYEE_ID
      const result = await uploadExpenseReceipt(
        'test',
        { fileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 26 * 1024 * 1024 },
        pdfBuffer
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/25MB/i)
      expect(storageUpload).not.toHaveBeenCalled()
    })

    it('rejects content that does not match its declared type', async () => {
      callerEmployeeId = EMPLOYEE_ID
      const notAPdf = new Uint8Array([0, 0, 0, 0])
      const result = await uploadExpenseReceipt(
        'test',
        { fileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: notAPdf.length },
        notAPdf
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/does not match/i)
      expect(storageUpload).not.toHaveBeenCalled()
    })
  })

  describe('markExpenseReimbursed', () => {
    it('marks an APPROVED claim as REIMBURSED', async () => {
      findFirst.mockImplementation(async () => ({
        ...mockClaim,
        status: 'APPROVED',
        employee: { userId: 'user-employee', firstName: 'Alice', lastName: 'Smith' },
      }))

      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await markExpenseReimbursed('test', formData)
      expect(result.success).toBe(true)
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REIMBURSED' }),
        })
      )
    })

    it('rejects reimbursement of non-APPROVED claim', async () => {
      findFirst.mockImplementation(async () => ({
        ...mockClaim,
        status: 'SUBMITTED',
        employee: { userId: 'user-employee', firstName: 'Alice', lastName: 'Smith' },
      }))

      const formData = new FormData()
      formData.set('claimId', CLAIM_ID)

      const result = await markExpenseReimbursed('test', formData)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/only approved/i)
    })
  })
})
