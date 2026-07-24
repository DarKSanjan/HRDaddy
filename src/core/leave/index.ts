/**
 * Leave service — core kernel functions that need dbAdmin access.
 * Module code calls these rather than accessing dbAdmin directly.
 */
import { dbAdmin } from '@/core/db/admin'

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
  balanceId: string | null
) {
  return dbAdmin.$transaction(async (tx) => {
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
  startYear: number
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

    return { alreadyProcessed: false }
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
  startYear: number
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

    return { alreadyProcessed: false }
  })
}

// ─────────────────────────────────────────────
// Withdraw
// ─────────────────────────────────────────────

export async function withdrawLeaveRequestTransaction(
  requestId: string,
  orgId: string,
  employeeId: string
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

    return { failed: false }
  })
}

// ─────────────────────────────────────────────
// Cancel approved
// ─────────────────────────────────────────────

export async function cancelLeaveRequestTransaction(
  requestId: string,
  orgId: string,
  employeeId: string,
  reason: string
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

    return { failed: false }
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
