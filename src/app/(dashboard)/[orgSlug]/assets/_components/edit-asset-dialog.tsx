'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
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
import { updateAsset } from '@/modules/assets/actions'

interface EditAssetDialogProps {
  orgSlug: string
  asset: {
    id: string
    name: string
    assetTag: string
    categoryId: string
    purchaseDate: string | null
    purchaseValueCents: number | null
    notes: string | null
  }
  categories: { id: string; name: string }[]
}

export function EditAssetDialog({ orgSlug, asset, categories }: EditAssetDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState(asset.name)
  const [assetTag, setAssetTag] = useState(asset.assetTag)
  const [categoryId, setCategoryId] = useState(asset.categoryId)
  const [purchaseDate, setPurchaseDate] = useState(
    asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : ''
  )
  const [purchaseValue, setPurchaseValue] = useState(
    asset.purchaseValueCents != null ? (asset.purchaseValueCents / 100).toFixed(2) : ''
  )
  const [notes, setNotes] = useState(asset.notes ?? '')

  const reset = () => {
    setName(asset.name)
    setAssetTag(asset.assetTag)
    setCategoryId(asset.categoryId)
    setPurchaseDate(asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '')
    setPurchaseValue(asset.purchaseValueCents != null ? (asset.purchaseValueCents / 100).toFixed(2) : '')
    setNotes(asset.notes ?? '')
    setError(null)
    setFieldErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})

    const result = await updateAsset(orgSlug, {
      assetId: asset.id,
      name,
      assetTag,
      categoryId,
      purchaseDate: purchaseDate || null,
      purchaseValueCents: purchaseValue ? Math.round(parseFloat(purchaseValue) * 100) : null,
      notes: notes || null,
    })

    if (result.success) {
      setOpen(false)
      router.refresh()
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
    } else {
      setError(result.error ?? 'Failed to update asset.')
    }
    setSaving(false)
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { reset(); setOpen(true) }}>
        <Pencil className="h-3 w-3" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>Update asset details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Asset Name" htmlFor="edit-asset-name" error={fieldErrors.name}>
              <Input
                id="edit-asset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Asset Tag / Serial" htmlFor="edit-asset-tag" error={fieldErrors.assetTag}>
              <Input
                id="edit-asset-tag"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Category" htmlFor="edit-asset-category" error={fieldErrors.categoryId}>
              <Select
                id="edit-asset-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Purchase Date" htmlFor="edit-asset-purchase-date">
                <Input
                  id="edit-asset-purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </FormField>
              <FormField label="Purchase Value ($)" htmlFor="edit-asset-purchase-value">
                <Input
                  id="edit-asset-purchase-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </div>
            <FormField label="Notes" htmlFor="edit-asset-notes">
              <Input
                id="edit-asset-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </FormField>
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
