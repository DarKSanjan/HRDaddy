/**
 * Leave service — core kernel functions that need dbAdmin access.
 * Module code calls these rather than accessing dbAdmin directly.
 */
import { Prisma } from '@prisma/client'
import { dbAdmin } from '@/core/db/admin'

type LeaveAuditCallback<T> = (
  tx: Prisma.TransactionClient,
  result: T
) => Promise<void>

// ─────────────────────────────────────────────
// Typed errors for the create path
// ─────────────────────────────────────────────

export class LeaveRequestError extends Error {
  constructor(
    public readonly reason: 'overlap' | 'insufficient_balance',
    message: string
  ) {
    super(message)
    this.name = 'LeaveRequestError'
  }
}

// ─────────────────────────────────────────────
// Balance checks
// ─────────────────────────────────────────────

export async function getLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number
) {
  return dbAdmin.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
    },
  })
}

// ─────────────────────────────────────────────
// Overlap detection
// ─────────────────────────────────────────────

export async function findOverlappingRequest(
  orgId: string,
  employeeId: string,
  startDate: Date,
  endDate: Date
) {
  return dbAdmin.leaveRequest.findFirst({
    where: {
      orgId,
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  })
}

// ─────────────────────────────────────────────
// Create request + update balance (transactional)
// ─────────────────────────────────────────────

export interface CreateLeaveRequestData {
  orgId: string
  employeeId: string
  leaveTypeId: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
  halfDayPeriod: string | null
  totalDays: number
  reason: string | null
}

export async function createLeaveRequestTransaction(
  data: CreateLeaveRequestData,
  balanceId: string | null,
  audit?: LeaveAuditCallback<{ id: string }>
) {
  return dbAdmin.$transaction(async (tx) => {
    // Serialize all concurrent submissions for the same employee so the
    // overlap and balance re-checks below are race-free. hashtext() is used
    // because pg_advisory_xact_lock takes a bigint but employeeId is a cuid
    // string. The lock is released automatically when the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.employeeId}))`

    const overlap = await tx.leaveRequest.findFirst({
      where: {
        orgId: data.orgId,
        employeeId: data.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: data.endDate },
        endDate: { gte: data.startDate },
      },
    })
    if (overlap) {
      throw new LeaveRequestError('overlap', 'Overlapping leave request exists.')
    }

    const freshBalance = balanceId
      ? await tx.leaveBalance.findUnique({ where: { id: balanceId } })
      : null

    if (freshBalance) {
      const available =
        Number(freshBalance.allowance) -
        Number(freshBalance.used) -
        Number(freshBalance.pending)
      if (available < data.totalDays) {
        throw new LeaveRequestError(
          'insufficient_balance',
          'Insufficient balance for the requested dates.'
        )
      }
    }

    const newRequest = await tx.leaveRequest.create({
      data: {
        orgId: data.orgId,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        isHalfDay: data.isHalfDay,
        halfDayPeriod: data.halfDayPeriod,
        totalDays: data.totalDays,
        reason: data.reason,
        status: 'PENDING',
      },
    })

    if (balanceId) {
      await tx.leaveBalance.update({
        where: { id: balanceId },
        data: { pending: { increment: data.totalDays } },
      })
    }

    if (audit) await audit(tx, newRequest)

    return newRequest
  })
}

// ─────────────────────────────────────────────
// Approval (idempotent under concurrency)
// ─────────────────────────────────────────────

export async function approveLeaveRequestTransaction(
  requestId: string,
  orgId: string,
  approverEmployeeId: string | null,
  note: string | null,
  totalDays: number,
  employeeId: string,
  leaveTypeId: string,
  startYear: number,
  audit?: LeaveAuditCallback<{ alreadyProcessed: boolean }>
): Promise<{ alreadyProcessed: boolean }> {
  return dbAdmin.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.updateMany({
      where: { id: requestId, orgId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedById: approverEmployeeId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    })

    if (updated.count === 0) {
      return { alreadyProcessed: true }
    }

    await tx.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId, year: startYear },
      data: {
        pending: { decrement: totalDays },
        used: { increment: totalDays },
      },
    })

    const result = { alreadyProcessed: false }
    if (audit) await audit(tx, result)
    return result
  })
}

// ─────────────────────────────────────────────
// Rejection
// ─────────────────────────────────────────────

export async function rejectLeaveRequestTransaction(
  requestId: string,
  orgId: string,
  approverEmployeeId: string | null,
  reason: string,
  totalDays: number,
  employeeId: string,
  leaveTypeId: string,
  startYear: number,
  audit?: LeaveAuditCallback<{ alreadyProcessed: boolean }>
): Promise<{ alreadyProcessed: boolean }> {
  return dbAdmin.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.updateMany({
      where: { id: requestId, orgId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedById: approverEmployeeId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    })

    if (updated.count === 0) {
      return { alreadyProcessed: true }
    }

    await tx.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId, year: startYear },
      data: { pending: { decrement: totalDays } },
    })

    const result = { alreadyProcessed: false }
    if (audit) await audit(tx, result)
    return result
  })
}

// ─────────────────────────────────────────────
// Withdraw
// ─────────────────────────────────────────────

export async function withdrawLeaveRequestTransaction(
  requestId: string,
  orgId: string,
  employeeId: string,
  audit?: LeaveAuditCallback<{ failed: boolean }>
): Promise<{ failed: boolean }> {
  return dbAdmin.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.updateMany({
      where: { id: requestId, orgId, employeeId, status: 'PENDING' },
      data: { status: 'WITHDRAWN' },
    })

    if (updated.count === 0) {
      return { failed: true }
    }

    const req = await tx.leaveRequest.findUnique({
      where: { id: requestId },
      select: { totalDays: true, leaveTypeId: true, startDate: true },
    })
    if (req) {
      await tx.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: req.leaveTypeId, year: req.startDate.getFullYear() },
        data: { pending: { decrement: Number(req.totalDays) } },
      })
    }

    const result = { failed: false }
    if (audit) await audit(tx, result)
    return result
  })
}

// ─────────────────────────────────────────────
// Cancel approved
// ─────────────────────────────────────────────

export async function cancelLeaveRequestTransaction(
  requestId: string,
  orgId: string,
  employeeId: string,
  reason: string,
  audit?: LeaveAuditCallback<{ failed: boolean }>
): Promise<{ failed: boolean }> {
  return dbAdmin.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.updateMany({
      where: { id: requestId, orgId, employeeId, status: 'APPROVED' },
      data: { status: 'CANCELLED', reviewNote: reason },
    })

    if (updated.count === 0) {
      return { failed: true }
    }

    const req = await tx.leaveRequest.findUnique({
      where: { id: requestId },
      select: { totalDays: true, leaveTypeId: true, startDate: true },
    })
    if (req) {
      await tx.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: req.leaveTypeId, year: req.startDate.getFullYear() },
        data: { used: { decrement: Number(req.totalDays) } },
      })
    }

    const result = { failed: false }
    if (audit) await audit(tx, result)
    return result
  })
}

// ─────────────────────────────────────────────
// Get request with employee details
// ─────────────────────────────────────────────

export async function getLeaveRequestWithEmployee(orgId: string, requestId: string) {
  return dbAdmin.leaveRequest.findFirst({
    where: { id: requestId, orgId },
    include: {
      employee: { select: { managerId: true, userId: true, firstName: true, lastName: true } },
    },
  })
}

export async function getEmployeeWithManager(employeeId: string) {
  return dbAdmin.employee.findUnique({
    where: { id: employeeId },
    select: { managerId: true, firstName: true, lastName: true, manager: { select: { userId: true } } },
  })
}
