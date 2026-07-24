import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FormFieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * FormField — label + control + hint + error, wired with aria-describedby.
 */
function FormField({ label, htmlFor, hint, error, required, children, className }: FormFieldProps) {
  const hintId = `${htmlFor}-hint`
  const errorId = `${htmlFor}-error`

  const describedBy = [
    hint ? hintId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
      </Label>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })
        }
        return child
      })}
      {hint && !error && (
        <p id={hintId} className="text-[12px] text-text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export { FormField }
