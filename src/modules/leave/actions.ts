'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Leave module server actions.
 * Every mutation:
 *   1. Resolves org from slug
 *   2. Checks permission
 *   3. Validates input with Zod
 *   4. Performs mutation via core service (which uses dbAdmin internally)
 *   5. Writes audit entry
 *   6. Revalidates cache
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission, verifySession } from '@/core/auth'
import { writeAudit } from '@/core/audit'
import { getNotificationAdapter } from '@/core/notifications'
import { getEmployeeIdForUser, getOrgSettings } from '@/core/employees'
import { calculateLeaveDays } from '@/core/calendar'
import { getHolidaysForDateRange } from '@/modules/calendar/queries'
import {
  getLeaveBalance,
  isLeaveTypeTracked,
  findOverlappingRequest,
  createLeaveRequestTransaction,
  approveLeaveRequestTransaction,
  rejectLeaveRequestTransaction,
  withdrawLeaveRequestTransaction,
  cancelLeaveRequestTransaction,
  getLeaveRequestWithEmployee,
  getEmployeeWithManager,
  LeaveRequestError,
  type LeaveBalanceAllocation,
} from '@/core/leave'
import {
  createLeaveRequestSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  withdrawLeaveSchema,
  cancelLeaveSchema,
} from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  data?: unknown
}

// ─────────────────────────────────────────────
// Balance allocation across a year boundary
//
// A request can span Dec 31 -> Jan 1; each calendar year's portion must be
// deducted from that year's own LeaveBalance row. Recomputes the same
// deterministic split (via calculateLeaveDays over the org's calendar
// settings/holidays) at every mutation point — create, approve, reject,
// withdraw, cancel — so the allocation used to reverse a change always
// matches the one used to apply it, without persisting the split anywhere.
// ─────────────────────────────────────────────

async function resolveLeaveBalanceAllocations(
  orgId: string,
  userId: string,
  employeeId: string,
  leaveTypeId: string,
  startDate: Date,
  endDate: Date,
  totalDays: number
): Promise<{ balanceId: string; days: number; available: number }[]> {
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  if (startYear === endYear) {
    const balance = await getLeaveBalance(employeeId, leaveTypeId, startYear)
    if (!balance) {
      if (await isLeaveTypeTracked(orgId, leaveTypeId)) {
        throw new LeaveRequestError(
          'balance_not_configured',
          `No leave balance has been set up for ${startYear} yet. Contact HR.`
        )
      }
      return []
    }
    const available = Number(balance.allowance) - Number(balance.used) - Number(balance.pending)
    return [{ balanceId: balance.id, days: totalDays, available }]
  }

  const settings = await getOrgSettings(orgId)
  const calendarSettings = {
    timezone: settings?.timezone ?? 'UTC',
    workingDays: (settings?.workingDays as number[]) ?? [1, 2, 3, 4, 5],
  }
  const startOfRange = new Date(Date.UTC(startYear, 0, 1))
  const endOfRange = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59))
  const holidayRows = await getHolidaysForDateRange(userId, orgId, startOfRange, endOfRange)
  const holidays = holidayRows.map((h) => ({
    date: `${h.date.getUTCFullYear()}-${String(h.date.getUTCMonth() + 1).padStart(2, '0')}-${String(h.date.getUTCDate()).padStart(2, '0')}`,
    name: h.name,
  }))

  const daysInStartYear = calculateLeaveDays(
    startDate,
    new Date(Date.UTC(startYear, 11, 31)),
    false,
    calendarSettings,
    holidays
  )
  const daysInEndYear = calculateLeaveDays(
    new Date(Date.UTC(endYear, 0, 1)),
    endDate,
    false,
    calendarSettings,
    holidays
  )

  const allocations: { balanceId: string; days: number; available: number }[] = []
  const tracked = (daysInStartYear > 0 || daysInEndYear > 0)
    ? await isLeaveTypeTracked(orgId, leaveTypeId)
    : false

  if (daysInStartYear > 0) {
    const startBalance = await getLeaveBalance(employeeId, leaveTypeId, startYear)
    if (startBalance) {
      allocations.push({
        balanceId: startBalance.id,
        days: daysInStartYear,
        available: Number(startBalance.allowance) - Number(startBalance.used) - Number(startBalance.pending),
      })
    } else if (tracked) {
      throw new LeaveRequestError(
        'balance_not_configured',
        `No leave balance has been set up for ${startYear} yet. Contact HR.`
      )
    }
  }

  if (daysInEndYear > 0) {
    const endBalance = await getLeaveBalance(employeeId, leaveTypeId, endYear)
    if (endBalance) {
      allocations.push({
        balanceId: endBalance.id,
        days: daysInEndYear,
        available: Number(endBalance.allowance) - Number(endBalance.used) - Number(endBalance.pending),
      })
    } else if (tracked) {
      throw new LeaveRequestError(
        'balance_not_configured',
        `No leave balance has been set up for ${endYear} yet. Contact HR.`
      )
    }
  }

  return allocations
}

// ─────────────────────────────────────────────
// Submit leave request
// ─────────────────────────────────────────────

export async function submitLeaveRequest(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  await requirePermission(org.id, 'leave.request.create')
  const session = await verifySession()
  const userId = session.userId

  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found for your account.' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = createLeaveRequestSchema.safeParse({
    ...raw,
    isHalfDay: raw.isHalfDay === 'true',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const input = parsed.data

  const settings = await getOrgSettings(org.id)
  if (!settings) {
    return { success: false, error: 'Organisation settings not configured.' }
  }

  const workingDays = settings.workingDays as number[]
  const calendarSettings = { timezone: settings.timezone, workingDays }

  const startYear = new Date(input.startDate).getFullYear()
  const endYear = new Date(input.endDate).getFullYear()
  const startOfRange = new Date(Date.UTC(startYear, 0, 1))
  const endOfRange = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59))
  const holidayRows = await getHolidaysForDateRange(userId, org.id, startOfRange, endOfRange)
  const holidays = holidayRows.map((h) => ({
    date: `${h.date.getUTCFullYear()}-${String(h.date.getUTCMonth() + 1).padStart(2, '0')}-${String(h.date.getUTCDate()).padStart(2, '0')}`,
    name: h.name,
  }))

  const totalDays = calculateLeaveDays(
    input.startDate,
    input.endDate,
    input.isHalfDay,
    calendarSettings,
    holidays
  )

  if (totalDays <= 0) {
    return { success: false, error: 'The selected date range contains no working days.' }
  }

  // Check for overlaps
  const overlapping = await findOverlappingRequest(
    org.id,
    employeeId,
    new Date(input.startDate),
    new Date(input.endDate)
  )
  if (overlapping) {
    return { success: false, error: 'You already have a pending or approved leave request for overlapping dates.' }
  }

  // Check balance (per-year allocation, in case the range crosses Dec 31 -> Jan 1)
  let allocations: Awaited<ReturnType<typeof resolveLeaveBalanceAllocations>>
  try {
    allocations = await resolveLeaveBalanceAllocations(
      org.id,
      userId,
      employeeId,
      input.leaveTypeId,
      new Date(input.startDate),
      new Date(input.endDate),
      totalDays
    )
  } catch (err) {
    if (err instanceof LeaveRequestError && err.reason === 'balance_not_configured') {
      return { success: false, error: err.message }
    }
    throw err
  }

  for (const alloc of allocations) {
    if (alloc.available < alloc.days) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${alloc.available} days, Requested: ${alloc.days} days.`,
      }
    }
  }

  const balanceAllocations: LeaveBalanceAllocation[] = allocations.map((a) => ({
    balanceId: a.balanceId,
    days: a.days,
  }))

  let request: Awaited<ReturnType<typeof createLeaveRequestTransaction>>
  try {
    request = await createLeaveRequestTransaction(
      {
        orgId: org.id,
        employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        isHalfDay: input.isHalfDay,
        halfDayPeriod: input.isHalfDay ? (input.halfDayPeriod ?? null) : null,
        totalDays,
        reason: input.reason || null,
      },
      balanceAllocations,
      async (tx, createdRequest) => writeAudit({
        orgId: org.id,
        actorId: userId,
        action: 'leave.request.create',
        targetType: 'leave_request',
        targetId: createdRequest.id,
        after: { totalDays, startDate: input.startDate, endDate: input.endDate },
      }, tx)
    )
  } catch (err) {
    if (err instanceof LeaveRequestError) {
      if (err.reason === 'overlap') {
        return { success: false, error: 'You already have a pending or approved leave request for overlapping dates.' }
      }
      if (err.reason === 'insufficient_balance') {
        return { success: false, error: 'Insufficient balance for the requested dates.' }
      }
    }
    throw err
  }

  // Notify manager
  const employee = await getEmployeeWithManager(employeeId)
  if (employee?.manager?.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: employee.manager.userId,
      title: 'New leave request',
      message: `${employee.firstName} ${employee.lastName} has submitted a leave request.`,
      link: `/${orgSlug}/leave/approvals`,
    })
  }

  revalidatePath(`/${orgSlug}/leave`)
  return { success: true, data: { id: request.id } }
}

// ─────────────────────────────────────────────
// Approve leave request
// ─────────────────────────────────────────────

export async function approveLeaveRequest(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId, role } = await requirePermission(org.id, 'leave.request.approve')

  const raw = Object.fromEntries(formData.entries())
  const parsed = approveLeaveSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { requestId, note } = parsed.data

  const request = await getLeaveRequestWithEmployee(org.id, requestId)
  if (!request) {
    return { success: false, error: 'Leave request not found.' }
  }

  const approverEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (role === 'MANAGER') {
    if (!approverEmployeeId || request.employee.managerId !== approverEmployeeId) {
      return { success: false, error: 'You can only approve requests from your direct reports.' }
    }
  }

  if (approverEmployeeId === request.employeeId) {
    return { success: false, error: 'Cannot approve your own leave request.' }
  }

  let approveAllocations: Awaited<ReturnType<typeof resolveLeaveBalanceAllocations>>
  try {
    approveAllocations = await resolveLeaveBalanceAllocations(
      org.id,
      userId,
      request.employeeId,
      request.leaveTypeId,
      request.startDate,
      request.endDate,
      Number(request.totalDays)
    )
  } catch (err) {
    if (err instanceof LeaveRequestError && err.reason === 'balance_not_configured') {
      return { success: false, error: err.message }
    }
    throw err
  }

  const result = await approveLeaveRequestTransaction(
    requestId,
    org.id,
    approverEmployeeId,
    note ?? null,
    approveAllocations.map((a) => ({ balanceId: a.balanceId, days: a.days })),
    async (tx) => writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'leave.request.approve',
      targetType: 'leave_request',
      targetId: requestId,
      before: { status: 'PENDING' },
      after: { status: 'APPROVED', reviewNote: note },
    }, tx)
  )

  if (result.alreadyProcessed) {
    return { success: false, error: 'This request has already been processed.' }
  }

  if (request.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: request.employee.userId,
      title: 'Leave request approved',
      message: `Your leave request has been approved.${note ? ` Note: ${note}` : ''}`,
      link: `/${orgSlug}/leave`,
    })
  }

  revalidatePath(`/${orgSlug}/leave`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Reject leave request
// ─────────────────────────────────────────────

export async function rejectLeaveRequest(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId, role } = await requirePermission(org.id, 'leave.request.approve')

  const raw = Object.fromEntries(formData.entries())
  const parsed = rejectLeaveSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Rejection reason is required.' }
  }

  const { requestId, reason } = parsed.data

  const request = await getLeaveRequestWithEmployee(org.id, requestId)
  if (!request) {
    return { success: false, error: 'Leave request not found.' }
  }

  const approverEmployeeId = await getEmployeeIdForUser(org.id, userId)
  if (role === 'MANAGER') {
    if (!approverEmployeeId || request.employee.managerId !== approverEmployeeId) {
      return { success: false, error: 'You can only reject requests from your direct reports.' }
    }
  }

  let rejectAllocations: Awaited<ReturnType<typeof resolveLeaveBalanceAllocations>>
  try {
    rejectAllocations = await resolveLeaveBalanceAllocations(
      org.id,
      userId,
      request.employeeId,
      request.leaveTypeId,
      request.startDate,
      request.endDate,
      Number(request.totalDays)
    )
  } catch (err) {
    if (err instanceof LeaveRequestError && err.reason === 'balance_not_configured') {
      return { success: false, error: err.message }
    }
    throw err
  }

  const result = await rejectLeaveRequestTransaction(
    requestId,
    org.id,
    approverEmployeeId,
    reason,
    rejectAllocations.map((a) => ({ balanceId: a.balanceId, days: a.days })),
    async (tx) => writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'leave.request.reject',
      targetType: 'leave_request',
      targetId: requestId,
      before: { status: 'PENDING' },
      after: { status: 'REJECTED', reviewNote: reason },
    }, tx)
  )

  if (result.alreadyProcessed) {
    return { success: false, error: 'This request has already been processed.' }
  }

  if (request.employee.userId) {
    const notifier = getNotificationAdapter()
    await notifier.send({
      orgId: org.id,
      userId: request.employee.userId,
      title: 'Leave request rejected',
      message: `Your leave request was rejected. Reason: ${reason}`,
      link: `/${orgSlug}/leave`,
    })
  }

  revalidatePath(`/${orgSlug}/leave`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Withdraw leave request (while PENDING)
// ─────────────────────────────────────────────

export async function withdrawLeaveRequest(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const session = await verifySession()
  const userId = session.userId

  const raw = Object.fromEntries(formData.entries())
  const parsed = withdrawLeaveSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const { requestId } = parsed.data
  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const withdrawRequest = await getLeaveRequestWithEmployee(org.id, requestId)
  let withdrawAllocations: Awaited<ReturnType<typeof resolveLeaveBalanceAllocations>> = []
  if (withdrawRequest) {
    try {
      withdrawAllocations = await resolveLeaveBalanceAllocations(
        org.id,
        userId,
        employeeId,
        withdrawRequest.leaveTypeId,
        withdrawRequest.startDate,
        withdrawRequest.endDate,
        Number(withdrawRequest.totalDays)
      )
    } catch (err) {
      if (err instanceof LeaveRequestError && err.reason === 'balance_not_configured') {
        return { success: false, error: err.message }
      }
      throw err
    }
  }

  const result = await withdrawLeaveRequestTransaction(
    requestId,
    org.id,
    employeeId,
    withdrawAllocations.map((a) => ({ balanceId: a.balanceId, days: a.days })),
    async (tx) => writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'leave.request.withdraw',
      targetType: 'leave_request',
      targetId: requestId,
      before: { status: 'PENDING' },
      after: { status: 'WITHDRAWN' },
    }, tx)
  )

  if (result.failed) {
    return { success: false, error: 'Cannot withdraw this request. It may have already been processed.' }
  }

  revalidatePath(`/${orgSlug}/leave`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Cancel approved leave
// ─────────────────────────────────────────────

export async function cancelLeaveRequest(
  orgSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const session = await verifySession()
  const userId = session.userId

  const raw = Object.fromEntries(formData.entries())
  const parsed = cancelLeaveSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Cancellation reason is required.' }
  }

  const { requestId, reason } = parsed.data
  const employeeId = await getEmployeeIdForUser(org.id, userId)
  if (!employeeId) {
    return { success: false, error: 'No employee record found.' }
  }

  const cancelRequest = await getLeaveRequestWithEmployee(org.id, requestId)
  let cancelAllocations: Awaited<ReturnType<typeof resolveLeaveBalanceAllocations>> = []
  if (cancelRequest) {
    try {
      cancelAllocations = await resolveLeaveBalanceAllocations(
        org.id,
        userId,
        employeeId,
        cancelRequest.leaveTypeId,
        cancelRequest.startDate,
        cancelRequest.endDate,
        Number(cancelRequest.totalDays)
      )
    } catch (err) {
      if (err instanceof LeaveRequestError && err.reason === 'balance_not_configured') {
        return { success: false, error: err.message }
      }
      throw err
    }
  }

  const result = await cancelLeaveRequestTransaction(
    requestId,
    org.id,
    employeeId,
    reason,
    cancelAllocations.map((a) => ({ balanceId: a.balanceId, days: a.days })),
    async (tx) => writeAudit({
      orgId: org.id,
      actorId: userId,
      action: 'leave.request.cancel',
      targetType: 'leave_request',
      targetId: requestId,
      before: { status: 'APPROVED' },
      after: { status: 'CANCELLED', reason },
    }, tx)
  )

  if (result.failed) {
    return { success: false, error: 'Cannot cancel this request.' }
  }

  revalidatePath(`/${orgSlug}/leave`)
  return { success: true }
}
