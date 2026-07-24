'use client'

import { useActionState, useState, useEffect } from 'react'
import { Button, Card, CardContent } from '@/core/ui'
import { clockIn, clockOut } from '@/modules/attendance/actions'
import type { ActionResult } from '@/modules/attendance/actions'
import type { AttendanceType } from '@prisma/client'
import { LogIn, LogOut, Clock, MapPin, Wifi } from 'lucide-react'

interface ClockWidgetProps {
  isClockedIn: boolean
  currentRecord: {
    id: string
    clockIn: Date
    type: AttendanceType
  } | null
  orgSlug: string
}

const initialState: ActionResult = { success: false }

function formatElapsed(startTime: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(startTime).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
}

export function ClockWidget({ isClockedIn, currentRecord, orgSlug }: ClockWidgetProps) {
  const [elapsed, setElapsed] = useState('')
  const [selectedType, setSelectedType] = useState<'OFFICE' | 'REMOTE'>('OFFICE')

  const [clockInState, clockInAction, isClockingIn] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return clockIn(orgSlug, formData)
    },
    initialState
  )

  const [clockOutState, clockOutAction, isClockingOut] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return clockOut(orgSlug, formData)
    },
    initialState
  )

  useEffect(() => {
    if (!isClockedIn || !currentRecord) return

    const update = () => setElapsed(formatElapsed(currentRecord.clockIn))
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [isClockedIn, currentRecord])

  const error = clockInState.error || clockOutState.error

  return (
    <Card>
      <CardContent className="p-6">
        {error && (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-text-subtle" aria-hidden="true" />
              <span className="text-[16px] font-semibold text-text">
                {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
              </span>
            </div>
            {isClockedIn && currentRecord && (
              <div className="flex items-center gap-3 text-[13px] text-text-muted">
                <span>Elapsed: {elapsed}</span>
                <span className="flex items-center gap-1">
                  {currentRecord.type === 'OFFICE' ? (
                    <MapPin className="h-3.5 w-3.5" />
                  ) : (
                    <Wifi className="h-3.5 w-3.5" />
                  )}
                  {currentRecord.type}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isClockedIn && (
              <>
                <div className="flex rounded-[var(--radius-sm)] border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedType('OFFICE')}
                    className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      selectedType === 'OFFICE'
                        ? 'bg-accent-500 text-white'
                        : 'bg-surface text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    <MapPin className="inline h-3 w-3 mr-1" />
                    Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType('REMOTE')}
                    className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      selectedType === 'REMOTE'
                        ? 'bg-accent-500 text-white'
                        : 'bg-surface text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    <Wifi className="inline h-3 w-3 mr-1" />
                    Remote
                  </button>
                </div>
                <form action={clockInAction}>
                  <input type="hidden" name="type" value={selectedType} />
                  <Button type="submit" loading={isClockingIn}>
                    <LogIn className="h-4 w-4" />
                    Clock In
                  </Button>
                </form>
              </>
            )}

            {isClockedIn && (
              <form action={clockOutAction}>
                <Button type="submit" variant="secondary" loading={isClockingOut}>
                  <LogOut className="h-4 w-4" />
                  Clock Out
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
