/**
 * Chart system barrel export.
 * Feature code imports from @/core/ui/charts — never imports Recharts directly.
 */

// Palette and utilities
export { CHART_COLORS, STATUS_COLORS, getChartColor, formatChartNumber } from './palette'

// Tooltip
export { ChartTooltipContent } from './chart-tooltip'

// Charts
export { LineChart, type LineChartProps, type LineChartSeries } from './line-chart'
export { AreaChart, type AreaChartProps, type AreaChartSeries } from './area-chart'
export { BarChart, type BarChartProps, type BarChartSeries } from './bar-chart'
export { DonutChart, type DonutChartProps, type DonutChartDataPoint } from './donut-chart'
export { Sparkline, type SparklineProps } from './sparkline'

// Primitives
export {
  ChartCard,
  ChartEmpty,
  ChartSkeleton,
  ChartError,
  StatTile,
  type ChartCardProps,
  type ChartEmptyProps,
  type ChartErrorProps,
  type StatTileProps,
} from './chart-primitives'
