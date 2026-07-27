/**
 * Module registration.
 *
 * defineModule() registers as an import-time side effect, and src/modules/register.ts
 * is a barrel of bare side-effect imports. That pattern is quietly fragile in
 * Next.js: server components, client components and the proxy are separate
 * module graphs, so a context that never imports the barrel sees an empty
 * registry — an empty sidebar and an empty module picker, with no error.
 *
 * These tests pin the contract so a regression fails here rather than as a
 * blank screen.
 */
import { describe, it, expect, beforeAll } from 'vitest'

const EXPECTED_MODULES = [
  'employees',
  'leave',
  'attendance',
  'onboarding',
  'documents',
  'payroll',
  'performance',
] as const

beforeAll(async () => {
  await import('@/modules/register')
})

describe('module registration', () => {
  it('registers every V1 module through the barrel', async () => {
    const { getAllModules } = await import('@/core/modules')
    const ids = getAllModules().map((m) => m.id).sort()

    expect(ids).toEqual([...EXPECTED_MODULES].sort())
  })

  it('marks employees as required so it cannot be disabled', async () => {
    const { getAllModules } = await import('@/core/modules')
    const employees = getAllModules().find((m) => m.id === 'employees')

    expect(employees).toBeDefined()
    expect(employees!.required).toBe(true)
  })

  it('declares only dependencies that actually exist', async () => {
    const { getAllModules } = await import('@/core/modules')
    const all = getAllModules()
    const ids = new Set(all.map((m) => m.id))

    for (const m of all) {
      for (const dep of m.dependsOn ?? []) {
        expect(ids.has(dep), `${m.id} depends on unknown module "${dep}"`).toBe(
          true
        )
      }
    }
  })

  it('has no dependency cycles', async () => {
    const { getAllModules } = await import('@/core/modules')
    const graph = new Map(
      getAllModules().map((m) => [m.id, m.dependsOn ?? []])
    )

    const state = new Map<string, 'visiting' | 'done'>()
    const walk = (id: string, trail: string[]): void => {
      if (state.get(id) === 'done') return
      if (state.get(id) === 'visiting') {
        throw new Error(`cycle: ${[...trail, id].join(' -> ')}`)
      }
      state.set(id, 'visiting')
      for (const dep of graph.get(id) ?? []) walk(dep, [...trail, id])
      state.set(id, 'done')
    }

    expect(() => {
      for (const id of graph.keys()) walk(id, [])
    }).not.toThrow()
  })

  it('namespaces every permission key under its owning module', async () => {
    const { getAllModules } = await import('@/core/modules')

    for (const m of getAllModules()) {
      const namespaces = m.permissionNamespaces ?? [m.id]
      for (const p of m.permissions ?? []) {
        expect(
          namespaces.some((ns) => p.key.startsWith(`${ns}.`)),
          `module "${m.id}" declares permission "${p.key}" outside its namespaces (${namespaces.join(', ')})`
        ).toBe(true)
      }
    }
  })

  it('gates every nav entry behind a permission the module owns', async () => {
    const { getAllModules } = await import('@/core/modules')

    for (const m of getAllModules()) {
      const owned = new Set((m.permissions ?? []).map((p) => p.key))
      for (const entry of m.nav ?? []) {
        expect(
          entry.permission && owned.has(entry.permission),
          `nav "${entry.label}" in module "${m.id}" is not gated by a permission it owns`
        ).toBe(true)
      }
    }
  })
})
