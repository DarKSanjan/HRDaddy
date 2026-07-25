'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/core/ui'
import { fetchEmployeeActivity } from '@/modules/employees/actions'
import { Clock } from 'lucide-react'

interface ActivityTabProps {
  employeeId: string
  orgSlug: string
}

interface AuditEntry {
  id: string
  action: string
  actorId: string
  createdAt: Date
  metadata: unknown
  before: unknown
  after: unknown
}

export function ActivityTab({ employeeId, orgSlug }: ActivityTabProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const result = await fetchEmployeeActivity(orgSlug, employeeId)
        if (!cancelled && result.success && result.data) {
          setEntries(result.data.entries as unknown as AuditEntry[])
          setTotal(result.data.total)
        }
      } catch {
        // silently fail — user may not have audit access
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [employeeId, orgSlug])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity ({total})</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-[13px] text-text-muted">No activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-[var(--radius-xs)] border border-border p-3"
              >
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-subtle" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-text">
                    {formatAction(entry.action)}
                  </div>
                  <div className="text-[12px] text-text-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    'employee.created': 'Employee record created',
    'employee.updated': 'Employee record updated',
    'employee.status_changed': 'Employment status changed',
    'employee.manager_assigned': 'Manager assigned',
    'employee.manager_removed': 'Manager removed',
  }
  return map[action] ?? action.replace(/[._]/g, ' ')
}
