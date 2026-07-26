'use client'

import { Badge } from '@/core/ui'
import type { EmployeeAttendanceOverview } from '@/modules/attendance/queries'
import { useState } from 'react'

type SortField = 'name' | 'daysPresent' | 'totalHoursWorked' | 'lateCount' | 'undertimeCount' | 'overtimeCount'
type SortOrder = 'asc' | 'desc'

interface TeamAttendanceTableProps {
  employees: EmployeeAttendanceOverview[]
}

function SortIndicator({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return null
  return <span className="ml-0.5">{order === 'asc' ? '↑' : '↓'}</span>
}

export function TeamAttendanceTable({ employees }: TeamAttendanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = [...employees].sort((a, b) => {
    const dir = sortOrder === 'asc' ? 1 : -1
    switch (sortField) {
      case 'name':
        return dir * (`${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      case 'daysPresent':
        return dir * (a.daysPresent - b.daysPresent)
      case 'totalHoursWorked':
        return dir * (a.totalHoursWorked - b.totalHoursWorked)
      case 'lateCount':
        return dir * (a.lateCount - b.lateCount)
      case 'undertimeCount':
        return dir * (a.undertimeCount - b.undertimeCount)
      case 'overtimeCount':
        return dir * (a.overtimeCount - b.overtimeCount)
      default:
        return 0
    }
  })

  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th
              className="px-3 py-2 text-left font-medium text-text-muted cursor-pointer select-none"
              onClick={() => handleSort('name')}
            >
              Employee<SortIndicator active={sortField === 'name'} order={sortOrder} />
            </th>
            <th
              className="px-3 py-2 text-right font-medium text-text-muted cursor-pointer select-none"
              onClick={() => handleSort('daysPresent')}
            >
              Days Present<SortIndicator active={sortField === 'daysPresent'} order={sortOrder} />
            </th>
            <th
              className="px-3 py-2 text-right font-medium text-text-muted cursor-pointer select-none"
              onClick={() => handleSort('totalHoursWorked')}
            >
              Hours Worked<SortIndicator active={sortField === 'totalHoursWorked'} order={sortOrder} />
            </th>
            <th
              className="px-3 py-2 text-right font-medium text-text-muted cursor-pointer select-none"
              onClick={() => handleSort('lateCount')}
            >
              Late<SortIndicator active={sortField === 'lateCount'} order={sortOrder} />
            </th>
            <th
              className="px-3 py-2 text-right font-medium text-text-muted cursor-pointer select-none"
              onClick={() => handleSort('undertimeCount')}
            >
              Undertime<SortIndicator active={sortField === 'undertimeCount'} order={sortOrder} />
            </th>
            <th
              className="px-3 py-2 text-right font-medium text-text-muted cursor-pointer select-none"
              onClick={() => handleSort('overtimeCount')}
            >
              Overtime<SortIndicator active={sortField === 'overtimeCount'} order={sortOrder} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((emp) => (
            <tr key={emp.employeeId} className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
              <td className="px-3 py-2 font-medium text-text">
                {emp.firstName} {emp.lastName}
              </td>
              <td className="px-3 py-2 text-right text-text-muted">
                {emp.daysPresent}
              </td>
              <td className="px-3 py-2 text-right text-text-muted">
                {emp.totalHoursWorked}h
              </td>
              <td className="px-3 py-2 text-right">
                {emp.lateCount > 0 ? (
                  <Badge variant="warning">{emp.lateCount}</Badge>
                ) : (
                  <span className="text-text-muted">0</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {emp.undertimeCount > 0 ? (
                  <Badge variant="danger">{emp.undertimeCount}</Badge>
                ) : (
                  <span className="text-text-muted">0</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {emp.overtimeCount > 0 ? (
                  <Badge variant="info">{emp.overtimeCount}</Badge>
                ) : (
                  <span className="text-text-muted">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
