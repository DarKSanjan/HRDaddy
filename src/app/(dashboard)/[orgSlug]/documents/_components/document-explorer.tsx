'use client'

/**
 * Document Explorer — icon-grid style UI with breadcrumb navigation.
 * Renders folder/file entries as tiles in a responsive grid.
 * Includes upload button and per-file actions (replace, archive, delete) when viewing
 * the employee-document-folder level (Employee Documents > [employee] > [category]).
 */
import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Folder, FileText, Download, ChevronRight, Upload, MoreVertical, RefreshCw, Archive, Trash2 } from 'lucide-react'
import { Button } from '@/core/ui'
import type { ExplorerEntry } from '@/modules/documents/explorer-queries'
import { UploadDocumentDialog } from './upload-document-dialog'
import { ReplaceDocumentDialog } from './replace-document-dialog'
import { ArchiveDocumentDialog, DeleteDocumentDialog } from './document-action-dialogs'

interface DocumentExplorerProps {
  orgSlug: string
  entries: ExplorerEntry[]
  breadcrumbs: Array<{ label: string; path: string }>
  /** Callback path prefix for file actions */
  basePath: string
  /** When in a category folder view, pass these for upload/actions */
  fileContext?: {
    employeeId: string
    categoryId: string
    /** User has document.upload permission */
    canUpload: boolean
    /** User has document.view_all permission (needed for permanent delete) */
    canDelete: boolean
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentExplorer({ orgSlug, entries, breadcrumbs, basePath, fileContext }: DocumentExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showUpload, setShowUpload] = useState(false)

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
      {/* Breadcrumbs + Upload button */}
      <div className="flex items-center justify-between">
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

        {fileContext?.canUpload && (
          <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        )}
      </div>

      {/* Explorer grid */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface py-16">
          <Folder className="h-10 w-10 text-text-subtle" aria-hidden="true" />
          <p className="mt-3 text-[13px] text-text-muted">
            This folder is empty.
          </p>
          {fileContext?.canUpload && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4" />
              Upload a document
            </Button>
          )}
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
                canUpload={fileContext?.canUpload ?? false}
                canDelete={fileContext?.canDelete ?? false}
              />
            )
          })}
        </div>
      )}

      {/* Upload dialog */}
      {fileContext && (
        <UploadDocumentDialog
          orgSlug={orgSlug}
          employeeId={fileContext.employeeId}
          categoryId={fileContext.categoryId}
          open={showUpload}
          onOpenChange={setShowUpload}
        />
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
// File tile with actions
// ─────────────────────────────────────────────

function FileTile({
  entry,
  orgSlug,
  canUpload,
  canDelete,
}: {
  entry: ExplorerEntry
  orgSlug: string
  canUpload: boolean
  canDelete: boolean
}) {
  const isVirtual = 'isVirtual' in entry && entry.isVirtual
  const isArchived = 'isArchived' in entry && entry.isArchived
  const isRealDocument = !isVirtual
  const showActions = isRealDocument && (canUpload || canDelete)

  const [showMenu, setShowMenu] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  return (
    <>
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
        {isArchived && (
          <span className="text-[10px] text-text-subtle italic">Archived</span>
        )}

        {/* Action buttons — visible on hover/touch */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
          {/* Download */}
          {isVirtual && 'recordId' in entry && entry.recordId ? (
            <DownloadPdfIconButton orgSlug={orgSlug} recordId={entry.recordId} pdfType={'pdfType' in entry ? entry.pdfType : 'payroll'} />
          ) : (
            <DownloadDocIconButton orgSlug={orgSlug} documentId={entry.id} />
          )}

          {/* More actions menu */}
          {showActions && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-surface border border-border shadow-sm transition-colors hover:bg-surface-hover"
                aria-label="More actions"
                aria-expanded={showMenu}
              >
                <MoreVertical className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              </button>

              {showMenu && (
                <FileActionMenu
                  canUpload={canUpload}
                  canDelete={canDelete}
                  isArchived={!!isArchived}
                  onReplace={() => { setShowMenu(false); setShowReplace(true) }}
                  onArchive={() => { setShowMenu(false); setShowArchive(true) }}
                  onDelete={() => { setShowMenu(false); setShowDelete(true) }}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {isRealDocument && (
        <>
          <ReplaceDocumentDialog
            orgSlug={orgSlug}
            documentId={entry.id}
            currentFileName={entry.name}
            open={showReplace}
            onOpenChange={setShowReplace}
          />
          <ArchiveDocumentDialog
            orgSlug={orgSlug}
            documentId={entry.id}
            fileName={entry.name}
            open={showArchive}
            onOpenChange={setShowArchive}
          />
          <DeleteDocumentDialog
            orgSlug={orgSlug}
            documentId={entry.id}
            fileName={entry.name}
            open={showDelete}
            onOpenChange={setShowDelete}
          />
        </>
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// File action dropdown menu
// ─────────────────────────────────────────────

function FileActionMenu({
  canUpload,
  canDelete,
  isArchived,
  onReplace,
  onArchive,
  onDelete,
  onClose,
}: {
  canUpload: boolean
  canDelete: boolean
  isArchived: boolean
  onReplace: () => void
  onArchive: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop to close menu */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        className="absolute right-0 top-8 z-50 w-40 rounded-[var(--radius-sm)] border border-border bg-surface shadow-lg py-1"
      >
        {/* Replace — only for non-archived documents by users with upload permission */}
        {canUpload && !isArchived && (
          <button
            type="button"
            role="menuitem"
            onClick={onReplace}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-text hover:bg-surface-hover transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Replace
          </button>
        )}

        {/* Archive — only for non-archived documents by users with upload permission */}
        {canUpload && !isArchived && (
          <button
            type="button"
            role="menuitem"
            onClick={onArchive}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-text hover:bg-surface-hover transition-colors"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Archive
          </button>
        )}

        {/* Delete — only for archived documents by users with view_all permission */}
        {canDelete && isArchived && (
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-danger hover:bg-surface-hover transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// Download icon buttons (hover overlay)
// ─────────────────────────────────────────────

function DownloadPdfIconButton({ orgSlug, recordId, pdfType }: { orgSlug: string; recordId: string; pdfType?: string }) {
  const handleDownload = useCallback(async () => {
    let result: { success: boolean; data?: { buffer: number[]; fileName: string } } | null = null

    if (pdfType === 'performance-cycle') {
      const { downloadCyclePdf } = await import('@/modules/performance/pdf-actions')
      result = await downloadCyclePdf(orgSlug, recordId)
    } else if (pdfType === 'performance-review') {
      const { downloadEmployeeCyclePdf } = await import('@/modules/performance/pdf-actions')
      result = await downloadEmployeeCyclePdf(orgSlug, recordId)
    } else {
      const { downloadEmployeePdf } = await import('@/modules/payroll/pdf-actions')
      result = await downloadEmployeePdf(orgSlug, recordId)
    }

    if (result?.success && result.data) {
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
  }, [orgSlug, recordId, pdfType])

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
