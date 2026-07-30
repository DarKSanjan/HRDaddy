'use client'

import * as React from 'react'
import { GripVertical, Eye, EyeOff, Settings, RotateCcw } from 'lucide-react'
import { Button } from '@/core/ui'
import { saveDashboardLayout, resetDashboardLayout } from '@/core/dashboard/layout-actions'
import type { WidgetSize } from '@/core/dashboard'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LayoutWidget {
  id: string
  title: string
  size: WidgetSize
  hidden: boolean
}

export interface CustomizableDashboardProps {
  orgSlug: string
  /** The visible widgets (already ordered by applyLayout), rendered by the server */
  visibleWidgets: Array<{ id: string; title: string; size: WidgetSize; content: React.ReactNode }>
  /** Hidden widgets (part of the layout but marked hidden) */
  hiddenWidgets: Array<{ id: string; title: string; size: WidgetSize }>
  /** Whether the user has a saved layout (to show reset button) */
  hasLayout: boolean
}

// ─────────────────────────────────────────────
// Size classes (mirror grid.tsx)
// ─────────────────────────────────────────────

const sizeClasses: Record<string, string> = {
  sm: 'col-span-12 sm:col-span-6 lg:col-span-3',
  md: 'col-span-12 lg:col-span-6',
  lg: 'col-span-12',
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function CustomizableDashboard({
  orgSlug,
  visibleWidgets: initialVisible,
  hiddenWidgets: initialHidden,
  hasLayout: initialHasLayout,
}: CustomizableDashboardProps) {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Local edit state (only used during customize mode)
  const [visibleOrder, setVisibleOrder] = React.useState(
    initialVisible.map((w) => w.id)
  )
  const [hiddenSet, setHiddenSet] = React.useState<Set<string>>(
    new Set(initialHidden.map((w) => w.id))
  )
  const [hasLayout, setHasLayout] = React.useState(initialHasLayout)

  // All widgets (visible + hidden) for reference during editing
  const allWidgets = React.useMemo(() => {
    const map = new Map<string, { id: string; title: string; size: WidgetSize; content?: React.ReactNode }>()
    for (const w of initialVisible) map.set(w.id, w)
    for (const w of initialHidden) map.set(w.id, w)
    return map
  }, [initialVisible, initialHidden])

  // ─────────────────────────────────
  // Enter/exit edit mode
  // ─────────────────────────────────

  function enterEditMode() {
    setVisibleOrder(initialVisible.map((w) => w.id))
    setHiddenSet(new Set(initialHidden.map((w) => w.id)))
    setEditing(true)
  }

  function cancelEditMode() {
    setEditing(false)
  }

  // ─────────────────────────────────
  // Drag & drop
  // ─────────────────────────────────

  const draggedId = React.useRef<string | null>(null)

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    draggedId.current = id
    e.dataTransfer.effectAllowed = 'move'
    // Required for Firefox
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault()
    const sourceId = draggedId.current
    if (!sourceId || sourceId === targetId) return

    setVisibleOrder((prev) => {
      const newOrder = [...prev]
      const sourceIdx = newOrder.indexOf(sourceId)
      const targetIdx = newOrder.indexOf(targetId)
      if (sourceIdx === -1 || targetIdx === -1) return prev
      newOrder.splice(sourceIdx, 1)
      newOrder.splice(targetIdx, 0, sourceId)
      return newOrder
    })
    draggedId.current = null
  }

  // ─────────────────────────────────
  // Hide / show
  // ─────────────────────────────────

  function hideWidget(id: string) {
    setHiddenSet((prev) => new Set([...prev, id]))
    setVisibleOrder((prev) => prev.filter((wId) => wId !== id))
  }

  function showWidget(id: string) {
    setHiddenSet((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setVisibleOrder((prev) => [...prev, id])
  }

  // ─────────────────────────────────
  // Save & Reset
  // ─────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      // Build the full layout: visible widgets (ordered) + hidden widgets
      const widgets = [
        ...visibleOrder.map((id) => ({ id, hidden: false })),
        ...[...hiddenSet].map((id) => ({ id, hidden: true })),
      ]
      const result = await saveDashboardLayout(orgSlug, widgets)
      if (result.success) {
        setHasLayout(true)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    try {
      const result = await resetDashboardLayout(orgSlug)
      if (result.success) {
        setHasLayout(false)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────
  // Render: Normal mode
  // ─────────────────────────────────

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={enterEditMode}>
            <Settings className="h-4 w-4" />
            Customize
          </Button>
        </div>
        <div className="grid grid-cols-12 gap-4">
          {initialVisible.map((widget) => (
            <div key={widget.id} className={sizeClasses[widget.size]}>
              {widget.content}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────
  // Render: Customize mode
  // ─────────────────────────────────

  const visibleWidgetsInOrder = visibleOrder
    .filter((id) => !hiddenSet.has(id))
    .map((id) => allWidgets.get(id))
    .filter(Boolean) as Array<{ id: string; title: string; size: WidgetSize; content?: React.ReactNode }>

  const hiddenWidgetsList = [...hiddenSet]
    .map((id) => allWidgets.get(id))
    .filter(Boolean) as Array<{ id: string; title: string; size: WidgetSize }>

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-accent-200 bg-accent-50 p-3">
        <p className="text-[13px] font-medium text-text">
          Customize your dashboard — drag to reorder, toggle visibility
        </p>
        <div className="flex items-center gap-2">
          {hasLayout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to default
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={cancelEditMode} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            Save layout
          </Button>
        </div>
      </div>

      {/* Visible widgets (draggable) */}
      <div className="grid grid-cols-12 gap-4">
        {visibleWidgetsInOrder.map((widget) => (
          <div
            key={widget.id}
            className={sizeClasses[widget.size]}
            draggable
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, widget.id)}
          >
            <div className="group relative rounded-[var(--radius-md)] border-2 border-dashed border-border bg-surface p-4 transition-colors hover:border-accent-300">
              {/* Drag handle + controls overlay */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab text-text-muted active:cursor-grabbing" />
                  <span className="text-[13px] font-medium text-text">
                    {widget.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => hideWidget(widget.id)}
                  className="rounded-[var(--radius-xs)] p-1 text-text-muted hover:bg-surface-hover hover:text-text"
                  aria-label={`Hide ${widget.title}`}
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </div>
              {/* Faded preview */}
              <div className="pointer-events-none opacity-40">
                {widget.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden widgets panel */}
      {hiddenWidgetsList.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="mb-3 text-[12px] font-medium text-text-muted uppercase tracking-wide">
            Hidden widgets
          </p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgetsList.map((widget) => (
              <button
                key={widget.id}
                type="button"
                onClick={() => showWidget(widget.id)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:border-accent-300 hover:text-text"
              >
                <Eye className="h-3.5 w-3.5" />
                {widget.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
