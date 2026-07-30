'use client'

import { useState } from 'react'
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
import { createAsset } from '@/modules/assets/actions'

interface CreateAssetDialogProps {
  orgSlug: string
  categories: { id: string; name: string }[]
  employees: { id: string; firstName: string; lastName: string }[]
}

export function CreateAssetDialog({ orgSlug, categories, employees }: CreateAssetDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [assetTag, setAssetTag] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseValue, setPurchaseValue] = useState('')
  const [notes, setNotes] = useState('')
  const [personInChargeId, setPersonInChargeId] = useState('')

  const reset = () => {
    setName('')
    setAssetTag('')
    setCategoryId('')
    setPurchaseDate('')
    setPurchaseValue('')
    setNotes('')
    setPersonInChargeId('')
    setError(null)
    setFieldErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})

    const result = await createAsset(orgSlug, {
      name,
      assetTag,
      categoryId,
      purchaseDate: purchaseDate || undefined,
      purchaseValueCents: purchaseValue ? Math.round(parseFloat(purchaseValue) * 100) : undefined,
      notes: notes || undefined,
      personInChargeId: personInChargeId || undefined,
    })

    if (result.success) {
      reset()
      setOpen(false)
      router.refresh()
    } else if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
    } else {
      setError(result.error ?? 'Failed to create asset.')
    }
    setSaving(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Asset
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); setOpen(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>Register a new company asset.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Asset Name" htmlFor="asset-name" error={fieldErrors.name}>
              <Input
                id="asset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MacBook Pro 16 2025"
                required
              />
            </FormField>
            <FormField label="Asset Tag / Serial" htmlFor="asset-tag" error={fieldErrors.assetTag}>
              <Input
                id="asset-tag"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g. IT-LAP-001"
                required
              />
            </FormField>
            <FormField label="Category" htmlFor="asset-category" error={fieldErrors.categoryId}>
              <Select
                id="asset-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Purchase Date" htmlFor="asset-purchase-date">
                <Input
                  id="asset-purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </FormField>
              <FormField label="Purchase Value ($)" htmlFor="asset-purchase-value">
                <Input
                  id="asset-purchase-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </div>
            <FormField label="Notes" htmlFor="asset-notes">
              <Input
                id="asset-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </FormField>
            <FormField label="Person in Charge" htmlFor="asset-person-in-charge">
              <Select
                id="asset-person-in-charge"
                value={personInChargeId}
                onChange={(e) => setPersonInChargeId(e.target.value)}
              >
                <option value="">None</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </Select>
            </FormField>
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { reset(); setOpen(false) }}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Asset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
