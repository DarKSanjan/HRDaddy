'use client'

import { useActionState } from 'react'
import { useState } from 'react'
import {
  Card,
  Button,
  FormField,
  Input,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/core/ui'
import { createShiftTemplate, updateShiftTemplate, archiveShiftTemplate } from '@/modules/employees/actions'
import type { ShiftTemplateItem } from '@/modules/employees/queries'

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function EditShiftTemplateDialog({
  template,
  orgSlug,
}: {
  template: ShiftTemplateItem
  orgSlug: string
}) {
  const [open, setOpen] = useState(false)

  const [editState, editAction, editPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await updateShiftTemplate(orgSlug, formData)
      if (result.success) {
        setOpen(false)
      }
      return result
    },
    null
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-[12px]">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Shift Template</DialogTitle>
          <DialogDescription>
            Update the shift template &ldquo;{template.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form action={editAction} className="space-y-4">
          <input type="hidden" name="shiftTemplateId" value={template.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor={`edit-name-${template.id}`} required>
              <Input
                name="name"
                id={`edit-name-${template.id}`}
                defaultValue={template.name}
                required
              />
            </FormField>
            <FormField label="Start Time (minutes from midnight)" htmlFor={`edit-startMinutes-${template.id}`} required>
              <Input
                name="startMinutes"
                id={`edit-startMinutes-${template.id}`}
                type="number"
                defaultValue={template.startMinutes}
                required
              />
            </FormField>
            <FormField label="End Time (minutes from midnight)" htmlFor={`edit-endMinutes-${template.id}`} required>
              <Input
                name="endMinutes"
                id={`edit-endMinutes-${template.id}`}
                type="number"
                defaultValue={template.endMinutes}
                required
              />
            </FormField>
            <FormField label="Standard Minutes/Day" htmlFor={`edit-standardMinutesPerDay-${template.id}`} required>
              <Input
                name="standardMinutesPerDay"
                id={`edit-standardMinutesPerDay-${template.id}`}
                type="number"
                defaultValue={template.standardMinutesPerDay}
                required
              />
            </FormField>
            <FormField label="Overtime Multiplier" htmlFor={`edit-overtimeMultiplier-${template.id}`}>
              <Input
                name="overtimeMultiplier"
                id={`edit-overtimeMultiplier-${template.id}`}
                type="number"
                step="0.01"
                defaultValue={template.overtimeMultiplier}
              />
            </FormField>
            <FormField label="Rest Day Multiplier" htmlFor={`edit-restDayMultiplier-${template.id}`}>
              <Input
                name="restDayMultiplier"
                id={`edit-restDayMultiplier-${template.id}`}
                type="number"
                step="0.01"
                defaultValue={template.restDayMultiplier}
              />
            </FormField>
          </div>

          {editState && 'error' in editState && editState.error && (
            <p className="text-[13px] text-danger">{editState.error}</p>
          )}
          {editState && 'fieldErrors' in editState && editState.fieldErrors && (
            <p className="text-[13px] text-danger">
              {Object.values(editState.fieldErrors as Record<string, string>).join(', ')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={editPending}>
              {editPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ShiftTemplatesPanel({
  orgSlug,
  shiftTemplates,
}: {
  orgSlug: string
  shiftTemplates: ShiftTemplateItem[]
}) {
  const [createState, createAction, createPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return createShiftTemplate(orgSlug, formData)
    },
    null
  )

  return (
    <div className="space-y-6">
      {/* Existing templates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shiftTemplates.map((t) => (
          <Card key={t.id} className={t.isArchived ? 'opacity-50' : ''}>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-text">{t.name}</h3>
                {t.isArchived && (
                  <span className="text-[11px] text-text-muted bg-surface-muted px-1.5 py-0.5 rounded">
                    Archived
                  </span>
                )}
              </div>
              <div className="text-[13px] text-text-muted space-y-1">
                <p>
                  {formatMinutesToTime(t.startMinutes)} – {formatMinutesToTime(t.endMinutes)}
                </p>
                <p>Standard: {Math.round(t.standardMinutesPerDay / 60 * 10) / 10}h/day</p>
                <p>OT: ×{t.overtimeMultiplier} | Rest Day: ×{t.restDayMultiplier}</p>
              </div>
              {!t.isArchived && (
                <div className="flex items-center gap-2">
                  <EditShiftTemplateDialog template={t} orgSlug={orgSlug} />
                  <form
                    action={async (formData: FormData) => {
                      formData.set('shiftTemplateId', t.id)
                      await archiveShiftTemplate(orgSlug, formData)
                    }}
                  >
                    <Button type="submit" variant="ghost" size="sm" className="text-[12px]">
                      Archive
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Create new */}
      <Card>
        <form action={createAction} className="p-4 space-y-4">
          <h3 className="text-[14px] font-medium text-text">New Shift Template</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="name" required>
              <Input name="name" id="name" placeholder="e.g. Standard 9-5" required />
            </FormField>
            <FormField label="Start Time (minutes from midnight)" htmlFor="startMinutes" required>
              <Input name="startMinutes" id="startMinutes" type="number" placeholder="540" required />
            </FormField>
            <FormField label="End Time (minutes from midnight)" htmlFor="endMinutes" required>
              <Input name="endMinutes" id="endMinutes" type="number" placeholder="1020" required />
            </FormField>
            <FormField label="Standard Minutes/Day" htmlFor="standardMinutesPerDay" required>
              <Input name="standardMinutesPerDay" id="standardMinutesPerDay" type="number" placeholder="480" required />
            </FormField>
            <FormField label="Overtime Multiplier" htmlFor="overtimeMultiplier">
              <Input name="overtimeMultiplier" id="overtimeMultiplier" type="number" step="0.01" placeholder="1.50" />
            </FormField>
            <FormField label="Rest Day Multiplier" htmlFor="restDayMultiplier">
              <Input name="restDayMultiplier" id="restDayMultiplier" type="number" step="0.01" placeholder="2.00" />
            </FormField>
          </div>

          {createState && 'error' in createState && createState.error && (
            <p className="text-[13px] text-danger">{createState.error}</p>
          )}

          <Button type="submit" disabled={createPending}>
            {createPending ? 'Creating…' : 'Create Shift Template'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
