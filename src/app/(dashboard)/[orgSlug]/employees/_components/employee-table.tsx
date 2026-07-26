'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Avatar, Button } from '@/core/ui'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Download, ArrowUpDown, Archive } from 'lucide-react'
import { bulkArchiveEmployees } from '@/modules/employees/actions'
import type { EmploymentStatus } from '@prisma/client'

interface Employee {
  id: string
  firstName: string
  lastName: string
  workEmail: string
  employmentStatus: EmploymentStatus
  startDate: Date | null
  department: { id: string; name: string } | null
  jobTitle: { id: string; name: string } | null
  workLocation: { id: string; name: string } | null
  employmentType: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string } | null
}

interface EmployeeTableProps {
  employees: Employee[]
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  orgSlug: string
}

const STATUS_VARIANT: Record<EmploymentStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  INVITED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'danger',
  ARCHIVED: 'neutral',
}

export function EmployeeTable({
  employees,
  total,
  currentPage,
  totalPages,
  pageSize,
  orgSlug,
}: EmployeeTableProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleAll = useCallback(() => {
    if (selected.size === employees.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(employees.map((e) => e.id)))
    }
  }, [selected.size, employees])

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSort = useCallback(
    (field: string) => {
      const params = new URLSearchParams(window.location.search)
      const currentSort = params.get('sortBy')
      const currentOrder = params.get('sortOrder')

      if (currentSort === field && currentOrder === 'asc') {
        params.set('sortOrder', 'desc')
      } else {
        params.set('sortBy', field)
        params.set('sortOrder', 'asc')
      }
      params.set('page', '1')
      router.push(`/${orgSlug}/employees?${params.toString()}`)
    },
    [orgSlug, router]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(window.location.search)
      params.set('page', String(page))
      router.push(`/${orgSlug}/employees?${params.toString()}`)
    },
    [orgSlug, router]
  )

  const handleExport = useCallback(() => {
    const rows = employees.filter((e) => selected.has(e.id))
    const data = rows.length > 0 ? rows : employees

    const csv = [
      ['First Name', 'Last Name', 'Email', 'Department', 'Job Title', 'Status', 'Start Date'].join(','),
      ...data.map((e) =>
        [
          e.firstName,
          e.lastName,
          e.workEmail,
          e.department?.name ?? '',
          e.jobTitle?.name ?? '',
          e.employmentStatus,
          e.startDate ? new Date(e.startDate).toLocaleDateString() : '',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'employees.csv'
    link.click()
    URL.revokeObjectURL(url)
  }, [employees, selected])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-surface p-3">
          <span className="text-[13px] text-text-muted">
            {selected.size} selected
          </span>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const ids = Array.from(selected)
              const result = await bulkArchiveEmployees(orgSlug, ids)
              if (result.success && result.data) {
                setSelected(new Set())
                router.refresh()
              }
            }}
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === employees.length && employees.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                  aria-label="Select all employees"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">
                <button
                  onClick={() => handleSort('lastName')}
                  className="inline-flex items-center gap-1 hover:text-text"
                >
                  Name
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Department</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Job Title</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">
                <button
                  onClick={() => handleSort('startDate')}
                  className="inline-flex items-center gap-1 hover:text-text"
                >
                  Start Date
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors cursor-pointer',
                  selected.has(employee.id) ? 'bg-accent-50/50' : 'hover:bg-surface-hover'
                )}
                onClick={() => router.push(`/${orgSlug}/employees/${employee.id}`)}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(employee.id)}
                    onChange={() => toggleOne(employee.id)}
                    className="rounded"
                    aria-label={`Select ${employee.firstName} ${employee.lastName}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      fallback={`${employee.firstName[0]}${employee.lastName[0]}`}
                      size="sm"
                    />
                    <div>
                      <div className="font-medium text-text">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-text-muted">{employee.workEmail}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {employee.department?.name ?? '—'}
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {employee.jobTitle?.name ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[employee.employmentStatus]}>
                    {employee.employmentStatus}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {employee.startDate
                    ? new Date(employee.startDate).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-muted">
          Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of{' '}
          {total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-[12px] text-text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
