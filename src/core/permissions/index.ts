/**
 * Permissions registry — populated by module manifests, not hardcoded.
 * A permission belonging to a disabled module must never resolve as granted.
 */
import type { OrgRole } from '@prisma/client'

export interface PermissionDef {
  key: string
  description: string
  defaultRoles: OrgRole[]
  sensitive?: boolean
}

// Internal registry: moduleId → permissions
const registry = new Map<string, PermissionDef[]>()

/**
 * Register permissions for a module.
 */
export function registerPermissions(
  moduleId: string,
  defs: PermissionDef[]
): void {
  registry.set(moduleId, defs)
}

/**
 * Resolve the full set of permission keys granted to a role,
 * considering only enabled modules.
 */
export function resolvePermissions(
  role: OrgRole,
  enabledModules: string[]
): Set<string> {
  const granted = new Set<string>()
  for (const moduleId of enabledModules) {
    const defs = registry.get(moduleId)
    if (!defs) continue
    for (const def of defs) {
      if (def.defaultRoles.includes(role)) {
        granted.add(def.key)
      }
    }
  }
  return granted
}

/**
 * Check if a role has a specific permission, given the org's enabled modules.
 * A permission belonging to a disabled module is NEVER granted — even for OWNER.
 */
export function hasPermission(
  role: OrgRole,
  enabledModules: string[],
  key: string
): boolean {
  return resolvePermissions(role, enabledModules).has(key)
}

/**
 * Get all registered permission definitions (for admin/debug).
 */
export function getAllPermissions(): Map<string, PermissionDef[]> {
  return new Map(registry)
}

/**
 * Reset the registry (for testing).
 */
export function _resetPermissions(): void {
  registry.clear()
}
