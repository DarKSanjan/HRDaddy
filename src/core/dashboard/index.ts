/**
 * Dashboard kernel — resolves widgets from module manifests.
 *
 * Widgets register themselves; the kernel filters by enabled modules, role,
 * and permission before the page renders. A disabled module's widgets are
 * excluded from both render AND query.
 */
import 'server-only'

import type { OrgRole } from '@prisma/client'
import type { ComponentType } from 'react'
import { hasPermission } from '@/core/permissions'

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
// Registry
// ─────────────────────────────────────────────

const widgets: DashboardWidget[] = []

/**
 * Register a dashboard widget. Called by module manifests at import time.
 */
export function registerWidget(widget: DashboardWidget): void {
  widgets.push(widget)
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
  widgets.length = 0
}
