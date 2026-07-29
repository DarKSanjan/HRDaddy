'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button } from '@/core/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { withdrawLeaveRequest, cancelLeaveRequest } from '@/modules/leave/actions'
import type { ActionResult } from '@/modules/leave/actions'
import type { LeaveRequestStatus } from '@prisma/client'
import { toOrgDate } from '@/core/calendar'
import { TZDate } from '@date-fns/tz'
import { isBefore } from 'date-fns'

interface LeaveRequest {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  leaveTypeName: string
  leaveTypeColor: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
  halfDayPeriod: string | null
  totalDays: number
  reason: string | null
  status: LeaveRequestStatus
  createdAt: Date
}

interface LeaveRequestTableProps {
  requests: LeaveRequest[]
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  orgSlug: string
  orgTimezone: string
  showEmployee?: boolean
}

const STATUS_VARIANT: Record<LeaveRequestStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  WITHDRAWN: 'neutral',
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Check if the leave start date is strictly after today in the org timezone.
 * Used to determine if an approved leave can still be cancelled.
 */
function leaveHasNotStarted(startDate: Date, timezone: string): boolean {
  const today = new TZDate(Date.now(), timezone)
  const todayStart = new TZDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
    0,
    timezone
  )
  const leaveStart = toOrgDate(startDate, timezone)
  // Leave hasn't started if its start date is after today (i.e. today is before leaveStart)
  return isBefore(todayStart, leaveStart)
}

const initialState: ActionResult = { success: false }

// ─────────────────────────────────────────────
// Withdraw action row (PENDING requests)
// ─────────────────────────────────────────────

function WithdrawAction({ requestId, orgSlug }: { requestId: string; orgSlug: string }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return withdrawLeaveRequest(orgSlug, formData)
    },
    initialState
  )

  if (state.error) {
    return (
      <div className="text-[12px] text-danger">{state.error}</div>
    )
  }

  if (!showConfirm) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setShowConfirm(true)}
      >
        Withdraw
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" variant="danger" size="sm" loading={isPending}>
        Confirm Withdraw
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setShowConfirm(false)}
      >
        Cancel
      </Button>
    </form>
  )
}

// ─────────────────────────────────────────────
// Cancel action row (APPROVED requests not yet started)
// ─────────────────────────────────────────────

function CancelAction({ requestId, orgSlug }: { requestId: string; orgSlug: string }) {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return cancelLeaveRequest(orgSlug, formData)
    },
    initialState
  )

  if (state.error) {
    return (
      <div className="text-[12px] text-danger">{state.error}</div>
    )
  }

  if (!showForm) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setShowForm(true)}
      >
        Cancel
      </Button>
    )
  }

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for cancellation (required)"
        required
        rows={2}
        className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" loading={isPending}>
          Confirm Cancellation
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setShowForm(false)
            setReason('')
          }}
        >
          Back
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// Table row
// ─────────────────────────────────────────────

function LeaveRequestRow({
  request,
  orgSlug,
  orgTimezone,
  showEmployee,
}: {
  request: LeaveRequest
  orgSlug: string
  orgTimezone: string
  showEmployee: boolean
}) {
  const showWithdraw = request.status === 'PENDING'
  const showCancel =
    request.status === 'APPROVED' && leaveHasNotStarted(request.startDate, orgTimezone)

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
      {showEmployee && (
        <td className="px-3 py-2 font-medium text-text">
          {request.employeeFirstName} {request.employeeLastName}
        </td>
      )}
      <td className="px-3 py-2">
        <span className="text-text">{request.leaveTypeName}</span>
      </td>
      <td className="px-3 py-2 text-text-muted">
        {formatDate(request.startDate)}
        {request.startDate !== request.endDate && (
          <> — {formatDate(request.endDate)}</>
        )}
        {request.isHalfDay && (
          <span className="ml-1 text-[11px]">({request.halfDayPeriod})</span>
        )}
      </td>
      <td className="px-3 py-2 text-text-muted">{request.totalDays}</td>
      <td className="px-3 py-2">
        <Badge variant={STATUS_VARIANT[request.status]}>
          {request.status}
        </Badge>
      </td>
      <td className="px-3 py-2 text-text-muted">
        {formatDate(request.createdAt)}
      </td>
      <td className="px-3 py-2">
        {showWithdraw && (
          <WithdrawAction requestId={request.id} orgSlug={orgSlug} />
        )}
        {showCancel && (
          <CancelAction requestId={request.id} orgSlug={orgSlug} />
        )}
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────
// Main table
// ─────────────────────────────────────────────

export function LeaveRequestTable({
  requests,
  total,
  currentPage,
  totalPages,
  pageSize,
  orgSlug,
  orgTimezone,
  showEmployee = false,
}: LeaveRequestTableProps) {
  const router = useRouter()

  const hasActions = requests.some(
    (r) =>
      r.status === 'PENDING' ||
      (r.status === 'APPROVED' && leaveHasNotStarted(r.startDate, orgTimezone))
  )

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set('page', String(page))
    router.push(`/${orgSlug}/leave?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface">
              {showEmployee && (
                <th className="px-3 py-2 text-left font-medium text-text-muted">Employee</th>
              )}
              <th className="px-3 py-2 text-left font-medium text-text-muted">Type</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Dates</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Days</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Submitted</th>
              {hasActions && (
                <th className="px-3 py-2 text-left font-medium text-text-muted">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <LeaveRequestRow
                key={request.id}
                request={request}
                orgSlug={orgSlug}
                orgTimezone={orgTimezone}
                showEmployee={showEmployee}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-[12px] text-text-muted">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
