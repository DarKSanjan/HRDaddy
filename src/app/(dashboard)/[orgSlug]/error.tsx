'use client'

import { useEffect } from 'react'

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for observability — do not expose details to the user
    console.error('[OrgError]', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-8 text-center">
        <h2 className="text-[16px] font-semibold text-text">
          Something went wrong
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          A temporary issue prevented this page from loading. This is not a
          permanent error.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-[var(--radius-sm)] bg-accent-500 px-4 py-2 text-[14px] font-medium text-white hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
