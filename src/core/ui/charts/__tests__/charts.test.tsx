import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ChartCard,
  ChartEmpty,
  ChartSkeleton,
  ChartError,
  StatTile,
} from '../chart-primitives'
import { CHART_COLORS, getChartColor, formatChartNumber } from '../palette'

describe('CHART_COLORS palette', () => {
  it('has exactly 6 colours', () => {
    expect(CHART_COLORS).toHaveLength(6)
  })

  it('all are valid hex colours', () => {
    CHART_COLORS.forEach((c) => {
      expect(c).toMatch(/^#[0-9A-F]{6}$/i)
    })
  })
})

describe('getChartColor', () => {
  it('returns the colour at the given index', () => {
    expect(getChartColor(0)).toBe('#6758FF')
    expect(getChartColor(1)).toBe('#0891B2')
  })

  it('wraps around for index > 5', () => {
    expect(getChartColor(6)).toBe('#6758FF')
  })
})

describe('formatChartNumber', () => {
  it('formats thousands', () => {
    expect(formatChartNumber(1500)).toBe('1.5K')
  })

  it('formats millions', () => {
    expect(formatChartNumber(2_500_000)).toBe('2.5M')
  })

  it('leaves small numbers as-is', () => {
    expect(formatChartNumber(42)).toBe('42')
  })
})

describe('ChartCard', () => {
  it('renders title and children', () => {
    render(
      <ChartCard title="Revenue">
        <div>chart content</div>
      </ChartCard>
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('chart content')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(
      <ChartCard title="Revenue" description="Last 30 days">
        <div>chart</div>
      </ChartCard>
    )
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('toggles table view', () => {
    render(
      <ChartCard title="Revenue" tableView={<div>table data</div>}>
        <div>chart content</div>
      </ChartCard>
    )
    expect(screen.getByText('chart content')).toBeInTheDocument()
    expect(screen.queryByText('table data')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Show table'))
    expect(screen.getByText('table data')).toBeInTheDocument()
    expect(screen.queryByText('chart content')).not.toBeInTheDocument()
  })
})

describe('ChartEmpty', () => {
  it('renders default message', () => {
    render(<ChartEmpty />)
    expect(screen.getByText('No data to display')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<ChartEmpty message="No employees yet" />)
    expect(screen.getByText('No employees yet')).toBeInTheDocument()
  })
})

describe('ChartSkeleton', () => {
  it('renders with aria-hidden', () => {
    const { container } = render(<ChartSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('ChartError', () => {
  it('renders error message', () => {
    render(<ChartError message="Network error" />)
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders retry button when onRetry provided', () => {
    render(<ChartError onRetry={() => {}} />)
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('does not render retry button when onRetry not provided', () => {
    render(<ChartError />)
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })
})

describe('StatTile', () => {
  it('renders label and value', () => {
    render(<StatTile label="Total employees" value={42} />)
    expect(screen.getByText('Total employees')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders positive delta', () => {
    render(<StatTile label="Revenue" value="$12K" delta={12} deltaLabel="vs last month" />)
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('renders negative delta', () => {
    render(<StatTile label="Churn" value="3%" delta={-5} />)
    expect(screen.getByText('5%')).toBeInTheDocument()
  })

  it('renders sparkline slot', () => {
    render(
      <StatTile
        label="Trend"
        value={100}
        sparkline={<div data-testid="sparkline">spark</div>}
      />
    )
    expect(screen.getByTestId('sparkline')).toBeInTheDocument()
  })
})
