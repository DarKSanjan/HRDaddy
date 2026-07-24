'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, DonutChart } from '@/core/ui/charts'
import type { LeaveUsageByType } from '@/core/dashboard/chart-queries'

interface Props {
  data: LeaveUsageByType[]
}

/**
 * Leave usage by type — donut with direct-labelled legend.
 * Colour assigned by entity identity in fixed order.
 */
export function LeaveDonut({ data }: Props) {
  if (data.length === 0) {
    return (
      <ChartCard title="Leave Usage by Type">
        <ChartEmpty message="No leave taken this year yet." />
      </ChartCard>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <ChartCard title="Leave Usage by Type">
      <DonutChart
        data={data}
        height={200}
        label="Total days"
        labelValue={total}
      />
    </ChartCard>
  )
}
