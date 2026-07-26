'use client'

/**
 * Document Explorer — icon-grid style UI with breadcrumb navigation.
 * Renders folder/file entries as tiles in a responsive grid.
 */
import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface py-16">
          <Folder className="h-10 w-10 text-text-subtle" aria-hidden="true" />
          <p className="mt-3 text-[13px] text-text-muted">
            This folder is empty.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {entries.map((entry) => {
            if (entry.type === 'folder') {
              return (
                <FolderTile
                  key={entry.id}
                  entry={entry}
                  onClick={() => navigateTo(`${basePath}/${entry.id}`)}
                />
              )
            }
            return (
              <FileTile
                key={entry.id}
                entry={entry}
                orgSlug={orgSlug}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Folder tile
// ─────────────────────────────────────────────

function FolderTile({ entry, onClick }: { entry: ExplorerEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-all hover:border-accent-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      <Folder className="h-10 w-10 text-accent-500 group-hover:text-accent-600 transition-colors" aria-hidden="true" />
      <span className="w-full text-center text-[12px] font-medium text-text line-clamp-2 leading-tight">
        {entry.name}
      </span>
      {'meta' in entry && entry.meta && (
        <span className="text-[10px] text-text-muted">{entry.meta}</span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────
// File tile
// ─────────────────────────────────────────────

function FileTile({ entry, orgSlug }: { entry: ExplorerEntry; orgSlug: string }) {
  const isVirtual = 'isVirtual' in entry && entry.isVirtual

  return (
    <div className="group relative flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-all hover:border-accent-300 hover:shadow-sm focus-within:border-accent-300 focus-within:shadow-sm">
      <FileText className="h-10 w-10 text-text-subtle group-hover:text-text-muted transition-colors" aria-hidden="true" />
      <span className="w-full text-center text-[12px] font-medium text-text line-clamp-2 leading-tight">
        {entry.name}
      </span>
      {'fileSize' in entry && entry.fileSize && (
        <span className="text-[10px] text-text-muted">{formatFileSize(entry.fileSize)}</span>
      )}
      {isVirtual && (
        <span className="text-[10px] text-accent-600">PDF</span>
      )}

      {/* Download button — visible on hover/touch always, focus-visible for keyboard nav */}
      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
        {isVirtual && 'recordId' in entry && entry.recordId ? (
          <DownloadPdfIconButton orgSlug={orgSlug} recordId={entry.recordId} />
        ) : (
          <DownloadDocIconButton orgSlug={orgSlug} documentId={entry.id} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Download icon buttons (hover overlay)
// ─────────────────────────────────────────────

function DownloadPdfIconButton({ orgSlug, recordId }: { orgSlug: string; recordId: string }) {
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
      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-surface border border-border shadow-sm transition-colors hover:bg-surface-hover"
      aria-label="Download PDF"
    >
      <Download className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
    </button>
  )
}

function DownloadDocIconButton({ orgSlug, documentId }: { orgSlug: string; documentId: string }) {
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
      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-surface border border-border shadow-sm transition-colors hover:bg-surface-hover"
      aria-label="Download document"
    >
      <Download className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
    </button>
  )
}
