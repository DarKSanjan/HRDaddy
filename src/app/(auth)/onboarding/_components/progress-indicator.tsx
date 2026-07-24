'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

/**
 * Wizard progress indicator — segment bars above, labels below.
 * Current step is emphasised. Completed steps show a drawn check.
 * No overlap at any viewport >= 1280px thanks to even flex distribution.
 */
export function ProgressIndicator({
  currentStep,
  totalSteps,
  labels,
}: ProgressIndicatorProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${currentStep} of ${totalSteps}: ${labels[currentStep - 1]}`}
      className="flex w-full gap-2"
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep

        return (
          <div key={step} className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Segment bar */}
            <div
              className={cn(
                'h-1 w-full rounded-full transition-colors duration-200',
                isCompleted && 'bg-accent-500',
                isCurrent && 'bg-accent-400',
                !isCompleted && !isCurrent && 'bg-border',
              )}
            />
            {/* Label row */}
            <div className="flex items-center gap-1">
              {isCompleted && (
                <Check
                  className="h-3 w-3 shrink-0 text-accent-500"
                  aria-hidden="true"
                  strokeWidth={3}
                />
              )}
              <span
                className={cn(
                  'truncate text-[11px] leading-tight',
                  isCurrent && 'font-medium text-text',
                  isCompleted && 'text-text-muted',
                  !isCompleted && !isCurrent && 'text-text-subtle',
                )}
              >
                {labels[i]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
