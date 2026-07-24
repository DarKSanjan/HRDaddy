'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from '@/core/ui'
import {
  createDepartment,
  archiveDepartment,
  createJobTitle,
  deleteJobTitle,
  createWorkLocation,
  deleteWorkLocation,
  createEmploymentType,
  deleteEmploymentType,
  type ActionResult,
} from '@/modules/employees/actions'
import { Plus, Trash2, Building2, Briefcase, MapPin, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Department {
  id: string
  name: string
  managerId: string | null
  manager: { id: string; firstName: string; lastName: string } | null
  _count: { employees: number }
}

interface OrgStructurePanelProps {
  orgSlug: string
  departments: Department[]
  jobTitles: { id: string; name: string }[]
  locations: { id: string; name: string; address: string | null }[]
  employmentTypes: { id: string; name: string }[]
}

type ActiveSection = 'departments' | 'jobTitles' | 'locations' | 'employmentTypes'

export function OrgStructurePanel({
  orgSlug,
  departments,
  jobTitles,
  locations,
  employmentTypes,
}: OrgStructurePanelProps) {
  const router = useRouter()
  const [section, setSection] = useState<ActiveSection>('departments')
  const [error, setError] = useState<string | null>(null)

  const sections: { id: ActiveSection; label: string; icon: typeof Building2 }[] = [
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'jobTitles', label: 'Job Titles', icon: Briefcase },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'employmentTypes', label: 'Employment Types', icon: Clock },
  ]

  return (
    <div className="space-y-6">
      {/* Section tabs */}
      <div className="flex gap-2">
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium transition-colors',
                section === s.id
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              )}
              onClick={() => {
                setSection(s.id)
                setError(null)
              }}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {/* Departments */}
      {section === 'departments' && (
        <DepartmentsSection
          orgSlug={orgSlug}
          departments={departments}
          onError={setError}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Job Titles */}
      {section === 'jobTitles' && (
        <SimpleListSection
          items={jobTitles}
          label="Job Title"
          onAdd={(fd) => createJobTitle(orgSlug, fd)}
          onDelete={(id) => deleteJobTitle(orgSlug, id)}
          onError={setError}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Locations */}
      {section === 'locations' && (
        <SimpleListSection
          items={locations.map((l) => ({ id: l.id, name: `${l.name}${l.address ? ` - ${l.address}` : ''}` }))}
          label="Work Location"
          onAdd={(fd) => createWorkLocation(orgSlug, fd)}
          onDelete={(id) => deleteWorkLocation(orgSlug, id)}
          onError={setError}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Employment Types */}
      {section === 'employmentTypes' && (
        <SimpleListSection
          items={employmentTypes}
          label="Employment Type"
          onAdd={(fd) => createEmploymentType(orgSlug, fd)}
          onDelete={(id) => deleteEmploymentType(orgSlug, id)}
          onError={setError}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Departments section
// ─────────────────────────────────────────────

function DepartmentsSection({
  orgSlug,
  departments,
  onError,
  onSuccess,
}: {
  orgSlug: string
  departments: Department[]
  onError: (msg: string) => void
  onSuccess: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    const fd = new FormData()
    fd.set('name', newName.trim())
    const result = await createDepartment(orgSlug, fd)
    if (result.success) {
      setNewName('')
      setAdding(false)
      onSuccess()
    } else {
      onError(result.error ?? result.fieldErrors?.name ?? 'Failed to create department')
    }
  }

  const handleArchive = async (id: string) => {
    const result = await archiveDepartment(orgSlug, id)
    if (result.success) {
      onSuccess()
    } else {
      onError(result.error ?? 'Failed to archive department')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Departments</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Department name"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') setAdding(false)
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleAdd}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        )}

        {departments.length === 0 && !adding && (
          <p className="text-[13px] text-text-muted">No departments defined.</p>
        )}

        {departments.map((dept) => (
          <div
            key={dept.id}
            className="flex items-center justify-between rounded-[var(--radius-xs)] border border-border p-3"
          >
            <div>
              <div className="text-[13px] font-medium text-text">{dept.name}</div>
              <div className="flex items-center gap-2 text-[12px] text-text-muted">
                {dept.manager && (
                  <span>Manager: {dept.manager.firstName} {dept.manager.lastName}</span>
                )}
                <Badge variant="neutral">{dept._count.employees} employees</Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleArchive(dept.id)}
              aria-label={`Archive ${dept.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Shared simple list section (job titles, locations, employment types)
// ─────────────────────────────────────────────

function SimpleListSection({
  items,
  label,
  onAdd,
  onDelete,
  onError,
  onSuccess,
}: {
  items: { id: string; name: string }[]
  label: string
  onAdd: (fd: FormData) => Promise<ActionResult>
  onDelete: (id: string) => Promise<ActionResult>
  onError: (msg: string) => void
  onSuccess: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    const fd = new FormData()
    fd.set('name', newName.trim())
    const result = await onAdd(fd)
    if (result.success) {
      setNewName('')
      setAdding(false)
      onSuccess()
    } else {
      onError(result.error ?? result.fieldErrors?.name ?? `Failed to create ${label.toLowerCase()}`)
    }
  }

  const handleDelete = async (id: string) => {
    const result = await onDelete(id)
    if (result.success) {
      onSuccess()
    } else {
      onError(result.error ?? `Failed to delete ${label.toLowerCase()}`)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{label}s</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`${label} name`}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') setAdding(false)
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleAdd}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        )}

        {items.length === 0 && !adding && (
          <p className="text-[13px] text-text-muted">No {label.toLowerCase()}s defined.</p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-[var(--radius-xs)] border border-border p-3"
          >
            <span className="text-[13px] text-text">{item.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(item.id)}
              aria-label={`Delete ${item.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
