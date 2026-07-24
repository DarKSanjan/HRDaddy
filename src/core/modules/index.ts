/**
 * Module registry — the heart of the kernel.
 * Modules register manifests; the kernel derives nav, permissions, settings, widgets.
 */
import { notFound } from 'next/navigation'
import type { OrgRole } from '@prisma/client'
import type { PermissionDef } from '@/core/permissions'
import { registerPermissions, resolvePermissions } from '@/core/permissions'
import { dbAdmin } from '@/core/db/admin'
import type { ZodSchema } from 'zod'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface NavEntry {
  label: string
  href: string
  icon?: string
  permission?: string
  badge?: string
}

export interface WidgetDef {
  id: string
  permission?: string
  component?: unknown // React component, typed loosely to avoid circular deps
}

export type EventHandler = (payload: unknown, ctx: ModuleContext) => Promise<void>

export interface ModuleContext {
  orgId: string
  userId: string
}

export interface ModuleManifest {
  id: string
  name: string
  version: string
  description: string
  dependsOn: string[]
  required?: boolean
  permissions: PermissionDef[]
  nav: NavEntry[]
  settings?: ZodSchema
  widgets?: WidgetDef[]
  events?: { emits: string[]; on?: Record<string, EventHandler> }
  seed?: (ctx: ModuleContext) => Promise<void>
  onEnable?: (ctx: ModuleContext) => Promise<void>
  onDisable?: (ctx: ModuleContext) => Promise<void>
}

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

const manifests = new Map<string, ModuleManifest>()

/**
 * Define and register a module manifest.
 */
export function defineModule(m: ModuleManifest): ModuleManifest {
  manifests.set(m.id, m)
  // Register this module's permissions with the permissions kernel
  registerPermissions(m.id, m.permissions)
  return m
}

/**
 * Get all registered module manifests.
 */
export function getAllModules(): ModuleManifest[] {
  return Array.from(manifests.values())
}

/**
 * Get a specific module manifest by ID.
 */
export function getModule(moduleId: string): ModuleManifest | undefined {
  return manifests.get(moduleId)
}

/**
 * Get enabled modules for an org.
 * `required` modules are always included.
 */
export async function getEnabledModules(orgId: string): Promise<ModuleManifest[]> {
  const orgModules = await dbAdmin.organisationModule.findMany({
    where: { orgId, enabled: true },
    select: { moduleId: true },
  })
  const enabledIds = new Set(orgModules.map((m) => m.moduleId))

  // Always include required modules
  const result: ModuleManifest[] = []
  for (const manifest of manifests.values()) {
    if (manifest.required || enabledIds.has(manifest.id)) {
      result.push(manifest)
    }
  }
  return result
}

/**
 * Resolve nav entries filtered by permission and enabled state.
 */
export function resolveNav(
  role: OrgRole,
  enabledModules: string[]
): NavEntry[] {
  const userPermissions = resolvePermissions(role, enabledModules)
  const entries: NavEntry[] = []

  for (const moduleId of enabledModules) {
    const manifest = manifests.get(moduleId)
    if (!manifest) continue
    for (const nav of manifest.nav) {
      if (!nav.permission || userPermissions.has(nav.permission)) {
        entries.push(nav)
      }
    }
  }
  return entries
}

/**
 * Enable a module for an org.
 * Validates dependsOn are enabled first, runs onEnable then seed.
 */
export async function enableModule(
  orgId: string,
  moduleId: string,
  ctx: ModuleContext
): Promise<void> {
  const manifest = manifests.get(moduleId)
  if (!manifest) {
    throw new Error(`Module not found: ${moduleId}`)
  }

  // Validate dependencies are enabled
  const orgModules = await dbAdmin.organisationModule.findMany({
    where: { orgId, enabled: true },
    select: { moduleId: true },
  })
  const enabledIds = new Set(orgModules.map((m) => m.moduleId))

  // Required modules are implicitly enabled
  for (const m of manifests.values()) {
    if (m.required) enabledIds.add(m.id)
  }

  for (const dep of manifest.dependsOn) {
    if (!enabledIds.has(dep)) {
      throw new Error(
        `Cannot enable '${moduleId}': dependency '${dep}' is not enabled`
      )
    }
  }

  // Upsert the module record
  await dbAdmin.organisationModule.upsert({
    where: { orgId_moduleId: { orgId, moduleId } },
    create: { orgId, moduleId, enabled: true },
    update: { enabled: true, enabledAt: new Date() },
  })

  // Run lifecycle hooks
  if (manifest.onEnable) {
    await manifest.onEnable(ctx)
  }
  if (manifest.seed) {
    await manifest.seed(ctx)
  }
}

/**
 * Disable a module for an org.
 * Refuses when another enabled module depends on it, or when it's required.
 * Never deletes data.
 */
export async function disableModule(
  orgId: string,
  moduleId: string,
  ctx: ModuleContext
): Promise<void> {
  const manifest = manifests.get(moduleId)
  if (!manifest) {
    throw new Error(`Module not found: ${moduleId}`)
  }

  if (manifest.required) {
    throw new Error(`Cannot disable required module: ${moduleId}`)
  }

  // Check no other enabled module depends on this one
  const orgModules = await dbAdmin.organisationModule.findMany({
    where: { orgId, enabled: true },
    select: { moduleId: true },
  })

  for (const om of orgModules) {
    const otherManifest = manifests.get(om.moduleId)
    if (otherManifest && otherManifest.dependsOn.includes(moduleId)) {
      throw new Error(
        `Cannot disable '${moduleId}': module '${om.moduleId}' depends on it`
      )
    }
  }

  // Run onDisable hook
  if (manifest.onDisable) {
    await manifest.onDisable(ctx)
  }

  // Mark as disabled
  await dbAdmin.organisationModule.update({
    where: { orgId_moduleId: { orgId, moduleId } },
    data: { enabled: false },
  })
}

/**
 * Module guard for use in route groups.
 * Calls notFound() when the module is disabled for the active org.
 */
export function moduleGuard(
  moduleId: string,
  enabledModules: string[]
): void {
  const manifest = manifests.get(moduleId)
  if (!manifest) {
    notFound()
  }
  // Required modules are always enabled
  if (manifest.required) {
    return
  }
  if (!enabledModules.includes(moduleId)) {
    notFound()
  }
}

/**
 * Reset the registry (for testing).
 */
export function _resetModules(): void {
  manifests.clear()
}
