'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RotateCcw, ShieldOff, Calendar, User } from 'lucide-react'
import {
  Button,
  Badge,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  FormField,
  Textarea,
} from '@/core/ui'
import {
  fetchOnboardingDetail,
  completeTask,
  waiveTask,
  reopenTask,
} from '@/modules/onboarding/actions'
import type { OnboardingTaskItem } from '@/modules/onboarding/queries'

interface OnboardingDetailPanelProps {
  orgSlug: string
  onboardingId: string
  isAdmin: boolean
}

interface OnboardingDetail {
  id: string
  status: string
  employee: { id: string; firstName: string; lastName: string }
  template: { id: string; name: string }
  tasks: OnboardingTaskItem[]
}

export function OnboardingDetailPanel({
  orgSlug,
  onboardingId,
  isAdmin,
}: OnboardingDetailPanelProps) {
  const router = useRouter()
  const [detail, setDetail] = useState<OnboardingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [waiveTaskId, setWaiveTaskId] = useState<string | null>(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await fetchOnboardingDetail(orgSlug, onboardingId)
      if (!cancelled) {
        setDetail(data as OnboardingDetail | null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [orgSlug, onboardingId])

  const handleComplete = async (taskId: string) => {
    setActionLoading(taskId)
    setError(null)
    const result = await completeTask(orgSlug, { taskId })
    if (result.success) {
      router.refresh()
      const data = await fetchOnboardingDetail(orgSlug, onboardingId)
      setDetail(data as OnboardingDetail | null)
    } else {
      setError(result.error ?? 'Failed to complete task.')
    }
    setActionLoading(null)
  }

  const handleReopen = async (taskId: string) => {
    setActionLoading(taskId)
    setError(null)
    const result = await reopenTask(orgSlug, { taskId })
    if (result.success) {
      router.refresh()
      const data = await fetchOnboardingDetail(orgSlug, onboardingId)
      setDetail(data as OnboardingDetail | null)
    } else {
      setError(result.error ?? 'Failed to reopen task.')
    }
    setActionLoading(null)
  }

  const handleWaive = async () => {
    if (!waiveTaskId) return
    setActionLoading(waiveTaskId)
    setError(null)
    const result = await waiveTask(orgSlug, { taskId: waiveTaskId, reason: waiveReason })
    if (result.success) {
      setWaiveTaskId(null)
      setWaiveReason('')
      router.refresh()
      const data = await fetchOnboardingDetail(orgSlug, onboardingId)
      setDetail(data as OnboardingDetail | null)
    } else {
      setError(result.error ?? 'Failed to waive task.')
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-text-muted">Loading onboarding details…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-text-muted">Onboarding not found.</p>
      </div>
    )
  }

  const assigneeLabel = (type: string) => {
    if (type === 'EMPLOYEE') return 'Employee'
    if (type === 'MANAGER') return 'Manager'
    return 'HR'
  }

  const taskStatusBadge = (task: OnboardingTaskItem) => {
    if (task.status === 'COMPLETED') return <Badge variant="success">Done</Badge>
    if (task.status === 'WAIVED') return <Badge variant="neutral">Waived</Badge>
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
    if (isOverdue) return <Badge variant="danger">Overdue</Badge>
    return <Badge variant="warning">Pending</Badge>
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {detail.employee.firstName} {detail.employee.lastName} — Onboarding
        </DialogTitle>
        <DialogDescription>
          Template: {detail.template.name}
        </DialogDescription>
      </DialogHeader>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      {/* Waive reason input */}
      {waiveTaskId && (
        <div className="rounded-[var(--radius-sm)] border border-border p-3 space-y-2">
          <FormField label="Waive Reason" htmlFor="waive-reason" required>
            <Textarea
              id="waive-reason"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="Why is this task being waived?"
              rows={2}
              maxLength={500}
            />
          </FormField>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setWaiveTaskId(null); setWaiveReason('') }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleWaive}
              disabled={!waiveReason.trim()}
              loading={actionLoading === waiveTaskId}
            >
              Waive Task
            </Button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {detail.tasks.map((task) => {
          const isOverdue = task.status === 'PENDING' && task.dueDate && new Date(task.dueDate) < new Date()
          return (
            <div
              key={task.id}
              className={`rounded-[var(--radius-sm)] border p-3 ${
                isOverdue ? 'border-danger/30 bg-danger/5' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text">{task.title}</span>
                    {taskStatusBadge(task)}
                  </div>
                  {task.description && (
                    <p className="mt-0.5 text-[12px] text-text-muted line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-text-subtle">
                      <User className="h-3 w-3" />
                      {assigneeLabel(task.assigneeType)}
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-[11px] text-text-subtle">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.notes && (
                      <span className="text-[11px] text-text-subtle italic">
                        Note: {task.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {task.status === 'PENDING' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleComplete(task.id)}
                      loading={actionLoading === task.id}
                      aria-label={`Complete task: ${task.title}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Done
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWaiveTaskId(task.id)}
                        aria-label={`Waive task: ${task.title}`}
                      >
                        <ShieldOff className="h-3.5 w-3.5 text-text-muted" />
                        Waive
                      </Button>
                    )}
                  </div>
                )}
                {task.status === 'COMPLETED' && isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReopen(task.id)}
                    loading={actionLoading === task.id}
                    aria-label={`Reopen task: ${task.title}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
