'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  FormField,
  Input,
  Select,
} from '@/core/ui'
import { createCalendarEvent } from '@/modules/calendar/actions'

type Audience = 'COMPANY' | 'DEPARTMENT' | 'SPECIFIC_EMPLOYEES'

interface Department {
  id: string
  name: string
}

interface EmployeeOption {
  id: string
  firstName: string
  lastName: string
}

interface AddEventDialogProps {
  orgSlug: string
  isAdmin: boolean
  departments: Department[]
  employees: EmployeeOption[]
}

export function AddEventDialog({ orgSlug, isAdmin, departments, employees }: AddEventDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [audience, setAudience] = useState<Audience>('DEPARTMENT')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeIds, setEmployeeIds] = useState<string[]>([])

  function reset() {
    setTitle('')
    setDate('')
    setAudience('DEPARTMENT')
    setDepartmentId('')
    setEmployeeIds([])
    setError('')
  }

  function toggleEmployee(id: string) {
    setEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      const result = await createCalendarEvent(orgSlug, {
        title,
        date,
        audience,
        departmentId: audience === 'DEPARTMENT' && isAdmin ? departmentId || undefined : undefined,
        employeeIds: audience === 'SPECIFIC_EMPLOYEES' ? employeeIds : undefined,
      })
      if (result.success) {
        reset()
        setIsOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Failed to create event.')
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        Add Event
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) reset()
        }}
      >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Drop a one-off event on the calendar and notify the people it&apos;s for.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="Title" htmlFor="event-title" required>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. All-hands meeting"
            />
          </FormField>

          <FormField label="Date" htmlFor="event-date" required>
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormField>

          <FormField label="Who should see this" htmlFor="event-audience" required>
            <Select
              id="event-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              {isAdmin && <option value="COMPANY">Whole company</option>}
              <option value="DEPARTMENT">My department</option>
              <option value="SPECIFIC_EMPLOYEES">Specific employees</option>
            </Select>
          </FormField>

          {audience === 'DEPARTMENT' && isAdmin && (
            <FormField label="Department" htmlFor="event-department" required>
              <Select
                id="event-department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Select a department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </FormField>
          )}

          {audience === 'SPECIFIC_EMPLOYEES' && (
            <FormField label="Employees" htmlFor="event-employees" required>
              <div className="max-h-48 overflow-y-auto rounded-[var(--radius-sm)] border border-border p-2 space-y-1.5">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-[13px] text-text">
                    <input
                      type="checkbox"
                      checked={employeeIds.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="h-4 w-4 rounded border-border text-accent-500 focus:ring-accent-500"
                    />
                    {emp.firstName} {emp.lastName}
                  </label>
                ))}
              </div>
            </FormField>
          )}

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !title ||
              !date ||
              (audience === 'DEPARTMENT' && isAdmin && !departmentId) ||
              (audience === 'SPECIFIC_EMPLOYEES' && employeeIds.length === 0)
            }
          >
            {isPending ? 'Creating...' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  )
}
