'use client'

import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/core/ui'
import { BarChart } from '@/core/ui/charts/bar-chart'
import type { CalibrationData } from '@/modules/performance/queries'

interface CalibrationSectionProps {
  data: CalibrationData
  cycleName: string
}

export function CalibrationSection({ data, cycleName }: CalibrationSectionProps) {
  if (data.byManager.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calibration — {cycleName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-text-muted">
            No published reviews with reviewers in this cycle yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.byManager.map((m) => ({
    manager: m.reviewerName,
    avgScore: m.avgScore,
  }))

  // Flag managers deviating > 0.5 from org average
  const outliers = data.byManager.filter(
    (m) => Math.abs(m.avgScore - data.orgAverage) > 0.5
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration — {cycleName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <BarChart
          data={chartData}
          xKey="manager"
          series={[{ dataKey: 'avgScore', name: 'Avg Score' }]}
          height={200}
          showLegend={false}
        />

        <p className="text-[13px] text-text">
          Org average: <span className="font-medium">{data.orgAverage.toFixed(1)}</span>
        </p>

        {outliers.length > 0 && (
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-text-muted">Outliers (deviation &gt; 0.5)</p>
            {outliers.map((m) => {
              const delta = m.avgScore - data.orgAverage
              const isHigh = delta > 0
              return (
                <div key={m.reviewerId} className="flex items-center gap-2 text-[12px]">
                  <span className="text-text">{m.reviewerName}</span>
                  <Badge variant={isHigh ? 'warning' : 'info'}>
                    {isHigh ? '+' : ''}{delta.toFixed(1)}
                  </Badge>
                  <span className="text-[11px] text-text-muted">
                    {isHigh ? 'Possible rating inflation' : 'Possible rating harshness'}
                    {' · '}{m.reviewCount} review{m.reviewCount === 1 ? '' : 's'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
