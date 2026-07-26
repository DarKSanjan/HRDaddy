'use client'

import { useActionState } from 'react'
import { Button } from '@/core/ui'
import { approveLeaveRequest, rejectLeaveRequest } from '@/modules/leave/actions'
import type { ActionResult } from '@/modules/leave/actions'
import type { LeaveRequestStatus } from '@prisma/client'
import { Check, X } from 'lucide-react'
import { useState } from 'react'

interface LeaveRequest {
  id: string
  employeeFirstName: string
  employeeLastName: string
  leaveTypeName: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
  halfDayPeriod: string | null
  totalDays: number
  reason: string | null
  status: LeaveRequestStatus
  createdAt: Date
}

interface ApprovalListProps {
  requests: LeaveRequest[]
  orgSlug: string
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const initialState: ActionResult = { success: false }

function ApprovalItem({ request, orgSlug }: { request: LeaveRequest; orgSlug: string }) {
  const [rejectReason, setRejectReason] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showApproveForm, setShowApproveForm] = useState(false)

  const [approveState, approveAction, isApproving] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return approveLeaveRequest(orgSlug, formData)
    },
    initialState
  )

  const [rejectState, rejectAction, isRejecting] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return rejectLeaveRequest(orgSlug, formData)
    },
    initialState
  )

  const error = approveState.error || rejectState.error

  return (
    <div className="border-b border-border p-4 last:border-b-0">
      {error && (
        <div className="mb-3 rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-2 text-[12px] text-danger">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[14px] font-medium text-text">
            {request.employeeFirstName} {request.employeeLastName}
          </div>
          <div className="text-[13px] text-text-muted">
            {request.leaveTypeName} — {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
            {request.isHalfDay && ` (${request.halfDayPeriod})`}
          </div>
          <div className="text-[12px] text-text-muted">
            {formatDate(request.startDate)}
            {request.startDate !== request.endDate && ` — ${formatDate(request.endDate)}`}
          </div>
          {request.reason && (
            <div className="mt-1 text-[12px] text-text-muted italic">
              &quot;{request.reason}&quot;
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!showRejectForm && !showApproveForm && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowApproveForm(true)}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setShowRejectForm(true)}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {showApproveForm && (
        <form action={approveAction} className="mt-3 space-y-2">
          <input type="hidden" name="requestId" value={request.id} />
          <textarea
            name="note"
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            placeholder="Add a message (optional)"
            rows={2}
            className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={isApproving}>
              Confirm Approval
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowApproveForm(false)
                setApproveNote('')
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {showRejectForm && (
        <form action={rejectAction} className="mt-3 space-y-2">
          <input type="hidden" name="requestId" value={request.id} />
          <textarea
            name="reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)"
            required
            rows={2}
            className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" loading={isRejecting}>
              Confirm Rejection
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowRejectForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export function ApprovalList({ requests, orgSlug }: ApprovalListProps) {
  return (
    <div className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
      {requests.map((request) => (
        <ApprovalItem key={request.id} request={request} orgSlug={orgSlug} />
      ))}
    </div>
  )
}
