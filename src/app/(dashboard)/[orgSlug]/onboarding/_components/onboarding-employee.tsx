'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RotateCcw, Calendar, ClipboardCheck } from 'lucide-react'
import { Button, Badge, Card, CardContent, EmptyState } from '@/core/ui'
import { completeTask, reopenTask } from '@/modules/onboarding/actions'
import type { OnboardingTaskItem } from '@/modules/onboarding/queries'

interface OnboardingEmployeeProps {
  orgSlug: string
  hasOnboarding: boolean
  tasks: {
    asEmployee: OnboardingTaskItem[]
    asAssignee: OnboardingTaskItem[]
  }
}

export function OnboardingEmployee({ orgSlug, hasOnboarding, tasks }: OnboardingEmployeeProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleComplete = async (taskId: string) => {
    setActionLoading(taskId)
    setError(null)
    const result = await completeTask(orgSlug, { taskId })
    if (result.success) {
      router.refresh()
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
    } else {
      setError(result.error ?? 'Failed to reopen task.')
    }
    setActionLoading(null)
  }

  const allTasks = [...tasks.asEmployee, ...tasks.asAssignee]

  if (!hasOnboarding || allTasks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[20px] font-bold text-text">Onboarding</h1>
          <p className="text-[13px] text-text-muted">
            Your onboarding checklist and tasks.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
              title="No active onboarding"
              description="You don't have any onboarding tasks at the moment. Check back later if you're expecting one."
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-text">Onboarding</h1>
        <p className="text-[13px] text-text-muted">
          Complete your onboarding tasks below.
        </p>
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      {/* My tasks as employee */}
      {tasks.asEmployee.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-text-muted">Your Tasks</h2>
          {tasks.asEmployee.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              actionLoading={actionLoading}
              onComplete={handleComplete}
              onReopen={handleReopen}
            />
          ))}
        </div>
      )}

      {/* Tasks assigned to me (as manager/HR) */}
      {tasks.asAssignee.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-text-muted">Assigned to You</h2>
          {tasks.asAssignee.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              actionLoading={actionLoading}
              onComplete={handleComplete}
              onReopen={handleReopen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({
  task,
  actionLoading,
  onComplete,
  onReopen,
}: {
  task: OnboardingTaskItem
  actionLoading: string | null
  onComplete: (id: string) => void
  onReopen: (id: string) => void
}) {
  const isOverdue = task.status === 'PENDING' && task.dueDate && new Date(task.dueDate) < new Date()

  const taskBadge = () => {
    if (task.status === 'COMPLETED') return <Badge variant="success">Done</Badge>
    if (task.status === 'WAIVED') return <Badge variant="neutral">Waived</Badge>
    if (isOverdue) return <Badge variant="danger">Overdue</Badge>
    return <Badge variant="warning">Pending</Badge>
  }

  return (
    <Card className={isOverdue ? 'border-danger/30' : undefined}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-text">{task.title}</span>
            {taskBadge()}
          </div>
          {task.description && (
            <p className="mt-0.5 text-[12px] text-text-muted line-clamp-2">
              {task.description}
            </p>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1 mt-1 text-[11px] text-text-subtle">
              <Calendar className="h-3 w-3" />
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {task.status === 'PENDING' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onComplete(task.id)}
            loading={actionLoading === task.id}
            className="ml-3"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete
          </Button>
        )}
        {task.status === 'COMPLETED' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReopen(task.id)}
            loading={actionLoading === task.id}
            className="ml-3"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
