'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/core/ui'
import { Upload, CheckCircle, AlertCircle, Download, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { validateAssetImportCsv, commitAssetImportCsv } from '@/modules/assets/import-actions'
import { CSV_HEADERS, CSV_TEMPLATE_ROW } from '@/modules/assets/import-constants'
import Link from 'next/link'

interface AssetImportWizardProps {
  orgSlug: string
}

type Step = 'upload' | 'preview' | 'result'

interface ValidationRow {
  rowIndex: number
  name: string
  assetTag: string
  errors: string[]
  isValid: boolean
}

interface CommitResult {
  created: number
  failed: number
  failures: Array<{ rowIndex: number; assetTag: string; error: string }>
}

export function AssetImportWizard({ orgSlug }: AssetImportWizardProps) {
  const [step, setStep] = useState<Step>('upload')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ValidationRow[]>([])
  const [validCount, setValidCount] = useState(0)
  const [invalidCount, setInvalidCount] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CommitResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function downloadTemplate() {
    const header = CSV_HEADERS.join(',')
    const example = CSV_TEMPLATE_ROW.join(',')
    const content = `${header}\n${example}\n`
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'asset-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)

    if (file.size > 2 * 1024 * 1024) {
      setError('File exceeds 2 MB limit')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
    }
    reader.readAsText(file)
  }

  function handleValidate() {
    if (!csvText) {
      setError('Please select a CSV file first')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await validateAssetImportCsv(orgSlug, csvText)
      if (!res.success) {
        setError(res.error || 'Validation failed')
        return
      }
      setRows(res.rows ?? [])
      setValidCount(res.validCount ?? 0)
      setInvalidCount(res.invalidCount ?? 0)
      setStep('preview')
    })
  }

  function handleCommit() {
    startTransition(async () => {
      const res = await commitAssetImportCsv(orgSlug, csvText)
      if (!res.success) {
        setError(res.error || 'Import failed')
        return
      }
      setResult({
        created: res.created ?? 0,
        failed: res.failed ?? 0,
        failures: res.failures ?? [],
      })
      setStep('result')
    })
  }

  function handleReset() {
    setStep('upload')
    setCsvText('')
    setFileName('')
    setRows([])
    setValidCount(0)
    setInvalidCount(0)
    setError('')
    setResult(null)
  }

  // ─── Upload Step ───
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-text-muted" />
            <h2 className="text-[15px] font-semibold text-text">Upload CSV File</h2>
          </div>

          <div className="space-y-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-[13px] text-text file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-[13px] file:font-medium file:bg-surface-hover file:text-text hover:file:bg-border"
            />
            {fileName && (
              <p className="text-[13px] text-text-muted">Selected: {fileName}</p>
            )}
            {error && (
              <p className="text-[13px] text-danger">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleValidate} disabled={isPending || !csvText}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Validating...
                </>
              ) : (
                <>
                  Validate & Preview
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
          <h3 className="text-[13px] font-semibold text-text">Format Requirements</h3>
          <ul className="text-[12px] text-text-muted space-y-1 list-disc list-inside">
            <li>CSV file with headers: {CSV_HEADERS.join(', ')}</li>
            <li><strong>name</strong> and <strong>asset_tag</strong> are required</li>
            <li><strong>category</strong> must match an existing asset category name (case-insensitive)</li>
            <li><strong>asset_tag</strong> must be unique within the organisation</li>
            <li><strong>purchase_date</strong> format: YYYY-MM-DD</li>
            <li><strong>purchase_value</strong>: decimal number (e.g. 3200.00)</li>
            <li>Maximum 500 rows, 2 MB file size</li>
          </ul>
        </div>
      </div>
    )
  }

  // ─── Preview Step ───
  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-[13px] text-success font-medium">
                <CheckCircle className="h-4 w-4 inline mr-1" />
                {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="text-[13px] text-danger font-medium">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {invalidCount} invalid
                </span>
              )}
            </div>
            <p className="text-[12px] text-text-muted">
              Only valid rows will be imported.
            </p>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="px-2 py-1.5 font-medium">Row</th>
                  <th className="px-2 py-1.5 font-medium">Name</th>
                  <th className="px-2 py-1.5 font-medium">Tag</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`border-b border-border last:border-0 ${
                      row.isValid ? '' : 'bg-danger/5'
                    }`}
                  >
                    <td className="px-2 py-1.5 text-text-muted">{row.rowIndex}</td>
                    <td className="px-2 py-1.5 text-text">{row.name || '—'}</td>
                    <td className="px-2 py-1.5 text-text-muted">{row.assetTag || '—'}</td>
                    <td className="px-2 py-1.5">
                      {row.isValid ? (
                        <span className="text-success">✓</span>
                      ) : (
                        <span className="text-danger">✗</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-danger max-w-[300px]">
                      {row.errors.join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleReset} disabled={isPending}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleCommit}
            disabled={isPending || validCount === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importing...
              </>
            ) : (
              <>
                Import {validCount} Asset{validCount !== 1 ? 's' : ''}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ─── Result Step ───
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-success" />
          <h2 className="text-[15px] font-semibold text-text">Import Complete</h2>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] text-text">
            <span className="text-success font-medium">{result?.created}</span> asset{result?.created !== 1 ? 's' : ''} imported successfully.
          </p>
          {(result?.failed ?? 0) > 0 && (
            <p className="text-[13px] text-danger">
              {result?.failed} row{result?.failed !== 1 ? 's' : ''} failed to import.
            </p>
          )}
        </div>

        {result?.failures && result.failures.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[13px] font-medium text-text mb-2">Failed Rows</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Tag</th>
                    <th className="px-2 py-1.5 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failures.map((f) => (
                    <tr key={f.rowIndex} className="border-b border-border last:border-0">
                      <td className="px-2 py-1.5 text-text-muted">{f.rowIndex}</td>
                      <td className="px-2 py-1.5 text-text">{f.assetTag}</td>
                      <td className="px-2 py-1.5 text-danger">{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link href={`/${orgSlug}/assets/register`}>
          <Button variant="ghost">View Asset Register</Button>
        </Link>
        <Button onClick={handleReset}>Import More</Button>
      </div>
    </div>
  )
}
