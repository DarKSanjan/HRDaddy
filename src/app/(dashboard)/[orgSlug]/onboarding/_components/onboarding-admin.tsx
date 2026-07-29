'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, XCircle, AlertTriangle, Clock } from 'lucide-react'
import {
  Button,
  Badge,
  Card,
  CardContent,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  FormField,
  Textarea,
} from '@/core/ui'
import {
  assignOnboarding,
  cancelOnboarding,
} from '@/modules/onboarding/actions'
import type { EmployeeOnboardingListItem, OnboardingTemplateListItem } from '@/modules/onboarding/queries'
import { OnboardingDetailPanel } from './onboarding-detail-panel'

interface OnboardingAdminProps {
  orgSlug: string
  onboardings: EmployeeOnboardingListItem[]
  total: number
  templates: OnboardingTemplateListItem[]
  employees: Array<{ id: string; firstName: string; lastName: string }>
}

export function OnboardingAdmin({
  orgSlug,
  onboardings,
  templates,
  employees,
}: OnboardingAdminProps) {
  const router = useRouter()
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSaving, setCancelSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  // Assign form state
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    setAssignSaving(true)
    setAssignError(null)

    const result = await assignOnboarding(orgSlug, {
      employeeId: assignEmployeeId,
      templateId: assignTemplateId,
    })

    if (result.success) {
      setShowAssignDialog(false)
      setAssignEmployeeId('')
      setAssignTemplateId('')
      router.refresh()
    } else {
      setAssignError(result.error ?? 'Failed to assign onboarding.')
    }
    setAssignSaving(false)
  }

  const handleCancel = async () => {
    if (!cancellingId) return
    setCancelSaving(true)
    setCancelError(null)

    const result = await cancelOnboarding(orgSlug, {
      onboardingId: cancellingId,
      reason: cancelReason,
    })

    if (result.success) {
      setCancellingId(null)
      setCancelReason('')
      router.refresh()
    } else {
      setCancelError(result.error ?? 'Failed to cancel onboarding.')
    }
    setCancelSaving(false)
  }

  const statusBadge = (status: string, overdueCount: number) => {
    if (status === 'COMPLETED') return <Badge variant="success">Completed</Badge>
    if (status === 'CANCELLED') return <Badge variant="neutral">Cancelled</Badge>
    if (overdueCount > 0) return <Badge variant="danger">Overdue</Badge>
    if (status === 'IN_PROGRESS') return <Badge variant="default">In Progress</Badge>
    return <Badge variant="info">Not Started</Badge>
  }

  const activeOnboardings = onboardings.filter(
    (o) => o.status === 'IN_PROGRESS' || o.status === 'NOT_STARTED'
  )
  const completedOnboardings = onboardings.filter(
    (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text">Onboarding</h1>
          <p className="text-[13px] text-text-muted">
            Track and manage employee onboarding progress.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAssignDialog(true)}>
          <Plus className="h-4 w-4" />
          Start Onboarding
        </Button>
      </div>

      {/* Active onboardings */}
      {activeOnboardings.length === 0 && completedOnboardings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Clock className="h-10 w-10" />}
              title="No onboardings yet"
              description="Start an onboarding to assign a checklist to a new employee."
              action={{ label: 'Start Onboarding', onClick: () => setShowAssignDialog(true) }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeOnboardings.map((ob) => (
            <Card
              key={ob.id}
              className="cursor-pointer hover:border-accent-300 hover:shadow-sm transition-all"
              onClick={() => setDetailId(ob.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-text">
                      {ob.employee.firstName} {ob.employee.lastName}
                    </h3>
                    {statusBadge(ob.status, ob.overdueTaskCount)}
                    {ob.overdueTaskCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-danger">
                        <AlertTriangle className="h-3 w-3" />
                        {ob.overdueTaskCount} overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-muted">
                    {ob.template.name} · {ob.completedTaskCount}/{ob._count.tasks} tasks complete
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {/* Progress bar */}
                  <div className="w-20 h-1.5 rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent-500 transition-all"
                      style={{
                        width: `${ob._count.tasks > 0 ? (ob.completedTaskCount / ob._count.tasks) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCancellingId(ob.id)
                    }}
                    aria-label={`Cancel onboarding for ${ob.employee.firstName}`}
                  >
                    <XCircle className="h-4 w-4 text-text-muted" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {completedOnboardings.length > 0 && (
            <div className="pt-4">
              <h2 className="text-[13px] font-medium text-text-muted mb-2">Past Onboardings</h2>
              {completedOnboardings.map((ob) => (
                <Card key={ob.id} className="opacity-60 mb-2">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-medium text-text">
                          {ob.employee.firstName} {ob.employee.lastName}
                        </h3>
                        {statusBadge(ob.status, ob.overdueTaskCount)}
                      </div>
                      <p className="mt-0.5 text-[12px] text-text-muted">
                        {ob.template.name} · {ob.completedTaskCount}/{ob._count.tasks} tasks
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign onboarding dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Onboarding</DialogTitle>
            <DialogDescription>
              Select an employee and a template to begin their onboarding.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4">
            <FormField label="Employee" htmlFor="assign-employee" required>
              <select
                id="assign-employee"
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                className="flex h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[13px] text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                required
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Template" htmlFor="assign-template" required>
              <select
                id="assign-template"
                value={assignTemplateId}
                onChange={(e) => setAssignTemplateId(e.target.value)}
                className="flex h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-[13px] text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                required
              >
                <option value="">Select template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t._count.tasks} tasks)
                  </option>
                ))}
              </select>
            </FormField>

            {assignError && <p className="text-[12px] text-danger">{assignError}</p>}

            <DialogFooter>
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setShowAssignDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" loading={assignSaving}>
                Start Onboarding
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel onboarding dialog */}
      <Dialog
        open={cancellingId !== null}
        onOpenChange={(open) => {
          if (!open) { setCancellingId(null); setCancelReason(''); setCancelError(null) }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Onboarding</DialogTitle>
            <DialogDescription>
              This will waive all remaining tasks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Reason" htmlFor="cancel-reason" required>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this onboarding being cancelled?"
              rows={2}
              maxLength={500}
            />
          </FormField>
          {cancelError && <p className="text-[12px] text-danger">{cancelError}</p>}
          <DialogFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setCancellingId(null); setCancelReason(''); setCancelError(null) }}
            >
              Keep Active
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleCancel}
              loading={cancelSaving}
              disabled={!cancelReason.trim()}
            >
              Cancel Onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding detail panel (task list) */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => { if (!open) setDetailId(null) }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailId && (
            <OnboardingDetailPanel
              orgSlug={orgSlug}
              onboardingId={detailId}
              isAdmin
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
