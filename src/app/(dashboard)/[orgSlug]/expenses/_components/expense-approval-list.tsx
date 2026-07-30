'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'
import { approveExpenseClaim, rejectExpenseClaim } from '@/modules/expenses/actions'
import type { ExpenseClaimStatus } from '@prisma/client'

interface ExpenseClaimItem {
  id: string
  employeeFirstName: string
  employeeLastName: string
  categoryName: string
  amountCents: number
  currency: string
  description: string
  expenseDate: Date
  status: ExpenseClaimStatus
  submittedAt: Date | null
  createdAt: Date
}

interface ExpenseApprovalListProps {
  claims: ExpenseClaimItem[]
  orgSlug: string
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(amountCents: number, currency: string): string {
  return `${currency} ${(amountCents / 100).toFixed(2)}`
}

export function ExpenseApprovalList({ claims, orgSlug }: ExpenseApprovalListProps) {
  const router = useRouter()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async (claimId: string) => {
    setProcessing(true)
    setError(null)
    const formData = new FormData()
    formData.set('claimId', claimId)
    const result = await approveExpenseClaim(orgSlug, formData)
    if (!result.success) {
      setError(result.error ?? 'Failed to approve.')
    }
    setProcessing(false)
    router.refresh()
  }

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return
    setProcessing(true)
    setError(null)
    const formData = new FormData()
    formData.set('claimId', rejectingId)
    formData.set('reason', rejectReason)
    const result = await rejectExpenseClaim(orgSlug, formData)
    if (result.success) {
      setRejectingId(null)
      setRejectReason('')
    } else {
      setError(result.error ?? 'Failed to reject.')
    }
    setProcessing(false)
    router.refresh()
  }

  return (
    <>
      <div className="space-y-3">
        {error && <p className="text-[13px] text-danger">{error}</p>}
        {claims.map((claim) => (
          <div
            key={claim.id}
            className="flex items-center justify-between rounded-lg border border-border p-4"
          >
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-text">
                {claim.employeeFirstName} {claim.employeeLastName}
              </p>
              <p className="text-[13px] text-text-muted">
                {claim.categoryName} · {formatDate(claim.expenseDate)} · {formatCurrency(claim.amountCents, claim.currency)}
              </p>
              <p className="text-[12px] text-text-muted max-w-[400px] truncate">
                {claim.description}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRejectingId(claim.id)
                  setRejectReason('')
                }}
                disabled={processing}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(claim.id)}
                disabled={processing}
              >
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense Claim</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this expense claim. The employee will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text"
              placeholder="Reason for rejection..."
              required
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing}
            >
              Reject Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
