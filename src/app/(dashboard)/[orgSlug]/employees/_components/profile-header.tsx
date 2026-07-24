'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, Badge, Button } from '@/core/ui'
import { changeEmployeeStatus } from '@/modules/employees/actions'
import { getAllowedTransitions } from '@/modules/employees/lifecycle'
import { MoreVertical, UserMinus, UserCheck, Archive, Pause } from 'lucide-react'
import type { OrgRole, EmploymentStatus } from '@prisma/client'

interface ProfileHeaderProps {
  employee: {
    id: string
    firstName: string
    lastName: string
    workEmail: string
    employmentStatus: EmploymentStatus
    department: { id: string; name: string } | null
    jobTitle: { id: string; name: string } | null
  }
  orgSlug: string
  viewerRole: OrgRole
}

const STATUS_VARIANT: Record<EmploymentStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  INVITED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'danger',
  ARCHIVED: 'neutral',
}

const STATUS_ICON: Partial<Record<EmploymentStatus, typeof UserCheck>> = {
  ACTIVE: UserCheck,
  SUSPENDED: Pause,
  DEACTIVATED: UserMinus,
  ARCHIVED: Archive,
}

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'HR_ADMIN']

export function ProfileHeader({ employee, orgSlug, viewerRole }: ProfileHeaderProps) {
  const router = useRouter()
  const [showActions, setShowActions] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = ADMIN_ROLES.includes(viewerRole)
  const allowedTransitions = getAllowedTransitions(employee.employmentStatus)

  const handleStatusChange = async (newStatus: EmploymentStatus) => {
    setProcessing(true)
    setError(null)

    let reason: string | undefined
    if (newStatus === 'DEACTIVATED' || newStatus === 'SUSPENDED') {
      reason = prompt(`Please provide a reason for ${newStatus.toLowerCase()}:`) ?? undefined
      if (!reason) {
        setProcessing(false)
        return
      }
    }

    const result = await changeEmployeeStatus(orgSlug, {
      employeeId: employee.id,
      newStatus,
      reason,
    })

    if (!result.success) {
      setError(result.error ?? 'Action failed')
    }
    setProcessing(false)
    setShowActions(false)
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            fallback={`${employee.firstName[0]}${employee.lastName[0]}`}
            size="lg"
          />
          <div className="space-y-1">
            <h2 className="text-[18px] font-bold text-text">
              {employee.firstName} {employee.lastName}
            </h2>
            <div className="flex items-center gap-2 text-[13px] text-text-muted">
              {employee.jobTitle && <span>{employee.jobTitle.name}</span>}
              {employee.jobTitle && employee.department && <span>·</span>}
              {employee.department && <span>{employee.department.name}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[employee.employmentStatus]}>
                {employee.employmentStatus}
              </Badge>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowActions(!showActions)}
              aria-label="Employee actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showActions && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-[var(--radius-sm)] border border-border bg-surface py-1 shadow-md">
                <button
                  className="w-full px-3 py-2 text-left text-[13px] text-text hover:bg-surface-hover"
                  onClick={() => {
                    setShowActions(false)
                    router.push(`/${orgSlug}/employees/${employee.id}?tab=employment`)
                  }}
                >
                  Edit Employee
                </button>
                {allowedTransitions.map((status) => {
                  const Icon = STATUS_ICON[status]
                  return (
                    <button
                      key={status}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text hover:bg-surface-hover disabled:opacity-50"
                      onClick={() => handleStatusChange(status)}
                      disabled={processing}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {status === 'ACTIVE' && 'Activate'}
                      {status === 'INVITED' && 'Send Invitation'}
                      {status === 'SUSPENDED' && 'Suspend'}
                      {status === 'DEACTIVATED' && 'Deactivate'}
                      {status === 'ARCHIVED' && 'Archive'}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger">
          {error}
        </div>
      )}
    </div>
  )
}
