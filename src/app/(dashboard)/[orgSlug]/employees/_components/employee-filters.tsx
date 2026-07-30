'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Button, Select } from '@/core/ui'
import { Search, X } from 'lucide-react'
import type { EmployeeListParams } from '@/modules/employees/schemas'

interface FilterOption {
  id: string
  name: string
}

interface EmployeeFiltersProps {
  departments: FilterOption[]
  employmentTypes: FilterOption[]
  locations: FilterOption[]
  currentParams: EmployeeListParams
  orgSlug: string
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export function EmployeeFilters({
  departments,
  employmentTypes,
  locations,
  currentParams,
  orgSlug,
}: EmployeeFiltersProps) {
  const router = useRouter()

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      // Reset page when filters change
      params.set('page', '1')
      router.push(`/${orgSlug}/employees?${params.toString()}`)
    },
    [orgSlug, router]
  )

  const clearFilters = useCallback(() => {
    router.push(`/${orgSlug}/employees`)
  }, [orgSlug, router])

  const hasFilters = !!(
    currentParams.search ||
    currentParams.departmentId ||
    currentParams.status ||
    currentParams.employmentTypeId ||
    currentParams.locationId
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <Input
            placeholder="Search by name, email, or title..."
            defaultValue={currentParams.search ?? ''}
            className="pl-9"
            onChange={(e) => {
              // Debounce search
              const value = e.target.value
              const timeout = setTimeout(() => {
                updateParams({ search: value || undefined })
              }, 300)
              return () => clearTimeout(timeout)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateParams({ search: (e.target as HTMLInputElement).value || undefined })
              }
            }}
          />
        </div>

        {/* Department filter */}
        <Select
          value={currentParams.departmentId ?? ''}
          onChange={(e) => updateParams({ departmentId: e.target.value || undefined })}
          className="w-auto"
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        {/* Status filter */}
        <Select
          value={currentParams.status ?? ''}
          onChange={(e) => updateParams({ status: e.target.value || undefined })}
          className="w-auto"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>

        {/* Employment type filter */}
        <Select
          value={currentParams.employmentTypeId ?? ''}
          onChange={(e) => updateParams({ employmentTypeId: e.target.value || undefined })}
          className="w-auto"
          aria-label="Filter by employment type"
        >
          <option value="">All Types</option>
          {employmentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>

        {/* Location filter */}
        <Select
          value={currentParams.locationId ?? ''}
          onChange={(e) => updateParams({ locationId: e.target.value || undefined })}
          className="w-auto"
          aria-label="Filter by location"
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
