'use client'

import { useRouter } from 'next/navigation'
import { Badge, Button } from '@/core/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LeaveRequestStatus } from '@prisma/client'

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

export function LeaveRequestTable({
  requests,
  total,
  currentPage,
  totalPages,
  pageSize,
  orgSlug,
  showEmployee = false,
}: LeaveRequestTableProps) {
  const router = useRouter()

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
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors"
              >
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
              </tr>
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
