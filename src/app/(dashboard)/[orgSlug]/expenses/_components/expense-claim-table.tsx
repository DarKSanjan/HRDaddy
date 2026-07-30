'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/core/ui'
import { withdrawExpenseClaim } from '@/modules/expenses/actions'
import type { ExpenseClaimStatus } from '@prisma/client'

interface ExpenseClaimItem {
  id: string
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  categoryName: string
  amountCents: number
  currency: string
  description: string
  expenseDate: Date
  status: ExpenseClaimStatus
  submittedAt: Date | null
  reviewedAt: Date | null
  reviewNotes: string | null
  reimbursedAt: Date | null
  createdAt: Date
}

interface ExpenseClaimTableProps {
  claims: ExpenseClaimItem[]
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  orgSlug: string
  showEmployee?: boolean
}

function statusVariant(status: ExpenseClaimStatus): 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  switch (status) {
    case 'SUBMITTED': return 'info'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'danger'
    case 'REIMBURSED': return 'default'
    default: return 'neutral'
  }
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

export function ExpenseClaimTable({
  claims,
  total,
  currentPage,
  totalPages,
  pageSize,
  orgSlug,
  showEmployee = false,
}: ExpenseClaimTableProps) {
  const router = useRouter()
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const handleWithdraw = async () => {
    if (!withdrawingId) return
    setWithdrawError(null)
    const formData = new FormData()
    formData.set('claimId', withdrawingId)
    const result = await withdrawExpenseClaim(orgSlug, formData)
    if (result.success) {
      setWithdrawingId(null)
      router.refresh()
    } else {
      setWithdrawError(result.error ?? 'Failed to withdraw claim.')
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              {showEmployee && <th className="px-3 py-2 font-medium">Employee</th>}
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="border-b border-border last:border-0">
                {showEmployee && (
                  <td className="px-3 py-2 text-text">
                    {claim.employeeFirstName} {claim.employeeLastName}
                  </td>
                )}
                <td className="px-3 py-2 text-text">{formatDate(claim.expenseDate)}</td>
                <td className="px-3 py-2 text-text">{claim.categoryName}</td>
                <td className="px-3 py-2 text-text max-w-[200px] truncate">{claim.description}</td>
                <td className="px-3 py-2 text-text text-right font-medium">
                  {formatCurrency(claim.amountCents, claim.currency)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  {(claim.status === 'DRAFT' || claim.status === 'SUBMITTED') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setWithdrawingId(claim.id)}
                    >
                      Withdraw
                    </Button>
                  )}
                  {claim.status === 'REJECTED' && claim.reviewNotes && (
                    <span className="text-[12px] text-text-muted" title={claim.reviewNotes}>
                      Reason: {claim.reviewNotes.slice(0, 30)}{claim.reviewNotes.length > 30 ? '...' : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-text-muted">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
          </span>
        </div>
      )}

      <Dialog open={!!withdrawingId} onOpenChange={() => setWithdrawingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Expense Claim</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw this expense claim? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {withdrawError && <p className="text-[13px] text-danger">{withdrawError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWithdrawingId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleWithdraw}>Withdraw</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
