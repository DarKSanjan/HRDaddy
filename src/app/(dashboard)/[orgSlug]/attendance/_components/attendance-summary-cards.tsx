'use client'

import { StatTile } from '@/core/ui/charts'

interface Summary {
  daysPresent: number
  totalHours: number
  averageStartTime: string | null
  lateArrivals: number
}

interface AttendanceSummaryCardsProps {
  summary: Summary
}

export function AttendanceSummaryCards({ summary }: AttendanceSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Days Present"
        value={summary.daysPresent}
      />
      <StatTile
        label="Total Hours"
        value={summary.totalHours}
      />
      <StatTile
        label="Avg. Start"
        value={summary.averageStartTime ?? '--:--'}
      />
      <StatTile
        label="Late Arrivals"
        value={summary.lateArrivals}
      />
    </div>
  )
}
