'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  FormField,
  Select,
} from '@/core/ui'
import { requestAsset, cancelAssetRequest } from '@/modules/assets/actions'
import type { AssetRequestItem } from '@/modules/assets/queries'

interface Category {
  id: string
  name: string
}

interface AvailableAsset {
  id: string
  name: string
  assetTag: string
}

interface RequestAssetSectionProps {
  orgSlug: string
  categories: Category[]
  myRequests: AssetRequestItem[]
}

function requestStatusVariant(status: string): 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  switch (status) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'info'
    case 'REJECTED': return 'danger'
    case 'FULFILLED': return 'success'
    default: return 'neutral'
  }
}

export function RequestAssetSection({ orgSlug, categories, myRequests }: RequestAssetSectionProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Form state
  const [categoryId, setCategoryId] = useState('')
  const [requestedAssetId, setRequestedAssetId] = useState('')
  const [reason, setReason] = useState('')
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)

  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId)
    setRequestedAssetId('')
    setAvailableAssets([])

    if (newCategoryId) {
      setLoadingAssets(true)
      import('@/modules/assets/actions')
        .then(({ getAvailableAssetsInCategory }) =>
          getAvailableAssetsInCategory(orgSlug, newCategoryId)
        )
        .then((data) => setAvailableAssets(data))
        .catch(() => setAvailableAssets([]))
        .finally(() => setLoadingAssets(false))
    }
  }

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      const result = await requestAsset(orgSlug, {
        categoryId,
        requestedAssetId: requestedAssetId || undefined,
        reason,
      })
      if (result.success) {
        setIsOpen(false)
        setCategoryId('')
        setRequestedAssetId('')
        setReason('')
        router.refresh()
      } else {
        setError(result.error || Object.values(result.fieldErrors ?? {}).join(', '))
      }
    })
  }

  function handleCancel(requestId: string) {
    startTransition(async () => {
      const result = await cancelAssetRequest(orgSlug, { requestId })
      if (result.success) {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text">My Asset Requests</h2>
        <Button size="sm" onClick={() => setIsOpen(true)}>
          Request Asset
        </Button>
      </div>

      {myRequests.length === 0 ? (
        <p className="text-[13px] text-text-muted py-4 text-center">
          No asset requests yet. Click &quot;Request Asset&quot; to ask for equipment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Requested Asset</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((req) => (
                <tr key={req.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-text">{req.categoryName}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {req.requestedAssetName
                      ? `${req.requestedAssetName} (${req.requestedAssetTag})`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-text max-w-[200px] truncate">{req.reason}</td>
                  <td className="px-3 py-2">
                    <Badge variant={requestStatusVariant(req.status)}>{req.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {new Date(req.requestedAt).toLocaleDateString('en-SG', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 text-text-muted max-w-[150px] truncate">
                    {req.reviewNote || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {req.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancel(req.id)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                    )}
                    {req.status === 'FULFILLED' && req.fulfilledAssetName && (
                      <span className="text-[12px] text-text-muted">
                        {req.fulfilledAssetName}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request an Asset</DialogTitle>
            <DialogDescription>
              Select the type of asset you need and provide a reason for your request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <p className="text-[13px] text-danger">{error}</p>
            )}

            <FormField label="Category" htmlFor="request-category" required>
              <Select
                id="request-category"
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </FormField>

            {categoryId && (
              <FormField label="Specific Asset (optional)" htmlFor="request-asset">
                <Select
                  id="request-asset"
                  value={requestedAssetId}
                  onChange={(e) => setRequestedAssetId(e.target.value)}
                  disabled={loadingAssets}
                >
                  <option value="">Any available asset in this category</option>
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.assetTag})
                    </option>
                  ))}
                </Select>
                {loadingAssets && (
                  <p className="text-[12px] text-text-muted mt-1">Loading available assets...</p>
                )}
              </FormField>
            )}

            <FormField label="Reason" htmlFor="request-reason" required>
              <textarea
                id="request-reason"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text min-h-[80px] resize-y"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need this asset?"
                maxLength={2000}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !categoryId || !reason.trim()}
            >
              {isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
