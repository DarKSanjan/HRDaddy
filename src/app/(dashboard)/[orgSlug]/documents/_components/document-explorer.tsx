'use client'

/**
 * Document Explorer — file-explorer style UI with breadcrumb navigation.
 * Renders folder/file entries with icons and click-to-navigate.
 */
import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/core/ui'
import { Folder, FileText, Download, ChevronRight } from 'lucide-react'
import type { ExplorerEntry } from '@/modules/documents/explorer-queries'

interface DocumentExplorerProps {
  orgSlug: string
  entries: ExplorerEntry[]
  breadcrumbs: Array<{ label: string; path: string }>
  /** Callback path prefix for file actions */
  basePath: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentExplorer({ orgSlug, entries, breadcrumbs, basePath }: DocumentExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigateTo = useCallback(
    (path: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('path', path)
      router.push(`/${orgSlug}/documents?${params.toString()}`)
    },
    [router, orgSlug, searchParams]
  )

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <nav aria-label="Document explorer breadcrumb" className="flex items-center">
        <ol className="flex items-center gap-1 text-[13px]">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 text-text-subtle" aria-hidden="true" />
                )}
                {isLast ? (
                  <span className="font-medium text-text" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateTo(crumb.path)}
                    className="text-text-muted hover:text-text transition-colors"
                  >
                    {crumb.label}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Explorer grid */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="h-10 w-10 text-text-subtle" aria-hidden="true" />
            <p className="mt-3 text-[13px] text-text-muted">
              This folder is empty.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {entries.map((entry) => {
                if (entry.type === 'folder') {
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => navigateTo(`${basePath}/${entry.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                    >
                      <Folder className="h-5 w-5 text-accent-600 shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-text truncate">
                          {entry.name}
                        </p>
                        {'meta' in entry && entry.meta && (
                          <p className="text-[11px] text-text-muted">{entry.meta}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-subtle shrink-0" aria-hidden="true" />
                    </button>
                  )
                }

                // File entry
                const isVirtual = 'isVirtual' in entry && entry.isVirtual
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <FileText className="h-5 w-5 text-text-subtle shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-text truncate">
                        {entry.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted">
                        {'fileSize' in entry && entry.fileSize && (
                          <span>{formatFileSize(entry.fileSize)}</span>
                        )}
                        {'createdAt' in entry && entry.createdAt && (
                          <span>{new Date(entry.createdAt).toLocaleDateString('en-SG')}</span>
                        )}
                        {isVirtual && (
                          <span className="text-accent-600">On-demand PDF</span>
                        )}
                      </div>
                    </div>
                    {isVirtual && 'recordId' in entry && entry.recordId ? (
                      <DownloadPdfButton orgSlug={orgSlug} recordId={entry.recordId} />
                    ) : (
                      <DownloadDocButton orgSlug={orgSlug} documentId={entry.id} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Download buttons (client-side actions)
// ─────────────────────────────────────────────

function DownloadPdfButton({ orgSlug, recordId }: { orgSlug: string; recordId: string }) {
  const handleDownload = useCallback(async () => {
    const { downloadEmployeePdf } = await import('@/modules/payroll/pdf-actions')
    const result = await downloadEmployeePdf(orgSlug, recordId)
    if (result.success && result.data) {
      const bytes = new Uint8Array(result.data.buffer)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.data.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [orgSlug, recordId])

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      aria-label="Download PDF"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span>PDF</span>
    </button>
  )
}

function DownloadDocButton({ orgSlug, documentId }: { orgSlug: string; documentId: string }) {
  const handleDownload = useCallback(async () => {
    const { getDocumentDownloadUrl } = await import('@/modules/documents/actions')
    const result = await getDocumentDownloadUrl(orgSlug, documentId)
    if (result.success && result.data) {
      const { url, fileName } = result.data as { url: string; fileName: string }
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }, [orgSlug, documentId])

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      aria-label="Download document"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Download</span>
    </button>
  )
}
