'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, FormField, Input } from '@/core/ui'
import {
  assignAsset,
  returnAsset,
  markAssetInMaintenance,
  markAssetAvailable,
  retireAsset,
  reportAssetLost,
} from '@/modules/assets/actions'
import type { AssetStatus } from '@prisma/client'

interface AssetListItem {
  id: string
  name: string
  assetTag: string
  status: AssetStatus
  categoryName: string
  currentHolder: { id: string; firstName: string; lastName: string } | null
  purchaseDate: string | null
  purchaseValueCents: number | null
  createdAt: string
}

interface AssetRegisterTableProps {
  assets: AssetListItem[]
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  orgSlug: string
  employees: { id: string; firstName: string; lastName: string }[]
  categories: { id: string; name: string }[]
}

function statusVariant(status: AssetStatus): 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  switch (status) {
    case 'AVAILABLE': return 'success'
    case 'ASSIGNED': return 'info'
    case 'IN_MAINTENANCE': return 'warning'
    case 'RETIRED': return 'neutral'
    case 'LOST': return 'danger'
    default: return 'neutral'
  }
}

type ActionType = 'assign' | 'return' | 'maintenance' | 'available' | 'retire' | 'lost'
type ActionState = ActionType | null

export function AssetRegisterTable({
  assets,
  total,
  currentPage,
  totalPages,
  pageSize,
  orgSlug,
  employees,
}: AssetRegisterTableProps) {
  const router = useRouter()
  const [actionType, setActionType] = useState<ActionState>(null)
  const [actionAssetId, setActionAssetId] = useState<string | null>(null)
  const [actionAssetName, setActionAssetName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Assign form state
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const [assignCondition, setAssignCondition] = useState('')
  const [assignNotes, setAssignNotes] = useState('')

  // Return form state
  const [returnCondition, setReturnCondition] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnToMaintenance, setReturnToMaintenance] = useState(false)

  // Simple notes for other actions
  const [actionNotes, setActionNotes] = useState('')

  const resetDialog = () => {
    setActionType(null)
    setActionAssetId(null)
    setActionAssetName('')
    setError(null)
    setAssignEmployeeId('')
    setAssignCondition('')
    setAssignNotes('')
    setReturnCondition('')
    setReturnNotes('')
    setReturnToMaintenance(false)
    setActionNotes('')
  }

  const openAction = (type: ActionType, assetId: string, assetName: string) => {
    resetDialog()
    setActionType(type)
    setActionAssetId(assetId)
    setActionAssetName(assetName)
  }

  const handleAction = async () => {
    if (!actionAssetId || !actionType) return
    setProcessing(true)
    setError(null)

    let result
    switch (actionType) {
      case 'assign':
        result = await assignAsset(orgSlug, {
          assetId: actionAssetId,
          employeeId: assignEmployeeId,
          conditionAtAssignment: assignCondition || undefined,
          notes: assignNotes || undefined,
        })
        break
      case 'return':
        result = await returnAsset(orgSlug, {
          assetId: actionAssetId,
          conditionAtReturn: returnCondition || undefined,
          notes: returnNotes || undefined,
          returnToMaintenance,
        })
        break
      case 'maintenance':
        result = await markAssetInMaintenance(orgSlug, { assetId: actionAssetId, notes: actionNotes || undefined })
        break
      case 'available':
        result = await markAssetAvailable(orgSlug, { assetId: actionAssetId, notes: actionNotes || undefined })
        break
      case 'retire':
        result = await retireAsset(orgSlug, { assetId: actionAssetId, notes: actionNotes || undefined })
        break
      case 'lost':
        result = await reportAssetLost(orgSlug, { assetId: actionAssetId, notes: actionNotes || undefined })
        break
    }

    if (result?.success) {
      resetDialog()
      router.refresh()
    } else {
      setError(result?.error ?? 'Action failed.')
    }
    setProcessing(false)
  }

  const getAvailableActions = (status: AssetStatus): ActionType[] => {
    switch (status) {
      case 'AVAILABLE': return ['assign', 'maintenance', 'retire', 'lost']
      case 'ASSIGNED': return ['return', 'lost']
      case 'IN_MAINTENANCE': return ['available', 'retire', 'lost']
      default: return []
    }
  }

  const actionLabels: Record<string, string> = {
    assign: 'Assign',
    return: 'Return',
    maintenance: 'Maintenance',
    available: 'Mark Available',
    retire: 'Retire',
    lost: 'Report Lost',
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Tag</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Current Holder</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <Link
                    href={`/${orgSlug}/assets/${asset.id}`}
                    className="text-text font-medium hover:text-accent-500 transition-colors"
                  >
                    {asset.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-text-muted">{asset.assetTag}</td>
                <td className="px-3 py-2 text-text">{asset.categoryName}</td>
                <td className="px-3 py-2">
                  <Badge variant={statusVariant(asset.status)}>
                    {asset.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-text">
                  {asset.currentHolder
                    ? `${asset.currentHolder.firstName} ${asset.currentHolder.lastName}`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {getAvailableActions(asset.status).map((action) => (
                      <Button
                        key={action}
                        size="sm"
                        variant="ghost"
                        onClick={() => openAction(action, asset.id, asset.name)}
                      >
                        {actionLabels[action]}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-text-muted">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
          </span>
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'assign' && 'Assign Asset'}
              {actionType === 'return' && 'Return Asset'}
              {actionType === 'maintenance' && 'Mark In Maintenance'}
              {actionType === 'available' && 'Mark Available'}
              {actionType === 'retire' && 'Retire Asset'}
              {actionType === 'lost' && 'Report Asset Lost'}
            </DialogTitle>
            <DialogDescription>
              {actionAssetName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'assign' && (
              <>
                <FormField label="Employee" htmlFor="assign-employee">
                  <select
                    id="assign-employee"
                    value={assignEmployeeId}
                    onChange={(e) => setAssignEmployeeId(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text"
                    required
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Condition at Assignment" htmlFor="assign-condition">
                  <Input
                    id="assign-condition"
                    value={assignCondition}
                    onChange={(e) => setAssignCondition(e.target.value)}
                    placeholder="e.g. Good, minor scratches"
                  />
                </FormField>
                <FormField label="Notes" htmlFor="assign-notes">
                  <Input
                    id="assign-notes"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </FormField>
              </>
            )}

            {actionType === 'return' && (
              <>
                <FormField label="Condition at Return" htmlFor="return-condition">
                  <Input
                    id="return-condition"
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    placeholder="e.g. Good, screen cracked"
                  />
                </FormField>
                <FormField label="Notes" htmlFor="return-notes">
                  <Input
                    id="return-notes"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </FormField>
                <label className="flex items-center gap-2 text-[13px] text-text">
                  <input
                    type="checkbox"
                    checked={returnToMaintenance}
                    onChange={(e) => setReturnToMaintenance(e.target.checked)}
                    className="rounded border-border"
                  />
                  Send to maintenance after return
                </label>
              </>
            )}

            {(actionType === 'maintenance' || actionType === 'available' || actionType === 'retire' || actionType === 'lost') && (
              <FormField label="Notes" htmlFor="action-notes">
                <Input
                  id="action-notes"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </FormField>
            )}

            {actionType === 'retire' && (
              <p className="text-[12px] text-warning">This action is permanent. The asset will be marked as retired.</p>
            )}
            {actionType === 'lost' && (
              <p className="text-[12px] text-danger">This action is permanent. The asset will be marked as lost.</p>
            )}

            {error && <p className="text-[13px] text-danger">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={resetDialog}>Cancel</Button>
            <Button
              variant={actionType === 'lost' || actionType === 'retire' ? 'danger' : 'primary'}
              onClick={handleAction}
              disabled={processing || (actionType === 'assign' && !assignEmployeeId)}
            >
              {processing ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
