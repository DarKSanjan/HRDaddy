'use server'

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
import { getHolidaysForRange } from '@/core/calendar/holidays-sg'
import {
  getLeaveBalance,
  findOverlappingRequest,
  createLeaveRequestTransaction,
  approveLeaveRequestTransaction,
  rejectLeaveRequestTransaction,
  withdrawLeaveRequestTransaction,
  cancelLeaveRequestTransaction,
  getLeaveRequestWithEmployee,
  getEmployeeWithManager,
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
  const holidays = getHolidaysForRange(startYear, endYear)

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

  // Check balance
  const year = new Date(input.startDate).getFullYear()
  const balance = await getLeaveBalance(employeeId, input.leaveTypeId, year)

  if (balance) {
    const available = Number(balance.allowance) - Number(balance.used) - Number(balance.pending)
    if (available < totalDays) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${available} days, Requested: ${totalDays} days.`,
      }
    }
  }

  const request = await createLeaveRequestTransaction(
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
    balance?.id ?? null
  )

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'leave.request.create',
    targetType: 'leave_request',
    targetId: request.id,
    after: { totalDays, startDate: input.startDate, endDate: input.endDate },
  })

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

  const result = await approveLeaveRequestTransaction(
    requestId,
    org.id,
    approverEmployeeId,
    note ?? null,
    Number(request.totalDays),
    request.employeeId,
    request.leaveTypeId,
    request.startDate.getFullYear()
  )

  if (result.alreadyProcessed) {
    return { success: false, error: 'This request has already been processed.' }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'leave.request.approve',
    targetType: 'leave_request',
    targetId: requestId,
    before: { status: 'PENDING' },
    after: { status: 'APPROVED', reviewNote: note },
  })

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

  const result = await rejectLeaveRequestTransaction(
    requestId,
    org.id,
    approverEmployeeId,
    reason,
    Number(request.totalDays),
    request.employeeId,
    request.leaveTypeId,
    request.startDate.getFullYear()
  )

  if (result.alreadyProcessed) {
    return { success: false, error: 'This request has already been processed.' }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'leave.request.reject',
    targetType: 'leave_request',
    targetId: requestId,
    before: { status: 'PENDING' },
    after: { status: 'REJECTED', reviewNote: reason },
  })

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

  const result = await withdrawLeaveRequestTransaction(requestId, org.id, employeeId)

  if (result.failed) {
    return { success: false, error: 'Cannot withdraw this request. It may have already been processed.' }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'leave.request.withdraw',
    targetType: 'leave_request',
    targetId: requestId,
    before: { status: 'PENDING' },
    after: { status: 'WITHDRAWN' },
  })

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

  const result = await cancelLeaveRequestTransaction(requestId, org.id, employeeId, reason)

  if (result.failed) {
    return { success: false, error: 'Cannot cancel this request.' }
  }

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'leave.request.cancel',
    targetType: 'leave_request',
    targetId: requestId,
    before: { status: 'APPROVED' },
    after: { status: 'CANCELLED', reason },
  })

  revalidatePath(`/${orgSlug}/leave`)
  return { success: true }
}
