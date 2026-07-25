'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-text-subtle" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-[16px] font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-text-muted">{description}</p>
      {action && (
        <Button
          variant="primary"
          size="md"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

export { EmptyState }