'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'

interface ArchiveDocumentDialogProps {
  orgSlug: string
  documentId: string
  fileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArchiveDocumentDialog({
  orgSlug,
  documentId,
  fileName,
  open,
  onOpenChange,
}: ArchiveDocumentDialogProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleArchive = async () => {
    setSaving(true)
    setError(null)

    try {
      const { archiveDocument } = await import('@/modules/documents/actions')
      const result = await archiveDocument(orgSlug, documentId)

      if (result.success) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Failed to archive document.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive &ldquo;{fileName}&rdquo;? Archived documents can no
            longer be replaced but remain accessible for download.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-[12px] text-danger" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleArchive} loading={saving}>
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDocumentDialogProps {
  orgSlug: string
  documentId: string
  fileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteDocumentDialog({
  orgSlug,
  documentId,
  fileName,
  open,
  onOpenChange,
}: DeleteDocumentDialogProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSaving(true)
    setError(null)

    try {
      const { deleteDocument } = await import('@/modules/documents/actions')
      const result = await deleteDocument(orgSlug, documentId)

      if (result.success) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Failed to delete document.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently Delete Document</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{fileName}&rdquo; from storage. This action cannot
            be undone. Only archived documents can be deleted.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-[12px] text-danger" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={handleDelete} loading={saving}>
            Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
