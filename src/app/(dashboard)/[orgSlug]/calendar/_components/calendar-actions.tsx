'use client'

import Link from 'next/link'
import { Button } from '@/core/ui'
import { Upload } from 'lucide-react'
import { AddEventDialog } from './add-event-dialog'
import { CalendarFeedButton } from './calendar-feed-button'

interface Department {
  id: string
  name: string
}

interface EmployeeOption {
  id: string
  firstName: string
  lastName: string
}

interface CalendarActionsProps {
  orgSlug: string
  canManageHolidays: boolean
  canCreateEvents: boolean
  isAdmin: boolean
  hasDirectReports: boolean
  departments: Department[]
  employees: EmployeeOption[]
}

export function CalendarActions({
  orgSlug,
  canManageHolidays,
  canCreateEvents,
  isAdmin,
  hasDirectReports,
  departments,
  employees,
}: CalendarActionsProps) {
  return (
    <>
      <CalendarFeedButton orgSlug={orgSlug} hasDirectReports={hasDirectReports} isAdmin={isAdmin} />
      {canManageHolidays && (
        <Link href={`/${orgSlug}/calendar/import`}>
          <Button variant="secondary" size="sm">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import Holidays
          </Button>
        </Link>
      )}
      {canCreateEvents && (
        <AddEventDialog
          orgSlug={orgSlug}
          isAdmin={isAdmin}
          departments={departments}
          employees={employees}
        />
      )}
    </>
  )
}
