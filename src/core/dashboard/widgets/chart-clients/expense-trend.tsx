'use client'

import * as React from 'react'
import { ChartCard, ChartEmpty, BarChart } from '@/core/ui/charts'
import type { ExpenseMonthData } from '@/core/dashboard/widget-queries'

interface Props {
  data: ExpenseMonthData[]
}

/**
 * Expense trend — bar chart of approved expense totals over the last 6 months.
 */
export function ExpenseTrendChart({ data }: Props) {
  const hasData = data.some((d) => d.amount > 0)

  if (!hasData) {
    return (
      <ChartCard title="Expense Trend">
        <ChartEmpty message="No approved expenses in the last 6 months." />
      </ChartCard>
    )
  }

  const chartData = data as unknown as Record<string, unknown>[]

  return (
    <ChartCard title="Expense Trend">
      <BarChart
        data={chartData}
        xKey="month"
        series={[{ dataKey: 'amount', name: 'Approved ($)', colorIndex: 0 }]}
        height={200}
      />
    </ChartCard>
  )
}
