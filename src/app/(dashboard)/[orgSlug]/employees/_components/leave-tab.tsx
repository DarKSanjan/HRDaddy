'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/core/ui'
import { CalendarDays } from 'lucide-react'
import { fetchEmployeeLeave } from '@/modules/leave/client-actions'

interface EmployeeLeaveTabProps {
  employeeId: string
  orgSlug: string
}

interface BalanceItem {
  id: string
  leaveType: { id: string; name: string }
  entitled: number
  used: number
  pending: number
  balance: number
}

interface LeaveRequestItem {
  id: string
  leaveType: { name: string }
  startDate: string
  endDate: string
  days: number
  status: string
  reason: string | null
}

export function EmployeeLeaveTab({ employeeId, orgSlug }: EmployeeLeaveTabProps) {
  const [balances, setBalances] = useState<BalanceItem[]>([])
  const [requests, setRequests] = useState<LeaveRequestItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchEmployeeLeave(orgSlug, employeeId)
        if (!cancelled && result.success && result.data) {
          setBalances(result.data.balances as BalanceItem[])
          setRequests(result.data.requests as LeaveRequestItem[])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orgSlug, employeeId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-[13px] text-text-muted">Loading leave data...</p>
        </CardContent>
      </Card>
    )
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'success' as const
      case 'PENDING': return 'warning' as const
      case 'REJECTED': return 'danger' as const
      default: return 'neutral' as const
    }
  }

  return (
    <div className="space-y-6">
      {/* Balances */}
      {balances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leave Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((b) => (
                <div
                  key={b.id}
                  className="rounded-[var(--radius-sm)] border border-border p-3 space-y-1"
                >
                  <p className="text-[12px] font-medium text-text-muted">{b.leaveType.name}</p>
                  <p className="text-[18px] font-bold text-text tabular-nums">
                    {b.balance}
                    <span className="text-[12px] font-normal text-text-muted"> / {b.entitled} days</span>
                  </p>
                  <p className="text-[11px] text-text-subtle">
                    {b.used} used &middot; {b.pending} pending
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent requests */}
      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CalendarDays className="h-10 w-10 text-text-subtle" aria-hidden="true" />
              <p className="mt-3 text-[13px] text-text-muted">No leave requests yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-[var(--radius-xs)] border border-border p-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-text">{req.leaveType.name}</p>
                    <p className="text-[12px] text-text-muted">
                      {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                      {' '}&middot; {req.days} day{req.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge variant={statusVariant(req.status)}>
                    {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
