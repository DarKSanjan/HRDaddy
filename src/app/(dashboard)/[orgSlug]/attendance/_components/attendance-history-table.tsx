'use client'

import { Badge } from '@/core/ui'
import type { AttendanceStatus, AttendanceType } from '@prisma/client'
import { MapPin, Wifi } from 'lucide-react'

interface AttendanceRecord {
  id: string
  date: Date
  clockIn: Date
  clockOut: Date | null
  durationMinutes: number | null
  type: AttendanceType
  status: AttendanceStatus
  correctionReason: string | null
  lateMinutes: number
  undertimeMinutes: number
  overtimeMinutes: number
  isRestDay: boolean
}

interface AttendanceHistoryTableProps {
  records: AttendanceRecord[]
  timezone: string
}

const STATUS_VARIANT: Record<AttendanceStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  OPEN: 'info',
  CLOSED: 'success',
  MISSING_CLOCK_OUT: 'warning',
  CORRECTED: 'neutral',
}

function formatTime(date: Date, timezone: string): string {
  return new Date(date).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function formatDate(date: Date, timezone: string): string {
  return new Date(date).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: timezone,
  })
}

export function AttendanceHistoryTable({ records, timezone }: AttendanceHistoryTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="px-3 py-2 text-left font-medium text-text-muted">Date</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Clock In</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Clock Out</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Duration</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Shift Metrics</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Type</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
              <td className="px-3 py-2 text-text">
                <span>{formatDate(record.date, timezone)}</span>
                {record.isRestDay && (
                  <Badge variant="neutral" className="ml-1 text-[10px]">
                    Rest Day
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 text-text-muted">
                {formatTime(record.clockIn, timezone)}
              </td>
              <td className="px-3 py-2 text-text-muted">
                {record.clockOut ? formatTime(record.clockOut, timezone) : '--'}
              </td>
              <td className="px-3 py-2 text-text-muted">
                {formatDuration(record.durationMinutes)}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {record.lateMinutes > 0 && (
                    <Badge variant="warning">
                      Late {record.lateMinutes}m
                    </Badge>
                  )}
                  {record.overtimeMinutes > 0 && (
                    <Badge variant="info">
                      OT +{record.overtimeMinutes}m
                    </Badge>
                  )}
                  {record.undertimeMinutes > 0 && (
                    <Badge variant="danger">
                      Under {record.undertimeMinutes}m
                    </Badge>
                  )}
                  {record.lateMinutes === 0 && record.overtimeMinutes === 0 && record.undertimeMinutes === 0 && record.status !== 'OPEN' && (
                    <span className="text-text-muted">—</span>
                  )}
                  {record.status === 'OPEN' && (
                    <span className="text-text-muted italic">In progress</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1 text-text-muted">
                  {record.type === 'OFFICE' ? (
                    <MapPin className="h-3 w-3" />
                  ) : (
                    <Wifi className="h-3 w-3" />
                  )}
                  {record.type}
                </span>
              </td>
              <td className="px-3 py-2">
                <Badge variant={STATUS_VARIANT[record.status]}>
                  {record.status.replace('_', ' ')}
                </Badge>
                {record.correctionReason && (
                  <span className="ml-1 text-[11px] text-text-muted italic" title={record.correctionReason}>
                    (corrected)
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
