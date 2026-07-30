'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  FormField,
  Input,
  Select,
} from '@/core/ui'
import { submitExpenseClaim, uploadExpenseReceipt } from '@/modules/expenses/actions'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/modules/documents/schemas'

interface SubmitExpenseDialogProps {
  orgSlug: string
  categories: { id: string; name: string }[]
  defaultCurrency: string
}

export function SubmitExpenseDialog({ orgSlug, categories, defaultCurrency }: SubmitExpenseDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    if (!selected) {
      setReceiptFile(null)
      return
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      setError(`File type "${selected.type || 'unknown'}" not allowed.`)
      setReceiptFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError('File exceeds maximum size of 25MB.')
      setReceiptFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setReceiptFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})

    const form = e.currentTarget
    const formData = new FormData(form)

    // Convert dollar amount to cents
    const amountStr = formData.get('amount') as string
    const amountCents = Math.round(parseFloat(amountStr || '0') * 100)
    formData.set('amountCents', String(amountCents))
    formData.delete('amount')

    if (!formData.get('currency')) {
      formData.set('currency', defaultCurrency)
    }

    if (receiptFile) {
      const arrayBuffer = await receiptFile.arrayBuffer()
      const uploadResult = await uploadExpenseReceipt(
        orgSlug,
        { fileName: receiptFile.name, mimeType: receiptFile.type, fileSize: receiptFile.size },
        new Uint8Array(arrayBuffer)
      )
      if (!uploadResult.success) {
        setError(uploadResult.error ?? 'Failed to upload receipt.')
        setSaving(false)
        return
      }
      const uploaded = uploadResult.data as { id: string }
      formData.set('receiptDocumentId', uploaded.id)
    }

    const result = await submitExpenseClaim(orgSlug, formData)

    if (result.success) {
      setOpen(false)
      setReceiptFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
    } else {
      setError(result.error ?? 'Failed to submit expense claim.')
    }
    setSaving(false)
  }

  return (
    <>
      <Button size="md" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Expense
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Expense Claim</DialogTitle>
            <DialogDescription>
              Submit a new expense claim for approval.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Category" htmlFor="categoryId" error={fieldErrors.categoryId}>
              <Select
                id="categoryId"
                name="categoryId"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Amount" htmlFor="amount" error={fieldErrors.amountCents}>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                  className="flex-1"
                />
                <Input
                  name="currency"
                  type="text"
                  defaultValue={defaultCurrency}
                  maxLength={3}
                  className="w-20"
                  required
                />
              </div>
            </FormField>

            <FormField label="Expense Date" htmlFor="expenseDate" error={fieldErrors.expenseDate}>
              <Input id="expenseDate" name="expenseDate" type="date" required />
            </FormField>

            <FormField label="Description" htmlFor="description" error={fieldErrors.description}>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Describe the expense..."
                required
              />
            </FormField>

            <FormField label="Receipt" htmlFor="receipt" hint="Optional. PDF, PNG, JPEG, or WebP, max 25MB.">
              <Input
                ref={fileInputRef}
                id="receipt"
                type="file"
                accept={(ALLOWED_MIME_TYPES as readonly string[]).join(',')}
                onChange={handleFileChange}
              />
              {receiptFile && (
                <p className="mt-1 text-[12px] text-text-muted">
                  {receiptFile.name} ({(receiptFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </FormField>

            {error && (
              <p className="text-[13px] text-danger">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Submitting...' : 'Submit Claim'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
