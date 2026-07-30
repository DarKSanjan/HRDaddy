'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/core/ui'
import { markExpenseReimbursed } from '@/modules/expenses/actions'

interface ExpenseClaimItem {
  id: string
  employeeFirstName: string
  employeeLastName: string
  categoryName: string
  amountCents: number
  currency: string
  description: string
  expenseDate: Date
}

interface ExpenseReimburseListProps {
  claims: ExpenseClaimItem[]
  orgSlug: string
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amountCents: number, currency: string): string {
  return `${currency} ${(amountCents / 100).toFixed(2)}`
}

export function ExpenseReimburseList({ claims, orgSlug }: ExpenseReimburseListProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReimburse = async (claimId: string) => {
    setProcessingId(claimId)
    setError(null)
    const formData = new FormData()
    formData.set('claimId', claimId)
    const result = await markExpenseReimbursed(orgSlug, formData)
    if (!result.success) {
      setError(result.error ?? 'Failed to mark as reimbursed.')
    }
    setProcessingId(null)
    router.refresh()
  }

  return (
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
            <p className="text-[12px] text-text-muted max-w-[400px] truncate">{claim.description}</p>
          </div>
          <Button
            size="sm"
            onClick={() => handleReimburse(claim.id)}
            disabled={processingId === claim.id}
          >
            Mark Reimbursed
          </Button>
        </div>
      ))}
    </div>
  )
}
