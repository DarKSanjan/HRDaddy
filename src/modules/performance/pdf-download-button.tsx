'use client'

import { useState } from 'react'
import { Button } from '@/core/ui'
import { Download, Loader2 } from 'lucide-react'
import { downloadCyclePdf, downloadEmployeeCyclePdf } from '@/modules/performance/pdf-actions'

interface PerformancePdfDownloadButtonProps {
  orgSlug: string
  cycleId?: string
  reviewId?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  label?: string
}

/**
 * Client component that triggers performance review PDF download via server action.
 * Pass `cycleId` for whole-cycle download or `reviewId` for single employee.
 */
export function PerformancePdfDownloadButton({
  orgSlug,
  cycleId,
  reviewId,
  variant = 'secondary',
  size = 'sm',
  label,
}: PerformancePdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonLabel = label ?? (cycleId ? 'Download All (PDF)' : 'Download Review')

  async function handleDownload() {
    setLoading(true)
    setError(null)

    try {
      const result = cycleId
        ? await downloadCyclePdf(orgSlug, cycleId)
        : reviewId
          ? await downloadEmployeeCyclePdf(orgSlug, reviewId)
          : null

      if (!result || !result.success || !result.data) {
        setError(result?.error ?? 'Failed to generate PDF')
        return
      }

      // Convert number array back to Uint8Array and trigger download
      const bytes = new Uint8Array(result.data.buffer)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = result.data.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        )}
        {buttonLabel}
      </Button>
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
