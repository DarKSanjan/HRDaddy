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
  children?: NavEntry[]
}

export interface WidgetDef {
  id: string
  title: string
  description?: string
  permission?: string
  roles: ('owner' | 'manager' | 'employee')[]
  size: 'sm' | 'md' | 'lg'
  priority: number
  component: unknown // React component, typed loosely to avoid circular deps
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
  /**
   * Permission-key prefixes this module owns. Defaults to [id].
   * A module may legitimately own more than one domain — `employees` owns both
   * `employee.*` and `department.*` — so ownership is declared rather than
   * inferred from the id. Declaring it lets the registry reject keys a module
   * has no business defining, and catch two modules claiming the same key.
   */
  permissionNamespaces?: string[]
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
  const namespaces = m.permissionNamespaces ?? [m.id]

  for (const def of m.permissions) {
    if (!namespaces.some((ns) => def.key.startsWith(`${ns}.`))) {
      throw new Error(
        `Module "${m.id}" declares permission "${def.key}", which is outside ` +
          `its namespaces (${namespaces.join(', ')}). Either correct the key or ` +
          `add the namespace to permissionNamespaces.`
      )
    }
  }

  // Two modules owning the same key would make authorisation depend on import
  // order — whichever registered last would silently win.
  for (const [otherId, other] of manifests) {
    if (otherId === m.id) continue
    for (const def of m.permissions) {
      if (other.permissions.some((p) => p.key === def.key)) {
        throw new Error(
          `Modules "${m.id}" and "${otherId}" both declare permission "${def.key}".`
        )
      }
    }
  }

  manifests.set(m.id, m)
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
 * IDs of modules marked `required: true` — always enabled regardless of
 * an org's organisation_module rows. Callers that compute an org's enabled
 * module list directly from the DB (rather than via getEnabledModules())
 * must union this in, or a required module added after an org already
 * exists — with no organisation_module row for it — silently loses every
 * permission it declares (resolvePermissions only grants from enabledModules).
 */
export function getRequiredModuleIds(): string[] {
  return Array.from(manifests.values())
    .filter((m) => m.required)
    .map((m) => m.id)
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
 * Iterates the registry (Map insertion order = import order in register.ts)
 * so sidebar ordering is deterministic and controlled by register.ts,
 * regardless of the order enabledModules arrives in from the DB.
 */
export function resolveNav(
  role: OrgRole,
  enabledModules: string[]
): NavEntry[] {
  const enabledSet = new Set(enabledModules)
  const userPermissions = resolvePermissions(role, enabledModules)
  const entries: NavEntry[] = []

  for (const manifest of manifests.values()) {
    if (!enabledSet.has(manifest.id)) continue
    for (const nav of manifest.nav) {
      if (!nav.permission || userPermissions.has(nav.permission)) {
        const children = nav.children
          ?.filter((child) => !child.permission || userPermissions.has(child.permission))
        entries.push(children && children.length > 0 ? { ...nav, children } : { ...nav, children: undefined })
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
