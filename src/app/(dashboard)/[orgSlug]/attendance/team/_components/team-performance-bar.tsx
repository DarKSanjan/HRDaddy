'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui'
import { BarChart } from '@/core/ui/charts/bar-chart'

interface TeamPerformanceBarProps {
  data: Array<{ employeeName: string; overallScore: number }>
}

export function TeamPerformanceBar({ data }: TeamPerformanceBarProps) {
  if (data.length === 0) return null

  const chartData = data.map((d) => ({
    employee: d.employeeName,
    score: d.overallScore,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <BarChart
          data={chartData}
          xKey="employee"
          series={[{ dataKey: 'score', name: 'Score' }]}
          height={200}
          showLegend={false}
        />
      </CardContent>
    </Card>
  )
}
