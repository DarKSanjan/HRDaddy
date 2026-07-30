'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  FormField,
  Select,
} from '@/core/ui'
import {
  approveAssetRequest,
  rejectAssetRequest,
  fulfillAssetRequest,
  getAvailableAssetsInCategory,
} from '@/modules/assets/actions'
import type { AssetRequestItem } from '@/modules/assets/queries'

interface AssetRequestsTableProps {
  requests: AssetRequestItem[]
  total: number
  currentPage: number
  totalPages: number
  orgSlug: string
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

interface AvailableAsset {
  id: string
  name: string
  assetTag: string
}

export function AssetRequestsTable({
  requests,
  total,
  currentPage,
  totalPages,
  orgSlug,
}: AssetRequestsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectRequestId, setRejectRequestId] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [rejectError, setRejectError] = useState('')

  // Fulfill dialog state
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false)
  const [fulfillRequestId, setFulfillRequestId] = useState('')
  const [fulfillAssetId, setFulfillAssetId] = useState('')
  const [fulfillError, setFulfillError] = useState('')
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)

  function handleApprove(requestId: string) {
    startTransition(async () => {
      const result = await approveAssetRequest(orgSlug, { requestId })
      if (result.success) {
        router.refresh()
      }
    })
  }

  function openRejectDialog(requestId: string) {
    setRejectRequestId(requestId)
    setRejectNote('')
    setRejectError('')
    setRejectDialogOpen(true)
  }

  function handleReject() {
    if (!rejectNote.trim()) {
      setRejectError('Rejection reason is required.')
      return
    }
    startTransition(async () => {
      const result = await rejectAssetRequest(orgSlug, {
        requestId: rejectRequestId,
        reviewNote: rejectNote,
      })
      if (result.success) {
        setRejectDialogOpen(false)
        router.refresh()
      } else {
        setRejectError(result.error || 'Failed to reject request.')
      }
    })
  }

  function openFulfillDialog(requestId: string, categoryId: string) {
    setFulfillRequestId(requestId)
    setFulfillAssetId('')
    setFulfillError('')
    setAvailableAssets([])
    setFulfillDialogOpen(true)

    // Load available assets for the category
    setLoadingAssets(true)
    getAvailableAssetsInCategory(orgSlug, categoryId)
      .then((data) => setAvailableAssets(data))
      .catch(() => setAvailableAssets([]))
      .finally(() => setLoadingAssets(false))
  }

  function handleFulfill() {
    if (!fulfillAssetId) {
      setFulfillError('Please select an asset.')
      return
    }
    startTransition(async () => {
      const result = await fulfillAssetRequest(orgSlug, {
        requestId: fulfillRequestId,
        assetId: fulfillAssetId,
      })
      if (result.success) {
        setFulfillDialogOpen(false)
        router.refresh()
      } else {
        setFulfillError(result.error || 'Failed to fulfill request.')
      }
    })
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Requested Asset</th>
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-text font-medium">
                  {req.employeeFirstName} {req.employeeLastName}
                </td>
                <td className="px-3 py-2 text-text">{req.categoryName}</td>
                <td className="px-3 py-2 text-text-muted">
                  {req.requestedAssetName
                    ? `${req.requestedAssetName} (${req.requestedAssetTag})`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-text max-w-[200px] truncate" title={req.reason}>
                  {req.reason}
                </td>
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
                <td className="px-3 py-2">
                  {req.status === 'PENDING' && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(req.id)}
                        disabled={isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openRejectDialog(req.id)}
                        disabled={isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {req.status === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openFulfillDialog(req.id, req.categoryId)}
                      disabled={isPending}
                    >
                      Fulfill
                    </Button>
                  )}
                  {req.status === 'FULFILLED' && req.fulfilledAssetName && (
                    <span className="text-[12px] text-text-muted">
                      → {req.fulfilledAssetName}
                    </span>
                  )}
                  {req.status === 'REJECTED' && req.reviewNote && (
                    <span className="text-[12px] text-text-muted max-w-[120px] truncate block" title={req.reviewNote}>
                      {req.reviewNote}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <p className="mt-3 text-[12px] text-text-muted text-center">
          Page {currentPage} of {totalPages} ({total} total)
        </p>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Asset Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rejectError && (
              <p className="text-[13px] text-danger">{rejectError}</p>
            )}
            <FormField label="Rejection Reason" htmlFor="reject-note" required>
              <textarea
                id="reject-note"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text min-h-[80px] resize-y"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Why is this request being rejected?"
                maxLength={1000}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={isPending || !rejectNote.trim()}
            >
              {isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Dialog */}
      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fulfill Asset Request</DialogTitle>
            <DialogDescription>
              Select an available asset to assign to the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {fulfillError && (
              <p className="text-[13px] text-danger">{fulfillError}</p>
            )}
            <FormField label="Asset to Assign" htmlFor="fulfill-asset" required>
              {loadingAssets ? (
                <p className="text-[13px] text-text-muted">Loading available assets...</p>
              ) : availableAssets.length === 0 ? (
                <p className="text-[13px] text-danger">
                  No available assets in this category. Add one to the register first.
                </p>
              ) : (
                <Select
                  id="fulfill-asset"
                  value={fulfillAssetId}
                  onChange={(e) => setFulfillAssetId(e.target.value)}
                >
                  <option value="">Select an asset...</option>
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.assetTag})
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFulfillDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleFulfill}
              disabled={isPending || !fulfillAssetId}
            >
              {isPending ? 'Assigning...' : 'Assign & Fulfill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
