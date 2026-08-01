import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/core/db/admin', () => ({
  dbAdmin: {
    leaveRequest: { findFirst: vi.fn(), create: vi.fn() },
    leaveBalance: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { dbAdmin } from '@/core/db/admin'
import { createLeaveRequestTransaction, LeaveRequestError } from '@/core/leave'

const mockDbAdmin = dbAdmin as unknown as {
  $transaction: ReturnType<typeof vi.fn>
}

const baseData = {
  orgId: 'org-1',
  employeeId: 'emp-abc',
  leaveTypeId: 'lt-1',
  startDate: new Date('2026-03-10'),
  endDate: new Date('2026-03-12'),
  isHalfDay: false,
  halfDayPeriod: null,
  totalDays: 3,
  reason: null,
}

const mockRequest = { id: 'req-1', ...baseData, status: 'PENDING' }

function makeTx(overrides: {
  findFirst?: unknown
  balanceFindUnique?: unknown
  createResult?: unknown
} = {}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    leaveRequest: {
      findFirst: vi.fn().mockResolvedValue(overrides.findFirst ?? null),
      create: vi.fn().mockResolvedValue(overrides.createResult ?? mockRequest),
    },
    leaveBalance: {
      findUnique: vi.fn().mockResolvedValue(overrides.balanceFindUnique ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDbAdmin.$transaction.mockImplementation(
    (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => fn(makeTx())
  )
})

describe('createLeaveRequestTransaction', () => {
  it('issues an advisory lock before creating the request', async () => {
    let capturedTx!: ReturnType<typeof makeTx>
    mockDbAdmin.$transaction.mockImplementation(
      (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        capturedTx = makeTx()
        return fn(capturedTx)
      }
    )

    await createLeaveRequestTransaction(baseData, null)

    expect(capturedTx.$executeRaw).toHaveBeenCalledOnce()
    // The advisory lock must be acquired before the request is created.
    const lockOrder = capturedTx.$executeRaw.mock.invocationCallOrder[0]
    const createOrder = capturedTx.leaveRequest.create.mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(createOrder)
  })

  it('throws LeaveRequestError("overlap") when inside-transaction overlap check finds a conflict', async () => {
    mockDbAdmin.$transaction.mockImplementation(
      (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
        fn(makeTx({ findFirst: { id: 'existing-req' } }))
    )

    await expect(createLeaveRequestTransaction(baseData, null)).rejects.toSatisfy(
      (e: unknown) => e instanceof LeaveRequestError && (e as LeaveRequestError).reason === 'overlap'
    )
  })

  it('does not create the request when the overlap re-check fails', async () => {
    let capturedTx!: ReturnType<typeof makeTx>
    mockDbAdmin.$transaction.mockImplementation(
      (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        capturedTx = makeTx({ findFirst: { id: 'existing-req' } })
        return fn(capturedTx)
      }
    )

    await expect(createLeaveRequestTransaction(baseData, null)).rejects.toBeInstanceOf(LeaveRequestError)
    expect(capturedTx.leaveRequest.create).not.toHaveBeenCalled()
  })

  it('throws LeaveRequestError("insufficient_balance") when balance re-check fails', async () => {
    const tightBalance = {
      id: 'bal-1',
      allowance: 5,
      used: 3,
      pending: 1,
      // available = 5 - 3 - 1 = 1, but totalDays = 3
    }
    mockDbAdmin.$transaction.mockImplementation(
      (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
        fn(makeTx({ balanceFindUnique: tightBalance }))
    )

    await expect(
      createLeaveRequestTransaction({ ...baseData, totalDays: 3 }, 'bal-1')
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof LeaveRequestError && (e as LeaveRequestError).reason === 'insufficient_balance'
    )
  })

  it('does not create the request when the balance re-check fails', async () => {
    const tightBalance = { id: 'bal-1', allowance: 5, used: 3, pending: 1 }
    let capturedTx!: ReturnType<typeof makeTx>
    mockDbAdmin.$transaction.mockImplementation(
      (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        capturedTx = makeTx({ balanceFindUnique: tightBalance })
        return fn(capturedTx)
      }
    )

    await expect(
      createLeaveRequestTransaction({ ...baseData, totalDays: 3 }, 'bal-1')
    ).rejects.toBeInstanceOf(LeaveRequestError)
    expect(capturedTx.leaveRequest.create).not.toHaveBeenCalled()
  })

  it('creates the request and updates balance when both checks pass', async () => {
    const goodBalance = { id: 'bal-1', allowance: 14, used: 3, pending: 1 }
    let capturedTx!: ReturnType<typeof makeTx>
    mockDbAdmin.$transaction.mockImplementation(
      (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        capturedTx = makeTx({ balanceFindUnique: goodBalance, createResult: mockRequest })
        return fn(capturedTx)
      }
    )

    const result = await createLeaveRequestTransaction(baseData, 'bal-1')

    expect(result).toEqual(mockRequest)
    expect(capturedTx.leaveRequest.create).toHaveBeenCalledOnce()
    expect(capturedTx.leaveBalance.update).toHaveBeenCalledOnce()
  })
})
