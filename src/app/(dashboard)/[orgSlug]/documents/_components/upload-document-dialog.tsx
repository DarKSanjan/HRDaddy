'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
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

interface UploadDocumentDialogProps {
  orgSlug: string
  employeeId: string
  categoryId: string
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

// Local Y/M/D, not toISOString() — toISOString() converts to UTC first,
// which can shift the date by one near local midnight.
function todayLocalDate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function UploadDocumentDialog({
  orgSlug,
  employeeId,
  categoryId,
  open,
  onOpenChange,
}: UploadDocumentDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setFile(null)
    setExpiresAt('')
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

    // Client-side MIME validation
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      setError(
        `File type "${selected.type || 'unknown'}" not allowed. Accepted: ${Object.values(FRIENDLY_MIME_MAP).join(', ')}`
      )
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Client-side size validation
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
        employeeId,
        categoryId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }

      const { uploadDocument } = await import('@/modules/documents/actions')
      const result = await uploadDocument(orgSlug, metadata, buffer)

      if (result.success) {
        reset()
        onOpenChange(false)
        router.refresh()
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
      } else {
        setError(result.error ?? 'Upload failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error during upload.')
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
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a file to upload. Max 25MB. Accepted: {Object.values(FRIENDLY_MIME_MAP).join(', ')}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <FormField
            label="File"
            htmlFor="upload-file"
            required
            error={fieldErrors.fileName || fieldErrors.mimeType || fieldErrors.fileSize}
          >
            <Input
              ref={fileInputRef}
              id="upload-file"
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

          <FormField
            label="Expires At"
            htmlFor="upload-expires"
            hint="Optional. Set if this is a certification or work pass with an expiry date."
            error={fieldErrors.expiresAt}
          >
            <Input
              id="upload-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={todayLocalDate()}
            />
          </FormField>

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
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
