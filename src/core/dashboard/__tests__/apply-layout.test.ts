/**
 * Tests for applyLayout — the layout-resolution logic that applies a saved
 * layout on top of the permitted widget set.
 *
 * This is the security-sensitive core: a saved layout must NEVER surface a
 * widget the viewer isn't entitled to see, even if the stored JSON contains
 * foreign widget IDs (from a role change or module disable after save).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveWidgets,
  applyLayout,
  registerWidget,
  _resetWidgets,
} from '@/core/dashboard'
import type { DashboardWidget, SavedLayout } from '@/core/dashboard'
import { registerPermissions, _resetPermissions } from '@/core/permissions'

// Mock component for testing
function MockWidget() {
  return null
}

function makeWidget(overrides: Partial<DashboardWidget>): DashboardWidget {
  return {
    id: 'test-widget',
    moduleId: 'employees',
    title: 'Test Widget',
    roles: ['owner'],
    size: 'sm',
    priority: 10,
    component: MockWidget,
    ...overrides,
  }
}

describe('applyLayout', () => {
  const widgetA = makeWidget({ id: 'widget-a', title: 'A', priority: 10 })
  const widgetB = makeWidget({ id: 'widget-b', title: 'B', priority: 20 })
  const widgetC = makeWidget({ id: 'widget-c', title: 'C', priority: 30 })
  const widgetD = makeWidget({ id: 'widget-d', title: 'D', priority: 40 })

  const permittedWidgets = [widgetA, widgetB, widgetC, widgetD]

  it('returns default order when no layout is saved (null)', () => {
    const result = applyLayout(permittedWidgets, null)
    expect(result.map((w) => w.id)).toEqual(['widget-a', 'widget-b', 'widget-c', 'widget-d'])
  })

  it('returns default order when layout has empty widgets array', () => {
    const result = applyLayout(permittedWidgets, { widgets: [] })
    expect(result.map((w) => w.id)).toEqual(['widget-a', 'widget-b', 'widget-c', 'widget-d'])
  })

  it('reorders widgets according to saved layout', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-c', hidden: false },
        { id: 'widget-a', hidden: false },
        { id: 'widget-d', hidden: false },
        { id: 'widget-b', hidden: false },
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    expect(result.map((w) => w.id)).toEqual(['widget-c', 'widget-a', 'widget-d', 'widget-b'])
  })

  it('hides widgets marked hidden: true', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-a', hidden: false },
        { id: 'widget-b', hidden: true },
        { id: 'widget-c', hidden: false },
        { id: 'widget-d', hidden: true },
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    expect(result.map((w) => w.id)).toEqual(['widget-a', 'widget-c'])
  })

  it('appends unmentioned widgets after customized ones in default priority order', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-c', hidden: false },
        { id: 'widget-a', hidden: false },
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    // Customized first (C, A), then unmentioned (B, D) in priority order
    expect(result.map((w) => w.id)).toEqual(['widget-c', 'widget-a', 'widget-b', 'widget-d'])
  })

  it('DEFENSE-IN-DEPTH: drops widget IDs not in permitted set', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-c', hidden: false },
        { id: 'foreign-widget', hidden: false }, // Not permitted!
        { id: 'widget-a', hidden: false },
        { id: 'another-foreign', hidden: false }, // Not permitted!
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    // Foreign widgets silently dropped; unmentioned widgets appended
    expect(result.map((w) => w.id)).toEqual(['widget-c', 'widget-a', 'widget-b', 'widget-d'])
    expect(result.find((w) => w.id === 'foreign-widget')).toBeUndefined()
    expect(result.find((w) => w.id === 'another-foreign')).toBeUndefined()
  })

  it('DEFENSE-IN-DEPTH: cannot unhide a foreign widget via stored layout', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'secret-admin-widget', hidden: false }, // Not in permitted set
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    // The foreign widget is dropped; all permitted widgets appear in default order
    expect(result.map((w) => w.id)).toEqual(['widget-a', 'widget-b', 'widget-c', 'widget-d'])
  })

  it('hidden foreign widget is also silently dropped (no side effects)', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-a', hidden: false },
        { id: 'foreign-widget', hidden: true }, // Not permitted, hidden
        { id: 'widget-b', hidden: true }, // Permitted, hidden
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    // widget-a visible, widget-b hidden, foreign dropped, C and D unmentioned (appended)
    expect(result.map((w) => w.id)).toEqual(['widget-a', 'widget-c', 'widget-d'])
  })

  it('correctly handles a layout where all widgets are hidden', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-a', hidden: true },
        { id: 'widget-b', hidden: true },
        { id: 'widget-c', hidden: true },
        { id: 'widget-d', hidden: true },
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    // All are mentioned and hidden → nothing appears
    expect(result).toEqual([])
  })

  it('handles partial layout (some customized, some not)', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'widget-d', hidden: false },
        { id: 'widget-b', hidden: true },
      ],
    }
    const result = applyLayout(permittedWidgets, layout)
    // D is first (customized visible), B is hidden, A and C are unmentioned (in priority order)
    expect(result.map((w) => w.id)).toEqual(['widget-d', 'widget-a', 'widget-c'])
  })

  it('works with a single widget in permitted set', () => {
    const layout: SavedLayout = {
      widgets: [{ id: 'widget-a', hidden: false }],
    }
    const result = applyLayout([widgetA], layout)
    expect(result.map((w) => w.id)).toEqual(['widget-a'])
  })

  it('works with empty permitted set', () => {
    const layout: SavedLayout = {
      widgets: [{ id: 'widget-a', hidden: false }],
    }
    const result = applyLayout([], layout)
    expect(result).toEqual([])
  })
})

describe('resolveWidgets + applyLayout integration', () => {
  beforeEach(() => {
    _resetWidgets()
    _resetPermissions()

    registerPermissions('employees', [
      { key: 'employee.view_all', description: 'View all', defaultRoles: ['OWNER', 'HR_ADMIN'] },
    ])
    registerPermissions('leave', [
      { key: 'leave.balance.view_own', description: 'View own balance', defaultRoles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ])

    registerWidget({
      id: 'headcount',
      moduleId: 'employees',
      title: 'Headcount',
      permission: 'employee.view_all',
      roles: ['owner'],
      size: 'sm',
      priority: 10,
      component: MockWidget,
    })
    registerWidget({
      id: 'leave-balance',
      moduleId: 'leave',
      title: 'Leave Balance',
      permission: 'leave.balance.view_own',
      roles: ['owner', 'employee'],
      size: 'sm',
      priority: 20,
      component: MockWidget,
    })
    registerWidget({
      id: 'admin-chart',
      moduleId: 'employees',
      title: 'Admin Chart',
      permission: 'employee.view_all',
      roles: ['owner'],
      size: 'md',
      priority: 30,
      component: MockWidget,
    })
  })

  it('stale layout from role change does not leak owner widgets to employee', () => {
    // Layout saved when user was OWNER — references all widgets
    const staleLayout: SavedLayout = {
      widgets: [
        { id: 'admin-chart', hidden: false },
        { id: 'headcount', hidden: false },
        { id: 'leave-balance', hidden: false },
      ],
    }

    // User is now EMPLOYEE — only leave-balance is permitted
    const permitted = resolveWidgets('EMPLOYEE', ['employees', 'leave'])
    const result = applyLayout(permitted, staleLayout)

    // Only the employee-permitted widget appears
    expect(result.map((w) => w.id)).toEqual(['leave-balance'])
  })

  it('stale layout from module disable does not show disabled module widgets', () => {
    const layout: SavedLayout = {
      widgets: [
        { id: 'leave-balance', hidden: false },
        { id: 'headcount', hidden: false },
      ],
    }

    // Leave module disabled
    const permitted = resolveWidgets('OWNER', ['employees'])
    const result = applyLayout(permitted, layout)

    // leave-balance is dropped (module disabled), headcount stays
    expect(result.map((w) => w.id)).toEqual(['headcount', 'admin-chart'])
  })
})
