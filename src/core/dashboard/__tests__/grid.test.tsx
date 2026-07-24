/**
 * Tests for the DashboardGrid and WidgetShell components.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardGrid, WidgetShell } from '@/core/dashboard/grid'

describe('DashboardGrid', () => {
  it('renders children in a 12-column grid', () => {
    render(
      <DashboardGrid>
        <div data-testid="child1">Widget 1</div>
        <div data-testid="child2">Widget 2</div>
      </DashboardGrid>
    )

    expect(screen.getByTestId('child1')).toBeInTheDocument()
    expect(screen.getByTestId('child2')).toBeInTheDocument()

    const grid = screen.getByTestId('child1').parentElement
    expect(grid).toHaveClass('grid', 'grid-cols-12', 'gap-4')
  })
})

describe('WidgetShell', () => {
  it('applies sm column span (col-span-3 on lg)', () => {
    render(
      <WidgetShell id="test-sm" size="sm">
        <div data-testid="content">Content</div>
      </WidgetShell>
    )

    const shell = screen.getByTestId('content').closest('[data-widget-id]')
    expect(shell).toHaveAttribute('data-widget-id', 'test-sm')
    expect(shell).toHaveClass('lg:col-span-3')
  })

  it('applies md column span (col-span-6 on lg)', () => {
    render(
      <WidgetShell id="test-md" size="md">
        <div data-testid="content">Content</div>
      </WidgetShell>
    )

    const shell = screen.getByTestId('content').closest('[data-widget-id]')
    expect(shell).toHaveClass('lg:col-span-6')
  })

  it('applies lg column span (col-span-12)', () => {
    render(
      <WidgetShell id="test-lg" size="lg">
        <div data-testid="content">Content</div>
      </WidgetShell>
    )

    const shell = screen.getByTestId('content').closest('[data-widget-id]')
    expect(shell).toHaveClass('col-span-12')
  })
})
