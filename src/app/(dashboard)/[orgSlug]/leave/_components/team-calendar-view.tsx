'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/core/ui'
import { getChartColor } from '@/core/ui/charts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

  // Group entries by employee
  const employeeMap = new Map<string, { name: string; entries: CalendarEntry[] }>()
  for (const entry of entries) {
    const key = entry.employeeId
    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        name: `${entry.employeeFirstName} ${entry.employeeLastName}`,
        entries: [],
      })
    }
    employeeMap.get(key)!.entries.push(entry)
  }

  // Assign colors by leave type
  const leaveTypeColors = new Map<string, string>()
  let colorIndex = 0
  for (const entry of entries) {
    if (!leaveTypeColors.has(entry.leaveTypeName)) {
      leaveTypeColors.set(entry.leaveTypeName, getChartColor(colorIndex))
      colorIndex++
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[14px] font-medium text-text">
          {new Date(year, month - 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Array.from(leaveTypeColors.entries()).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-text-muted">{name}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-[11px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-surface px-2 py-1.5 text-left font-medium text-text-muted w-32">
                Employee
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th
                  key={i}
                  className="px-0.5 py-1.5 text-center font-medium text-text-muted w-6"
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(employeeMap.entries()).map(([empId, { name, entries: empEntries }]) => (
              <tr key={empId} className="border-b border-border last:border-b-0">
                <td className="sticky left-0 bg-surface px-2 py-1.5 text-text font-medium truncate max-w-[120px]">
                  {name}
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dayDate = new Date(year, month - 1, day)

                  const matchingEntry = empEntries.find((e) => {
                    const start = new Date(e.startDate)
                    const end = new Date(e.endDate)
                    start.setHours(0, 0, 0, 0)
                    end.setHours(23, 59, 59, 999)
                    return dayDate >= start && dayDate <= end
                  })

                  if (matchingEntry) {
                    const color = leaveTypeColors.get(matchingEntry.leaveTypeName) ?? 'var(--accent-500)'
                    const opacity = matchingEntry.status === 'PENDING' ? 0.5 : 1
                    return (
                      <td key={i} className="px-0.5 py-1.5">
                        <div
                          className="mx-auto h-4 w-4 rounded-sm"
                          style={{ backgroundColor: color, opacity }}
                          title={`${matchingEntry.leaveTypeName} (${matchingEntry.status})`}
                          aria-label={`${name}: ${matchingEntry.leaveTypeName} on day ${day}`}
                        />
                      </td>
                    )
                  }

                  return <td key={i} className="px-0.5 py-1.5" />
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
