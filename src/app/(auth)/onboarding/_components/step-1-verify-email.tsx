'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/core/ui'
import { completeStep1 } from '../actions'

interface Step1Props {
  userEmail: string
  userName: string
  onNext: () => void
}

export function Step1VerifyEmail({ userEmail, userName, onNext }: Step1Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleContinue() {
    setError(null)
    startTransition(async () => {
      const result = await completeStep1()
      if (result.success) {
        onNext()
      } else {
        setError(result.error ?? 'An error occurred')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-text">
          Welcome, {userName}
        </h2>
        <p className="mt-1 text-[14px] text-text-muted">
          Your email has been verified. Let&rsquo;s set up your organisation.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
            <svg
              className="h-5 w-5 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-medium text-text">Email verified</p>
            <p className="text-[12px] text-text-muted">{userEmail}</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          loading={isPending}
          disabled={isPending}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
