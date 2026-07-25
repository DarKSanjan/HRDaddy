/**
 * Dashboard kernel — resolves widgets from module manifests.
 *
 * Widgets are declared in each module's manifest `widgets` field.
 * The kernel reads from the module registry, filtering by enabled modules,
 * role, and permission before the page renders. A disabled module's widgets
 * are excluded from both render AND query.
 *
 * The kernel NEVER imports from src/modules — it reads the registry that
 * modules populated via defineModule().
 */
import 'server-only'

import type { OrgRole } from '@prisma/client'
import type { ComponentType } from 'react'
import { hasPermission } from '@/core/permissions'
import { getAllModules } from '@/core/modules'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type WidgetSize = 'sm' | 'md' | 'lg'

export type WidgetRole = 'owner' | 'manager' | 'employee'

export interface WidgetProps {
  orgId: string
  orgSlug: string
  orgTimezone: string
  userId: string
  role: OrgRole
  employeeId?: string
  managedEmployeeIds?: string[]
}

export interface DashboardWidget {
  id: string
  moduleId: string
  title: string
  permission?: string
  roles: WidgetRole[]
  size: WidgetSize
  priority: number
  component: ComponentType<WidgetProps>
}

// ─────────────────────────────────────────────
// Legacy registry (for backward compat during migration)
// ─────────────────────────────────────────────

const legacyWidgets: DashboardWidget[] = []

/**
 * Register a dashboard widget imperatively.
 * @deprecated Use the `widgets` field on ModuleManifest instead.
 */
export function registerWidget(widget: DashboardWidget): void {
  legacyWidgets.push(widget)
}

/**
 * Map OrgRole to the WidgetRole(s) that should be visible.
 */
function roleToWidgetRoles(role: OrgRole): WidgetRole[] {
  switch (role) {
    case 'OWNER':
    case 'HR_ADMIN':
      return ['owner']
    case 'MANAGER':
      return ['manager']
    case 'EMPLOYEE':
      return ['employee']
    default:
      return []
  }
}

/**
 * Collect widgets from module manifests + legacy registry.
 * Module manifests are the source of truth; legacy entries are included
 * for any widgets not yet migrated.
 */
function collectWidgets(): DashboardWidget[] {
  const all: DashboardWidget[] = []
  const seenIds = new Set<string>()

  // Collect from module manifests (preferred source)
  for (const manifest of getAllModules()) {
    if (!manifest.widgets) continue
    for (const w of manifest.widgets) {
      const widget: DashboardWidget = {
        id: w.id,
        moduleId: manifest.id,
        title: w.title,
        permission: w.permission,
        roles: w.roles,
        size: w.size as WidgetSize,
        priority: w.priority,
        component: w.component as ComponentType<WidgetProps>,
      }
      all.push(widget)
      seenIds.add(w.id)
    }
  }

  // Include legacy widgets that haven't been migrated to manifests
  for (const w of legacyWidgets) {
    if (!seenIds.has(w.id)) {
      all.push(w)
    }
  }

  return all
}

/**
 * Resolve which widgets to display for a given viewer.
 * Filters by: enabled modules, role mapping, permission check.
 * Returns sorted by priority ascending (lower = higher on page).
 */
export function resolveWidgets(
  role: OrgRole,
  enabledModules: string[]
): DashboardWidget[] {
  const viewerWidgetRoles = roleToWidgetRoles(role)
  const enabledSet = new Set(enabledModules)
  const widgets = collectWidgets()

  return widgets
    .filter((w) => {
      // Module must be enabled (employees is always enabled as required)
      if (!enabledSet.has(w.moduleId) && w.moduleId !== 'employees') {
        return false
      }

      // Widget must target the viewer's role
      if (!w.roles.some((r) => viewerWidgetRoles.includes(r))) {
        return false
      }

      // Permission check (if widget declares one)
      if (w.permission && !hasPermission(role, enabledModules, w.permission)) {
        return false
      }

      return true
    })
    .sort((a, b) => a.priority - b.priority)
}

/**
 * Reset registry (for testing).
 */
export function _resetWidgets(): void {
  legacyWidgets.length = 0
}
