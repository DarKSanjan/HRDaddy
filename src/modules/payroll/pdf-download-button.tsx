'use client'

import { useState } from 'react'
import { Button } from '@/core/ui'
import { Download, Loader2 } from 'lucide-react'
import { downloadPeriodPdf, downloadEmployeePdf } from '@/modules/payroll/pdf-actions'

interface PdfDownloadButtonProps {
  orgSlug: string
  periodId?: string
  recordId?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  label?: string
}

/**
 * Client component that triggers payslip PDF download via server action.
 * Pass `periodId` for whole-period download or `recordId` for single employee.
 */
export function PdfDownloadButton({
  orgSlug,
  periodId,
  recordId,
  variant = 'secondary',
  size = 'sm',
  label,
}: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonLabel = label ?? (periodId ? 'Download PDF' : 'Download Payslip')

  async function handleDownload() {
    setLoading(true)
    setError(null)

    try {
      const result = periodId
        ? await downloadPeriodPdf(orgSlug, periodId)
        : recordId
          ? await downloadEmployeePdf(orgSlug, recordId)
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
