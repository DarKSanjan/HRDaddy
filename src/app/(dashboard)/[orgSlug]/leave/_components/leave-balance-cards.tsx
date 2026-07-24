'use client'

import { Card, CardContent } from '@/core/ui'
import { getChartColor } from '@/core/ui/charts'

interface LeaveBalance {
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

interface LeaveBalanceCardsProps {
  balances: LeaveBalance[]
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  if (balances.length === 0) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-border bg-surface p-4 text-center">
        <p className="text-[13px] text-text-muted">No leave balances configured yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {balances.map((balance, index) => {
        const percentage = balance.allowance > 0
          ? Math.round((balance.used / balance.allowance) * 100)
          : 0
        const color = getChartColor(index)

        return (
          <Card key={balance.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="text-[13px] font-medium text-text">
                  {balance.leaveTypeName}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[24px] font-bold text-text">
                    {balance.available}
                  </span>
                  <span className="text-[12px] text-text-muted">
                    of {balance.allowance} days
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>Used: {balance.used}</span>
                  {balance.pending > 0 && (
                    <span>Pending: {balance.pending}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
