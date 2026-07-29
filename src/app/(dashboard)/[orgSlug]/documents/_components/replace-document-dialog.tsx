'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import {
  Button,
  FormField,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/core/ui'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/modules/documents/schemas'

interface ReplaceDocumentDialogProps {
  orgSlug: string
  documentId: string
  currentFileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FRIENDLY_MIME_MAP: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
}

const ACCEPT_STRING = ALLOWED_MIME_TYPES.join(',')

export function ReplaceDocumentDialog({
  orgSlug,
  documentId,
  currentFileName,
  open,
  onOpenChange,
}: ReplaceDocumentDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setFile(null)
    setError(null)
    setFieldErrors({})
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    setFieldErrors({})

    if (!selected) {
      setFile(null)
      return
    }

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      setError(
        `File type "${selected.type || 'unknown'}" not allowed. Accepted: ${Object.values(FRIENDLY_MIME_MAP).join(', ')}`
      )
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(`File exceeds maximum size of 25MB (${(selected.size / (1024 * 1024)).toFixed(1)} MB)`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      const metadata = {
        documentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }

      const { replaceDocument } = await import('@/modules/documents/actions')
      const result = await replaceDocument(orgSlug, metadata, buffer)

      if (result.success) {
        reset()
        onOpenChange(false)
        router.refresh()
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
      } else {
        setError(result.error ?? 'Replace failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Document</DialogTitle>
          <DialogDescription>
            Replace &ldquo;{currentFileName}&rdquo; with a new file. The previous version will be
            removed from storage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <FormField
            label="New File"
            htmlFor="replace-file"
            required
            error={fieldErrors.fileName || fieldErrors.mimeType || fieldErrors.fileSize}
          >
            <Input
              ref={fileInputRef}
              id="replace-file"
              type="file"
              accept={ACCEPT_STRING}
              onChange={handleFileChange}
              required
            />
          </FormField>

          {file && (
            <p className="text-[12px] text-text-muted">
              {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          )}

          {error && (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={saving}
              disabled={!file || saving}
            >
              <RefreshCw className="h-4 w-4" />
              Replace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
