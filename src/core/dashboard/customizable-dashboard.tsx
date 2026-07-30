'use client'

import * as React from 'react'
import {
  GripVertical,
  X,
  Plus,
  Settings,
  RotateCcw,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Button } from '@/core/ui'
import { saveDashboardLayout, resetDashboardLayout } from '@/core/dashboard/layout-actions'
import type { WidgetSize } from '@/core/dashboard'
import { DASHBOARD_PRESETS, type DashboardPreset } from '@/core/dashboard/presets'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LayoutWidget {
  id: string
  title: string
  description?: string
  moduleId: string
  size: WidgetSize
  hidden: boolean
}

export interface CustomizableDashboardProps {
  orgSlug: string
  /** The visible widgets (already ordered by applyLayout), rendered by the server */
  visibleWidgets: Array<{
    id: string
    title: string
    description?: string
    moduleId: string
    size: WidgetSize
    content: React.ReactNode
  }>
  /** Hidden widgets (part of the layout but marked hidden) */
  hiddenWidgets: Array<{
    id: string
    title: string
    description?: string
    moduleId: string
    size: WidgetSize
  }>
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
// Module name lookup (client-safe)
// ─────────────────────────────────────────────

const MODULE_NAMES: Record<string, string> = {
  employees: 'Employees',
  leave: 'Leave',
  attendance: 'Attendance',
  onboarding: 'Onboarding',
  documents: 'Documents',
  payroll: 'Payroll',
  performance: 'Performance',
  expenses: 'Expenses',
  assets: 'Assets',
}

// ─────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────

const widgetVariants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.2 } },
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
  const [drawerOpen, setDrawerOpen] = React.useState(false)
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
    const map = new Map<
      string,
      {
        id: string
        title: string
        description?: string
        moduleId: string
        size: WidgetSize
        content?: React.ReactNode
      }
    >()
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
    setDrawerOpen(true)
  }

  function cancelEditMode() {
    setEditing(false)
    setDrawerOpen(false)
  }

  // ─────────────────────────────────
  // Drag & drop
  // ─────────────────────────────────

  const draggedId = React.useRef<string | null>(null)

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    draggedId.current = id
    e.dataTransfer.effectAllowed = 'move'
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
  // Presets
  // ─────────────────────────────────

  function applyPreset(preset: DashboardPreset) {
    if (preset.widgets.length === 0) {
      // "Default" preset: all visible in original order
      const allIds = [...allWidgets.keys()]
      setVisibleOrder(allIds)
      setHiddenSet(new Set())
      return
    }

    // Apply the preset's layout, but only for widgets this user has access to
    const permittedIds = new Set(allWidgets.keys())
    const newVisible: string[] = []
    const newHidden = new Set<string>()
    const mentioned = new Set<string>()

    for (const entry of preset.widgets) {
      mentioned.add(entry.id)
      if (!permittedIds.has(entry.id)) continue // defense-in-depth

      if (entry.hidden) {
        newHidden.add(entry.id)
      } else {
        newVisible.push(entry.id)
      }
    }

    // Add any permitted widgets not mentioned in the preset (visible, at end)
    for (const id of permittedIds) {
      if (!mentioned.has(id)) {
        newVisible.push(id)
      }
    }

    setVisibleOrder(newVisible)
    setHiddenSet(newHidden)
  }

  // ─────────────────────────────────
  // Save & Reset
  // ─────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const widgets = [
        ...visibleOrder.map((id) => ({ id, hidden: false })),
        ...[...hiddenSet].map((id) => ({ id, hidden: true })),
      ]
      const result = await saveDashboardLayout(orgSlug, widgets)
      if (result.success) {
        setHasLayout(true)
        setEditing(false)
        setDrawerOpen(false)
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
        setDrawerOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────
  // Render: Normal mode (with layout animations)
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
        <LayoutGroup>
          <div className="grid grid-cols-12 gap-4">
            <AnimatePresence mode="popLayout">
              {initialVisible.map((widget) => (
                <motion.div
                  key={widget.id}
                  layout
                  variants={widgetVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={sizeClasses[widget.size]}
                >
                  {widget.content}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    )
  }

  // ─────────────────────────────────
  // Render: Customize mode
  // ─────────────────────────────────

  const visibleWidgetsInOrder = visibleOrder
    .filter((id) => !hiddenSet.has(id))
    .map((id) => allWidgets.get(id))
    .filter(Boolean) as Array<{
    id: string
    title: string
    description?: string
    moduleId: string
    size: WidgetSize
    content?: React.ReactNode
  }>

  // Drawer content: widgets that are currently hidden (grouped by module)
  const hiddenWidgetsList = [...hiddenSet]
    .map((id) => allWidgets.get(id))
    .filter(Boolean) as Array<{
    id: string
    title: string
    description?: string
    moduleId: string
    size: WidgetSize
  }>

  const groupedHidden = hiddenWidgetsList.reduce<
    Record<string, typeof hiddenWidgetsList>
  >((acc, w) => {
    const key = w.moduleId
    if (!acc[key]) acc[key] = []
    acc[key].push(w)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-accent-200 bg-accent-50 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="rounded-[var(--radius-xs)] p-1.5 text-text-muted hover:bg-surface-hover hover:text-text"
            aria-label={drawerOpen ? 'Close widget drawer' : 'Open widget drawer'}
          >
            {drawerOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <p className="text-[13px] font-medium text-text">
            Customize your dashboard
          </p>
        </div>
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

      {/* Main content: drawer + grid */}
      <div className="relative flex gap-4">
        {/* Widget Drawer (overlay from left of content area) */}
        <AnimatePresence>
          {drawerOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="h-full w-[320px] overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface">
                {/* Presets */}
                <div className="border-b border-border p-4">
                  <p className="mb-2 text-[11px] font-medium text-text-muted uppercase tracking-wide">
                    Try a preset
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DASHBOARD_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-text"
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available widgets to add */}
                <div className="p-4">
                  <p className="mb-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">
                    Available widgets
                  </p>

                  {Object.keys(groupedHidden).length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-text-subtle">
                      All widgets are visible on your dashboard.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(groupedHidden).map(([moduleId, widgets]) => (
                        <div key={moduleId}>
                          <p className="mb-2 text-[11px] font-semibold text-text-subtle uppercase tracking-wide">
                            {MODULE_NAMES[moduleId] ?? moduleId}
                          </p>
                          <div className="space-y-1.5">
                            {widgets.map((widget) => (
                              <div
                                key={widget.id}
                                className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-3 py-2 transition-colors hover:border-accent-200 hover:bg-accent-50/50"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-medium text-text">
                                    {widget.title}
                                  </p>
                                  {widget.description && (
                                    <p className="truncate text-[11px] text-text-subtle">
                                      {widget.description}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => showWidget(widget.id)}
                                  className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-accent-500 transition-colors hover:bg-accent-100"
                                  aria-label={`Add ${widget.title}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Widget grid (editing) */}
        <div className="flex-1 min-w-0">
          <LayoutGroup>
            <div className="grid grid-cols-12 gap-4">
              <AnimatePresence mode="popLayout">
                {visibleWidgetsInOrder.map((widget) => (
                  <motion.div
                    key={widget.id}
                    layout
                    variants={widgetVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={sizeClasses[widget.size]}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(
                        e as unknown as React.DragEvent<HTMLDivElement>,
                        widget.id
                      )
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) =>
                      handleDrop(
                        e as unknown as React.DragEvent<HTMLDivElement>,
                        widget.id
                      )
                    }
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
                          className="rounded-[var(--radius-xs)] p-1 text-text-muted hover:bg-surface-hover hover:text-danger"
                          aria-label={`Remove ${widget.title}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Faded preview */}
                      <div className="pointer-events-none opacity-40">
                        {widget.content}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>

          {visibleWidgetsInOrder.length === 0 && (
            <div className="flex h-[200px] items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-border">
              <p className="text-[13px] text-text-subtle">
                No widgets visible. Add some from the drawer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
