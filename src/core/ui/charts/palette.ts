/**
 * Chart system palette and shared utilities.
 *
 * Categorical palette is fixed-order, validated for colour-blindness contrast.
 * Never cycle colours. Series identity → colour assignment.
 */

/** Categorical palette — assign by series identity, never by rank */
export const CHART_COLORS = [
  '#6758FF', // 1 — accent/indigo
  '#0891B2', // 2 — teal
  '#DB2777', // 3 — pink
  '#D97706', // 4 — amber
  '#7C3AED', // 5 — violet
  '#15803D', // 6 — green
] as const

/** Status colours — never reused as series colours */
export const STATUS_COLORS = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
} as const

/** Get a chart colour by index (0-based) */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/** Format a number for chart display */
export function formatChartNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toLocaleString()
}

/** Shared chart margins */
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const

/** Shared axis style */
export const AXIS_STYLE = {
  fontSize: 11,
  fill: 'var(--text-subtle)',
  fontFamily: 'var(--font-body)',
} as const

/** Grid stroke style */
export const GRID_STYLE = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  strokeWidth: 1,
} as const
