/**
 * Asset module dashboard widgets.
 */
import * as React from 'react'
import { StatTile, DonutChart, ChartCard, ChartEmpty } from '@/core/ui/charts'
import type { WidgetProps } from '@/core/dashboard'
import {
  getAssetStatusBreakdown,
  getMyAssignedAssetCount,
  getPendingAssetRequestCount,
} from '@/core/dashboard/widget-queries'

// ─────────────────────────────────────────────
// Asset Overview (admin/manager — donut breakdown)
// ─────────────────────────────────────────────

export async function AssetOverviewWidget(props: WidgetProps) {
  const breakdown = await getAssetStatusBreakdown(props.orgId, props.userId)
  const total = breakdown.available + breakdown.assigned + breakdown.inMaintenance

  if (total === 0) {
    return (
      <ChartCard title="Asset Overview">
        <ChartEmpty message="No assets registered yet." />
      </ChartCard>
    )
  }

  const data = [
    { name: 'Available', value: breakdown.available, colorIndex: 0 },
    { name: 'Assigned', value: breakdown.assigned, colorIndex: 1 },
    { name: 'Maintenance', value: breakdown.inMaintenance, colorIndex: 3 },
  ].filter((d) => d.value > 0)

  return (
    <ChartCard title="Asset Overview">
      <DonutChart
        data={data}
        height={180}
        label="Total"
        labelValue={total}
      />
    </ChartCard>
  )
}

// ─────────────────────────────────────────────
// My Assets (employee — stat tile)
// ─────────────────────────────────────────────

export async function MyAssetsWidget(props: WidgetProps) {
  if (!props.employeeId) {
    return (
      <StatTile label="My Assets" value={0} />
    )
  }

  const count = await getMyAssignedAssetCount(
    props.orgId,
    props.userId,
    props.employeeId
  )

  return (
    <StatTile label="My Assets" value={count} />
  )
}

// ─────────────────────────────────────────────
// Pending Asset Requests (admin/manager — stat tile)
// ─────────────────────────────────────────────

export async function PendingAssetRequestsWidget(props: WidgetProps) {
  const count = await getPendingAssetRequestCount(props.orgId, props.userId)

  return (
    <StatTile label="Pending Asset Requests" value={count} />
  )
}
