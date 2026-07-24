'use client'

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

export function ProgressIndicator({
  currentStep,
  totalSteps,
  labels,
}: ProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-1" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps} aria-label={`Step ${currentStep} of ${totalSteps}: ${labels[currentStep - 1]}`}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isCompleted = step < currentStep
        const isCurrent = step === currentStep

        return (
          <div
            key={step}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div
              className={`h-1 w-full rounded-full transition-colors ${
                isCompleted
                  ? 'bg-accent-500'
                  : isCurrent
                    ? 'bg-accent-300'
                    : 'bg-border'
              }`}
            />
            <span
              className={`hidden text-[11px] sm:block ${
                isCurrent
                  ? 'font-medium text-text'
                  : isCompleted
                    ? 'text-text-muted'
                    : 'text-text-subtle'
              }`}
            >
              {labels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
