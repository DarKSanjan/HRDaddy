'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/core/ui'
import { Upload, CheckCircle, AlertCircle, Download, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { validateImportCsv, commitImportCsv } from '@/modules/employees/import-actions'
import { CSV_HEADERS, CSV_TEMPLATE_ROW } from '@/modules/employees/import-constants'
import Link from 'next/link'

interface ImportWizardProps {
  orgSlug: string
}

type Step = 'upload' | 'preview' | 'result'

interface ValidationRow {
  rowIndex: number
  firstName: string
  lastName: string
  workEmail: string
  errors: string[]
  isValid: boolean
}

interface CommitResult {
  created: number
  failed: number
  failures: Array<{ rowIndex: number; workEmail: string; error: string }>
  managerWarnings: Array<{ rowIndex: number; workEmail: string; warning: string }>
}

export function ImportWizard({ orgSlug }: ImportWizardProps) {
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
    a.download = 'employee-import-template.csv'
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
      const res = await validateImportCsv(orgSlug, csvText)
      if (!res.success) {
        setError(res.error ?? 'Validation failed')
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
      const res = await commitImportCsv(orgSlug, csvText)
      if (!res.success) {
        setError(res.error ?? 'Import failed')
        return
      }
      setResult({
        created: res.created ?? 0,
        failed: res.failed ?? 0,
        failures: res.failures ?? [],
        managerWarnings: res.managerWarnings ?? [],
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

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-[13px]">
        <StepBadge label="1. Upload" active={step === 'upload'} done={step !== 'upload'} />
        <ArrowRight className="h-3 w-3 text-text-muted" />
        <StepBadge label="2. Preview" active={step === 'preview'} done={step === 'result'} />
        <ArrowRight className="h-3 w-3 text-text-muted" />
        <StepBadge label="3. Result" active={step === 'result'} done={false} />
      </div>

      {error && (
        <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-[13px] text-danger">
          <AlertCircle className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
          {error}
        </div>
      )}

      {/* Upload step */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Upload className="mx-auto mb-3 h-8 w-8 text-text-muted" />
            <p className="text-[14px] font-medium text-text mb-1">
              {fileName ? fileName : 'Choose a CSV file'}
            </p>
            <p className="text-[13px] text-text-muted mb-4">
              Maximum 500 rows, 2 MB file size
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button variant="secondary" size="sm" asChild>
                <span>Select File</span>
              </Button>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={downloadTemplate} variant="secondary" size="sm">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          <div className="rounded-md border border-border bg-surface-secondary p-4 text-[13px] text-text-muted space-y-2">
            <p className="font-medium text-text">CSV Format Requirements:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Required columns: <code className="text-[12px] bg-surface-tertiary px-1 rounded">first_name</code>, <code className="text-[12px] bg-surface-tertiary px-1 rounded">last_name</code>, <code className="text-[12px] bg-surface-tertiary px-1 rounded">work_email</code></li>
              <li>Lookup columns (department, job_title, location, employment_type, shift_template) must match existing names exactly</li>
              <li>manager_email references an existing employee&apos;s or another row&apos;s work email</li>
              <li>compensation_amount is in dollars (e.g. 5000 = $5,000.00)</li>
              <li>pay_type must be SALARIED or HOURLY</li>
              <li>Dates use YYYY-MM-DD format</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleValidate} disabled={!csvText || isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Validate & Preview
            </Button>
          </div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle className="h-4 w-4" />
              {validCount} valid
            </span>
            {invalidCount > 0 && (
              <span className="flex items-center gap-1.5 text-danger">
                <AlertCircle className="h-4 w-4" />
                {invalidCount} with errors
              </span>
            )}
          </div>

          {invalidCount > 0 && (
            <p className="text-[13px] text-text-muted">
              Only the {validCount} valid row(s) will be imported. Rows with errors will be skipped.
            </p>
          )}

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-3 py-2 text-left font-medium text-text-muted">#</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Work Email</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Errors</th>
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
                    <td className="px-3 py-2 text-text-muted">{row.rowIndex}</td>
                    <td className="px-3 py-2 text-text">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-3 py-2 text-text">{row.workEmail}</td>
                    <td className="px-3 py-2">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle className="h-3.5 w-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <AlertCircle className="h-3.5 w-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-danger">
                      {row.errors.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5">
                          {row.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={handleReset}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleCommit}
              disabled={validCount === 0 || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {validCount} Employee{validCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Result step */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-success/20 bg-success/10 p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-success" />
            <h2 className="text-[16px] font-semibold text-text mb-1">Import Complete</h2>
            <p className="text-[14px] text-text-muted">
              {result.created} employee{result.created !== 1 ? 's' : ''} created successfully
              {result.failed > 0 && `, ${result.failed} failed`}
            </p>
          </div>

          {result.failures.length > 0 && (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-[13px]">
              <p className="font-medium text-danger mb-2">Failed rows:</p>
              <ul className="list-disc pl-5 space-y-1 text-danger">
                {result.failures.map((f, i) => (
                  <li key={i}>
                    Row {f.rowIndex} ({f.workEmail}): {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.managerWarnings.length > 0 && (
            <div className="rounded-md border border-warning/20 bg-warning/10 p-4 text-[13px]">
              <p className="font-medium text-warning mb-2">
                Employees created, but a manager link was skipped:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-warning">
                {result.managerWarnings.map((w, i) => (
                  <li key={i}>
                    Row {w.rowIndex} ({w.workEmail}): {w.warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Link href={`/${orgSlug}/employees`}>
              <Button>View Employees</Button>
            </Link>
            <Button variant="secondary" onClick={handleReset}>
              Import More
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${
        active
          ? 'bg-primary text-primary-foreground'
          : done
          ? 'bg-green-100 text-green-800'
          : 'bg-surface-secondary text-text-muted'
      }`}
    >
      {label}
    </span>
  )
}
