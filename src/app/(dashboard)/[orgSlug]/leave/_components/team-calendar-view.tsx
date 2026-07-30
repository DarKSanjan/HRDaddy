'use client'

import { useRouter } from 'next/navigation'
import { Button, Badge, HoverCard, HoverCardTrigger, HoverCardContent } from '@/core/ui'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ExternalLink } from 'lucide-react'
import type { LeaveRequestStatus } from '@prisma/client'
import Link from 'next/link'
import { CalendarFeedButton } from './calendar-feed-button'

interface CalendarEntry {
  employeeId: string
  employeeFirstName: string
  employeeLastName: string
  leaveTypeName: string
  leaveTypeColor: string
  startDate: Date
  endDate: Date
  isHalfDay: boolean
  halfDayPeriod: string | null
  status: LeaveRequestStatus
  departmentName: string | null
  reason: string | null
  reviewedByName: string | null
  reviewedAt: Date | null
  reviewNote: string | null
}

interface PublicHoliday {
  date: string // YYYY-MM-DD
  name: string
}

interface TeamCalendarViewProps {
  entries: CalendarEntry[]
  holidays?: PublicHoliday[]
  month: number
  year: number
  orgSlug: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: LeaveRequestStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'Approved'
    case 'PENDING':
      return 'Pending'
    case 'REJECTED':
      return 'Rejected'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status
  }
}

function statusVariant(status: LeaveRequestStatus): 'default' | 'success' | 'warning' | 'neutral' | 'danger' {
  switch (status) {
    case 'APPROVED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
      return 'danger'
    default:
      return 'neutral'
  }
}

function LeaveChipHoverCard({
  entry,
  orgSlug,
  children,
}: {
  entry: CalendarEntry
  orgSlug: string
  children: React.ReactNode
}) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" className="w-80 text-[12px]">
        <div className="space-y-3">
          {/* Employee name & department */}
          <div>
            <p className="text-[13px] font-semibold text-text">
              {entry.employeeFirstName} {entry.employeeLastName}
            </p>
            {entry.departmentName && (
              <p className="text-[11px] text-text-muted">{entry.departmentName}</p>
            )}
          </div>

          {/* Leave type & dates */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.leaveTypeColor || 'var(--accent-500)' }}
              />
              <span className="font-medium text-text">{entry.leaveTypeName}</span>
              {entry.isHalfDay && (
                <span className="text-text-muted">
                  ({entry.halfDayPeriod === 'AM' ? 'Morning' : 'Afternoon'})
                </span>
              )}
            </div>
            <p className="text-text-muted">
              {formatDate(entry.startDate)} – {formatDate(entry.endDate)}
            </p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Status:</span>
            <Badge variant={statusVariant(entry.status)}>{statusLabel(entry.status)}</Badge>
          </div>

          {/* Reason */}
          {entry.reason && (
            <div>
              <span className="text-text-muted">Reason:</span>{' '}
              <span className="text-text">{entry.reason}</span>
            </div>
          )}

          {/* Reviewed by */}
          {entry.reviewedByName && (
            <div className="space-y-0.5">
              <p className="text-text-muted">
                Reviewed by{' '}
                <span className="font-medium text-text">{entry.reviewedByName}</span>
                {entry.reviewedAt && (
                  <> on {formatDateTime(entry.reviewedAt)}</>
                )}
              </p>
              {entry.reviewNote && (
                <p className="text-text italic">&ldquo;{entry.reviewNote}&rdquo;</p>
              )}
            </div>
          )}

          {/* Link to employee */}
          <Link
            href={`/${orgSlug}/employees/${entry.employeeId}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-500 hover:text-accent-600 hover:underline"
          >
            View employee <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function TeamCalendarView({ entries, holidays = [], month, year, orgSlug }: TeamCalendarViewProps) {
  const router = useRouter()

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = month + direction
    let newYear = year
    if (newMonth < 1) {
      newMonth = 12
      newYear--
    } else if (newMonth > 12) {
      newMonth = 1
      newYear++
    }
    router.push(`/${orgSlug}/leave/calendar?month=${newMonth}&year=${newYear}`)
  }

  const goToToday = () => {
    const now = new Date()
    router.push(`/${orgSlug}/leave/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // getDay() is 0=Sunday, we want Monday=0
  const startDayOfWeek = (firstDay.getDay() + 6) % 7

  // Build the weeks (array of arrays, each inner array is 7 days)
  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = []

  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // Trailing empty cells
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }

  // Collect leave type legend data
  const leaveTypeMap = new Map<string, string>()
  for (const entry of entries) {
    if (!leaveTypeMap.has(entry.leaveTypeName)) {
      leaveTypeMap.set(entry.leaveTypeName, entry.leaveTypeColor || 'var(--accent-500)')
    }
  }

  // Build a map of day -> entries for quick lookup
  const dayEntriesMap = new Map<number, CalendarEntry[]>()
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, month - 1, day)
    const dayStart = dayDate.getTime()
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime()

    const matching = entries.filter((e) => {
      const start = new Date(e.startDate).setHours(0, 0, 0, 0)
      const end = new Date(e.endDate).setHours(23, 59, 59, 999)
      return start <= dayEnd && end >= dayStart
    })

    if (matching.length > 0) {
      dayEntriesMap.set(day, matching)
    }
  }

  // Build a map of day -> holiday name for quick lookup
  const dayHolidayMap = new Map<number, string>()
  for (const h of holidays) {
    const [hYear, hMonth, hDay] = h.date.split('-').map(Number)
    if (hYear === year && hMonth === month) {
      dayHolidayMap.set(hDay, h.name)
    }
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-[16px] font-semibold text-text">
            {new Date(year, month - 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <CalendarFeedButton orgSlug={orgSlug} />
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Legend */}
      {(leaveTypeMap.size > 0 || holidays.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {Array.from(leaveTypeMap.entries()).map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-text-muted">{name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full border border-border bg-surface opacity-50" />
            <span className="text-[11px] text-text-muted">Pending</span>
          </div>
          {holidays.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-warning/10 border border-warning/30" />
              <span className="text-[11px] text-text-muted">Public Holiday</span>
            </div>
          )}
        </div>
      )}

      {/* Calendar grid */}
      <div className="rounded-[var(--radius-md)] border border-border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border bg-surface-hover">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-[12px] font-medium text-text-muted"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, dayIndex) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${dayIndex}`}
                    className="min-h-[100px] border-r border-border last:border-r-0 bg-surface-hover/50 p-1"
                  />
                )
              }

              const dayEntries = dayEntriesMap.get(day) ?? []
              const isToday = isCurrentMonth && today.getDate() === day
              const isWeekend = dayIndex >= 5
              const holidayName = dayHolidayMap.get(day)

              return (
                <div
                  key={day}
                  className={[
                    'min-h-[100px] border-r border-border last:border-r-0 p-1 transition-colors',
                    holidayName
                      ? 'bg-warning/5'
                      : isWeekend
                        ? 'bg-surface-hover/30'
                        : 'bg-surface',
                  ].join(' ')}
                >
                  {/* Day number */}
                  <div className="mb-1 flex items-center justify-between">
                    {holidayName && (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <span className="inline-block max-w-[70%] truncate rounded-[var(--radius-xs)] bg-warning/10 px-1 py-0.5 text-[9px] font-medium text-warning cursor-default">
                            {holidayName}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" className="w-48 text-[12px]">
                          <p className="font-semibold text-text">{holidayName}</p>
                          <p className="text-text-muted">Public Holiday</p>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                    <span
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-[12px] ml-auto',
                        isToday
                          ? 'bg-accent-500 font-semibold text-white'
                          : 'font-medium text-text',
                      ].join(' ')}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Leave entries for this day */}
                  <div className="space-y-0.5">
                    {dayEntries.slice(0, 3).map((entry, entryIndex) => (
                      <LeaveChipHoverCard
                        key={`${entry.employeeId}-${entry.leaveTypeName}-${entryIndex}`}
                        entry={entry}
                        orgSlug={orgSlug}
                      >
                        <button
                          type="button"
                          className={[
                            'flex w-full items-center gap-1 rounded-[var(--radius-sm)] px-1 py-0.5 text-left',
                            'cursor-default focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:ring-offset-1',
                            entry.status === 'PENDING' ? 'opacity-50' : '',
                          ].join(' ')}
                          style={{
                            backgroundColor: `${entry.leaveTypeColor || 'var(--accent-500)'}15`,
                          }}
                        >
                          <div
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: entry.leaveTypeColor || 'var(--accent-500)' }}
                          />
                          <span className="truncate text-[10px] font-medium text-text">
                            {entry.employeeFirstName}
                          </span>
                        </button>
                      </LeaveChipHoverCard>
                    ))}
                    {dayEntries.length > 3 && (
                      <span className="block px-1 text-[10px] text-text-muted">
                        +{dayEntries.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Empty state if no entries at all */}
      {entries.length === 0 && (
        <div className="py-8 text-center">
          <CalendarIcon className="mx-auto h-8 w-8 text-text-subtle" aria-hidden="true" />
          <p className="mt-2 text-[13px] text-text-muted">No leave scheduled this month.</p>
        </div>
      )}
    </div>
  )
}
