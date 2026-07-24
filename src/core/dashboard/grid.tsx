'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// DashboardGrid
// ─────────────────────────────────────────────

export interface DashboardGridProps {
  children: React.ReactNode
  className?: string
}

/**
 * 12-column grid layout for dashboard widgets.
 * Laptop-first at 1440x900.
 */
export function DashboardGrid({ children, className }: DashboardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-12 gap-4',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────
// WidgetShell
// ─────────────────────────────────────────────

export interface WidgetShellProps {
  id: string
  size: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const sizeClasses: Record<string, string> = {
  sm: 'col-span-12 sm:col-span-6 lg:col-span-3',
  md: 'col-span-12 lg:col-span-6',
  lg: 'col-span-12',
}

/**
 * Suspense + ErrorBoundary shell for each widget.
 * Each widget streams independently — one slow widget cannot block the page.
 */
export function WidgetShell({ id, size, children }: WidgetShellProps) {
  return (
    <div className={sizeClasses[size]} data-widget-id={id}>
      <ErrorBoundary widgetId={id}>
        <React.Suspense fallback={<WidgetSkeleton size={size} />}>
          {children}
        </React.Suspense>
      </ErrorBoundary>
    </div>
  )
}

// ─────────────────────────────────────────────
// WidgetSkeleton
// ─────────────────────────────────────────────

function WidgetSkeleton({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const height = size === 'sm' ? 'h-[120px]' : size === 'md' ? 'h-[280px]' : 'h-[320px]'
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-md)] border border-border bg-surface',
        height
      )}
      aria-hidden="true"
    >
      <div className="p-4 space-y-3">
        <div className="h-3 w-24 rounded bg-border" />
        <div className="h-6 w-16 rounded bg-border" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ErrorBoundary
// ─────────────────────────────────────────────

interface ErrorBoundaryProps {
  widgetId: string
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <div className="flex h-[100px] flex-col items-center justify-center gap-2">
            <p className="text-[12px] text-danger">Failed to load widget</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="text-[12px] font-medium text-accent-500 hover:text-accent-600"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
