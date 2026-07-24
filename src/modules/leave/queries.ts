/**
 * Leave module queries — data fetching with role-scoped access.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { LeaveRequestStatus } from '@prisma/client'
import type { LeaveListParams, LeaveCalendarParams } from './schemas'
import { ensureLeaveBalances } from '@/core/leave/balances'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LeaveTypeItem {
  id: string
  name: string
  color: string
  requiresApproval: boolean
  requiresDocument: boolean
}

export interface LeaveBalanceItem {
  id: string
  leaveTypeId: string
  leaveTypeName: string
  leaveTypeColor: string
  year: number
  allowance: number
  used: number
  pending: number
  available: number
}

export interface LeaveRequestItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  leaveTypeId: string
  leaveTypeName: string
  leaveTypeColor: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
  halfDayPeriod: string | null
  totalDays: number
  reason: string | null
  status: LeaveRequestStatus
  reviewedById: string | null
  reviewedAt: Date | null
  reviewNote: string | null
  createdAt: Date
}

export interface LeaveCalendarEntry {
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  leaveTypeName: string
  leaveTypeColor: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
  halfDayPeriod: string | null
  status: LeaveRequestStatus
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

/**
 * List leave types for an organisation.
 */
export async function listLeaveTypes(
  userId: string,
  orgId: string
): Promise<LeaveTypeItem[]> {
  return dbAs(userId, async (tx) => {
    const types = await tx.leaveType.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        requiresApproval: true,
        requiresDocument: true,
      },
    })
    return types
  })
}

/**
 * Get leave balances for a specific employee.
 */
export async function getEmployeeBalances(
  userId: string,
  orgId: string,
  employeeId: string,
  year?: number
): Promise<LeaveBalanceItem[]> {
  const targetYear = year ?? new Date().getFullYear()

  return dbAs(userId, async (tx) => {
    // Provision on first read. Balances are otherwise never created — an
    // employee added after org setup, or a new leave year starting, would
    // leave the employee with no rows at all and no way to request leave.
    // ensureLeaveBalances is idempotent and only restates the allowance, so
    // it is safe on every read.
    await ensureLeaveBalances(tx, orgId, employeeId, targetYear)

    const balances = await tx.leaveBalance.findMany({
      where: { orgId, employeeId, year: targetYear },
      include: { leaveType: { select: { name: true, color: true } } },
      orderBy: { leaveType: { name: 'asc' } },
    })

    return balances.map((b) => ({
      id: b.id,
      leaveTypeId: b.leaveTypeId,
      leaveTypeName: b.leaveType.name,
      leaveTypeColor: b.leaveType.color,
      year: b.year,
      allowance: Number(b.allowance),
      used: Number(b.used),
      pending: Number(b.pending),
      available: Number(b.allowance) - Number(b.used) - Number(b.pending),
    }))
  })
}

// getEmployeeIdForUser is in @/core/employees

/**
 * List leave requests for the current user's own requests.
 */
export async function listOwnLeaveRequests(
  userId: string,
  orgId: string,
  employeeId: string,
  params: LeaveListParams
): Promise<{ requests: LeaveRequestItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      employeeId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.leaveTypeId ? { leaveTypeId: params.leaveTypeId } : {}),
    }

    const [requests, total] = await Promise.all([
      tx.leaveRequest.findMany({
        where,
        include: {
          leaveType: { select: { name: true, color: true } },
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.leaveRequest.count({ where }),
    ])

    return {
      requests: requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeFirstName: r.employee.firstName,
        employeeLastName: r.employee.lastName,
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: r.leaveType.name,
        leaveTypeColor: r.leaveType.color,
        startDate: r.startDate,
        endDate: r.endDate,
        isHalfDay: r.isHalfDay,
        halfDayPeriod: r.halfDayPeriod,
        totalDays: Number(r.totalDays),
        reason: r.reason,
        status: r.status,
        reviewedById: r.reviewedById,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
      })),
      total,
    }
  })
}

/**
 * List pending leave requests for a manager's direct reports.
 */
export async function listTeamPendingRequests(
  userId: string,
  orgId: string,
  managerEmployeeId: string
): Promise<LeaveRequestItem[]> {
  return dbAs(userId, async (tx) => {
    const requests = await tx.leaveRequest.findMany({
      where: {
        orgId,
        status: 'PENDING',
        employee: { managerId: managerEmployeeId },
      },
      include: {
        leaveType: { select: { name: true, color: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return requests.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      leaveTypeId: r.leaveTypeId,
      leaveTypeName: r.leaveType.name,
      leaveTypeColor: r.leaveType.color,
      startDate: r.startDate,
      endDate: r.endDate,
      isHalfDay: r.isHalfDay,
      halfDayPeriod: r.halfDayPeriod,
      totalDays: Number(r.totalDays),
      reason: r.reason,
      status: r.status,
      reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
    }))
  })
}

/**
 * List all leave requests (for HR Admin / Owner).
 */
export async function listAllLeaveRequests(
  userId: string,
  orgId: string,
  params: LeaveListParams
): Promise<{ requests: LeaveRequestItem[]; total: number }> {
  return dbAs(userId, async (tx) => {
    const where = {
      orgId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.leaveTypeId ? { leaveTypeId: params.leaveTypeId } : {}),
    }

    const [requests, total] = await Promise.all([
      tx.leaveRequest.findMany({
        where,
        include: {
          leaveType: { select: { name: true, color: true } },
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.leaveRequest.count({ where }),
    ])

    return {
      requests: requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeFirstName: r.employee.firstName,
        employeeLastName: r.employee.lastName,
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: r.leaveType.name,
        leaveTypeColor: r.leaveType.color,
        startDate: r.startDate,
        endDate: r.endDate,
        isHalfDay: r.isHalfDay,
        halfDayPeriod: r.halfDayPeriod,
        totalDays: Number(r.totalDays),
        reason: r.reason,
        status: r.status,
        reviewedById: r.reviewedById,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
      })),
      total,
    }
  })
}

/**
 * Get team leave calendar entries for a month.
 */
export async function getTeamLeaveCalendar(
  userId: string,
  orgId: string,
  managerEmployeeId: string | null,
  params: LeaveCalendarParams
): Promise<LeaveCalendarEntry[]> {
  return dbAs(userId, async (tx) => {
    const startOfMonth = new Date(params.year, params.month - 1, 1)
    const endOfMonth = new Date(params.year, params.month, 0, 23, 59, 59)

    const where = {
      orgId,
      status: { in: ['APPROVED', 'PENDING'] as LeaveRequestStatus[] },
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
      ...(managerEmployeeId
        ? { employee: { managerId: managerEmployeeId } }
        : {}),
    }

    const requests = await tx.leaveRequest.findMany({
      where,
      include: {
        leaveType: { select: { name: true, color: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    return requests.map((r) => ({
      employeeId: r.employee.id,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      leaveTypeName: r.leaveType.name,
      leaveTypeColor: r.leaveType.color,
      startDate: r.startDate,
      endDate: r.endDate,
      isHalfDay: r.isHalfDay,
      halfDayPeriod: r.halfDayPeriod,
      status: r.status,
    }))
  })
}

/**
 * Get a single leave request by ID.
 */
export async function getLeaveRequest(
  userId: string,
  orgId: string,
  requestId: string
): Promise<LeaveRequestItem | null> {
  return dbAs(userId, async (tx) => {
    const r = await tx.leaveRequest.findFirst({
      where: { id: requestId, orgId },
      include: {
        leaveType: { select: { name: true, color: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    })

    if (!r) return null

    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeFirstName: r.employee.firstName,
      employeeLastName: r.employee.lastName,
      leaveTypeId: r.leaveTypeId,
      leaveTypeName: r.leaveType.name,
      leaveTypeColor: r.leaveType.color,
      startDate: r.startDate,
      endDate: r.endDate,
      isHalfDay: r.isHalfDay,
      halfDayPeriod: r.halfDayPeriod,
      totalDays: Number(r.totalDays),
      reason: r.reason,
      status: r.status,
      reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
    }
  })
}
