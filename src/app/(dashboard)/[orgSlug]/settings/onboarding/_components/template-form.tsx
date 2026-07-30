'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button, Input, Textarea, FormField, Select } from '@/core/ui'
import { createTemplate, updateTemplate, fetchTemplateDetail } from '@/modules/onboarding/actions'

interface TaskDraft {
  id: string
  title: string
  description: string
  assigneeType: 'EMPLOYEE' | 'MANAGER' | 'HR'
  dueInDays: number
}

interface TemplateFormProps {
  orgSlug: string
  templateId?: string
  onSuccess: () => void
  onCancel: () => void
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function TemplateForm({ orgSlug, templateId, onSuccess, onCancel }: TemplateFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState<TaskDraft[]>([
    { id: generateId(), title: '', description: '', assigneeType: 'EMPLOYEE', dueInDays: 1 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(!!templateId)

  // Load existing template for edit mode
  useEffect(() => {
    if (!templateId) return
    let cancelled = false

    async function load() {
      try {
        const data = await fetchTemplateDetail(orgSlug, templateId!)
        if (!cancelled && data) {
          setName(data.name)
          setDescription(data.description || '')
          setTasks(
            data.tasks.map((t) => ({
              id: generateId(),
              title: t.title,
              description: t.description || '',
              assigneeType: t.assigneeType as 'EMPLOYEE' | 'MANAGER' | 'HR',
              dueInDays: t.dueInDays,
            }))
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [templateId, orgSlug])

  const addTask = useCallback(() => {
    setTasks((prev) => [
      ...prev,
      { id: generateId(), title: '', description: '', assigneeType: 'EMPLOYEE', dueInDays: 1 },
    ])
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateTask = useCallback((id: string, field: keyof TaskDraft, value: string | number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})

    const input = {
      ...(templateId ? { templateId } : {}),
      name,
      description,
      tasks: tasks.map((t, i) => ({
        title: t.title,
        description: t.description || undefined,
        assigneeType: t.assigneeType,
        dueInDays: t.dueInDays,
        sortOrder: i,
      })),
    }

    let result: { success: boolean; error?: string; fieldErrors?: Record<string, string> }
    if (templateId) {
      result = await updateTemplate(orgSlug, input)
    } else {
      result = await createTemplate(orgSlug, input)
    }

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? 'An error occurred.')
      if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    }
    setSaving(false)
  }

  if (loading) {
    return <p className="text-[13px] text-text-muted py-4">Loading template…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Template Name" htmlFor="template-name" required error={fieldErrors.name}>
        <Input
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standard Onboarding"
          maxLength={200}
        />
      </FormField>

      <FormField label="Description" htmlFor="template-description" hint="Optional">
        <Textarea
          id="template-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this template"
          rows={2}
          maxLength={1000}
        />
      </FormField>

      {/* Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-text">
            Tasks <span className="text-danger">*</span>
          </label>
          <Button variant="ghost" size="sm" onClick={addTask} type="button">
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>

        {fieldErrors.tasks && (
          <p className="text-[12px] text-danger">{fieldErrors.tasks}</p>
        )}

        {tasks.map((task, index) => (
          <div
            key={task.id}
            className="rounded-[var(--radius-sm)] border border-border p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-2.5 text-text-subtle shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={task.title}
                    onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                    placeholder={`Task ${index + 1} title`}
                    maxLength={200}
                    className="flex-1"
                    aria-label={`Task ${index + 1} title`}
                  />
                  {tasks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTask(task.id)}
                      aria-label={`Remove task ${index + 1}`}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={task.description}
                  onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                  placeholder="Task description (optional)"
                  rows={1}
                  maxLength={1000}
                  className="min-h-[36px]"
                  aria-label={`Task ${index + 1} description`}
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] text-text-muted mb-0.5 block">Assignee</label>
                    <Select
                      value={task.assigneeType}
                      onChange={(e) => updateTask(task.id, 'assigneeType', e.target.value)}
                      aria-label={`Task ${index + 1} assignee type`}
                    >
                      <option value="EMPLOYEE">Employee</option>
                      <option value="MANAGER">Manager</option>
                      <option value="HR">HR</option>
                    </Select>
                  </div>
                  <div className="w-24">
                    <label className="text-[11px] text-text-muted mb-0.5 block">Due (days)</label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={task.dueInDays}
                      onChange={(e) => updateTask(task.id, 'dueInDays', parseInt(e.target.value) || 0)}
                      aria-label={`Task ${index + 1} due in days`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="md" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button variant="primary" size="md" type="submit" loading={saving}>
          {templateId ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>
    </form>
  )
}
