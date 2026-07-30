'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/core/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HolidayRow, ImportantDateEntry, BirthdayAnniversaryEntry, CalendarEventRow } from '@/modules/calendar/queries'

interface CalendarViewProps {
  holidays: HolidayRow[]
  importantDates: ImportantDateEntry[]
  birthdaysAnniversaries: BirthdayAnniversaryEntry[]
  events: CalendarEventRow[]
  month: number
  year: number
  orgSlug: string
}

interface DayEntry {
  label: string
  type: 'holiday' | 'performance' | 'payroll' | 'birthday' | 'anniversary' | 'event'
}

const TYPE_COLORS: Record<string, string> = {
  holiday: 'bg-warning/20 text-warning',
  performance: 'bg-accent-500/20 text-accent-500',
  payroll: 'bg-success/20 text-success',
  birthday: 'bg-danger/20 text-danger',
  anniversary: 'bg-accent-500/20 text-accent-500',
  event: 'bg-surface-hover text-text-muted',
}

export function CalendarView({
  holidays,
  importantDates,
  birthdaysAnniversaries,
  events,
  month,
  year,
  orgSlug,
}: CalendarViewProps) {
  const router = useRouter()

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  const goTo = (m: number, y: number) => {
    router.push(`/${orgSlug}/calendar?month=${m}&year=${y}`)
  }

  const goToday = () => {
    const now = new Date()
    goTo(now.getMonth() + 1, now.getFullYear())
  }

  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDayOfWeek = (firstDay.getDay() + 6) % 7

  const dayEntries = new Map<number, DayEntry[]>()

  for (const h of holidays) {
    const d = new Date(h.date).getUTCDate()
    if (!dayEntries.has(d)) dayEntries.set(d, [])
    dayEntries.get(d)!.push({ label: h.name, type: 'holiday' })
  }

  for (const imp of importantDates) {
    const d = new Date(imp.date).getUTCDate()
    if (!dayEntries.has(d)) dayEntries.set(d, [])
    dayEntries.get(d)!.push({ label: imp.label, type: imp.type })
  }

  for (const ba of birthdaysAnniversaries) {
    const d = new Date(ba.date).getUTCDate()
    if (!dayEntries.has(d)) dayEntries.set(d, [])
    dayEntries.get(d)!.push({ label: ba.label, type: ba.type })
  }

  for (const ev of events) {
    const d = new Date(ev.date).getUTCDate()
    if (!dayEntries.has(d)) dayEntries.set(d, [])
    dayEntries.get(d)!.push({ label: ev.title, type: 'event' })
  }

  const monthName = firstDay.toLocaleString('en-US', { month: 'long' })
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year

  const cells: (number | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => goTo(prevMonth, prevYear)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-[15px] font-semibold text-text">
            {monthName} {year}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => goTo(nextMonth, nextYear)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-border">
        {weekdays.map((wd) => (
          <div
            key={wd}
            className="border-r border-b border-border px-2 py-1.5 text-center text-[11px] font-medium text-text-muted"
          >
            {wd}
          </div>
        ))}
        {cells.map((day, idx) => {
          const entries = day ? dayEntries.get(day) ?? [] : []
          const isToday = isCurrentMonth && day === today.getDate()

          return (
            <div
              key={idx}
              className="relative min-h-[80px] border-r border-b border-border p-1"
            >
              {day && (
                <>
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isToday ? 'bg-accent-500 text-white font-bold' : 'text-text-muted'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {entries.slice(0, 3).map((entry, i) => (
                      <div
                        key={i}
                        className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${TYPE_COLORS[entry.type] ?? TYPE_COLORS.event}`}
                        title={entry.label}
                      >
                        {entry.label}
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <div className="px-1 text-[10px] text-text-subtle">
                        +{entries.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-4 pt-2">
        <LegendItem color="bg-warning/20" label="Public Holiday" />
        <LegendItem color="bg-danger/20" label="Birthday" />
        <LegendItem color="bg-accent-500/20" label="Anniversary / Review Cycle" />
        <LegendItem color="bg-success/20" label="Payroll" />
        <LegendItem color="bg-surface-hover" label="Event" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  )
}
