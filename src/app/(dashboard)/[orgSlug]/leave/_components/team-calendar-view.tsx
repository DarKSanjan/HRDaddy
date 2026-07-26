'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/core/ui'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import type { LeaveRequestStatus } from '@prisma/client'

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
}

interface TeamCalendarViewProps {
  entries: CalendarEntry[]
  month: number
  year: number
  orgSlug: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function TeamCalendarView({ entries, month, year, orgSlug }: TeamCalendarViewProps) {
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
        <Button variant="secondary" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Legend */}
      {leaveTypeMap.size > 0 && (
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

              return (
                <div
                  key={day}
                  className={[
                    'min-h-[100px] border-r border-border last:border-r-0 p-1 transition-colors',
                    isWeekend ? 'bg-surface-hover/30' : 'bg-surface',
                  ].join(' ')}
                >
                  {/* Day number */}
                  <div className="mb-1 flex items-center justify-end">
                    <span
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-[12px]',
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
                      <div
                        key={`${entry.employeeId}-${entry.leaveTypeName}-${entryIndex}`}
                        className={[
                          'flex items-center gap-1 rounded-[var(--radius-sm)] px-1 py-0.5',
                          entry.status === 'PENDING' ? 'opacity-50' : '',
                        ].join(' ')}
                        style={{
                          backgroundColor: `${entry.leaveTypeColor || 'var(--accent-500)'}15`,
                        }}
                        title={`${entry.employeeFirstName} ${entry.employeeLastName} - ${entry.leaveTypeName} (${entry.status})`}
                      >
                        <div
                          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: entry.leaveTypeColor || 'var(--accent-500)' }}
                        />
                        <span className="truncate text-[10px] font-medium text-text">
                          {entry.employeeFirstName}
                        </span>
                      </div>
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
