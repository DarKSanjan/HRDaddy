# ADR-017: Module Kernel / Manifest Architecture

**Status:** Accepted

## Context

HR Daddy serves diverse SMBs. Not every organisation needs every feature from day one — a 5-person startup does not need payroll processing, and a company that already uses an external attendance system should not see attendance nav entries or dashboard widgets. Features must be composable: enable what you need, disable what you don't, with no dead UI, no unused permission grants, and no ghost queries.

## Decision

Each feature module (`src/modules/*/manifest.ts`) declares a `ModuleManifest` via `defineModule()` containing:

- **id, name, version, description** — identity.
- **dependsOn** — other module IDs that must be enabled first (enables topological ordering).
- **required** — if `true`, the module is always enabled and cannot be disabled (e.g. `employees`).
- **permissionNamespaces** — key prefixes this module owns; the registry rejects keys outside declared namespaces and detects cross-module collisions.
- **permissions** — `PermissionDef[]` registered at import time.
- **nav** — sidebar entries, each optionally gated by a permission key.
- **widgets** — dashboard widget definitions with role filtering, permission gating, size, and priority.
- **events** — declared emitted events and handlers for cross-module communication.
- **seed / onEnable / onDisable** — lifecycle hooks run when a module is toggled.

The kernel (`src/core/modules/index.ts`) composes the runtime:

- `getEnabledModules(orgId)` queries `organisation_modules` and unions `required` modules.
- `resolveNav(role, enabledModules)` filters nav entries by permission.
- `resolveWidgets(role, enabledModules)` (in `src/core/dashboard/index.ts`) filters dashboard widgets by enabled state, role, and permission.
- `moduleGuard(moduleId, enabledModules)` calls `notFound()` in route groups when a module is disabled.
- `enableModule / disableModule` validate dependency graphs and run lifecycle hooks.

The "lego" premise: **a module that isn't enabled must not appear in nav, must not be queryable, and must not render a dashboard widget.** This is enforced at three layers:
1. Nav resolution skips disabled modules.
2. Route-group layouts call `moduleGuard` before rendering.
3. Widget resolution filters by `enabledModules` set membership.

## Alternatives Considered

- **Feature flags (boolean config)** — simpler but no dependency validation, no lifecycle hooks, no runtime permission isolation.
- **Micro-frontends** — strong isolation but extreme complexity for a monorepo Next.js app; incompatible with shared-layout SSR.
- **Plugin system with dynamic imports** — runtime flexibility but poor type safety, no static analysis of permission collisions, harder to test.

## Consequences

- Adding a new module is a single file (`manifest.ts`) plus the module's own components/actions; no changes to the kernel.
- Permission namespace enforcement catches collisions at startup (import time), not at runtime in production.
- Disabling a module never deletes data — it only hides UI and blocks queries.
- Module ordering in `src/modules/register.ts` is the import-time side-effect sequence; re-ordering could theoretically matter for event handlers.

## Risks

- Import-time side effects are unusual in modern JS; tree-shaking tools might try to eliminate "unused" imports. Mitigated by the explicit barrel (`register.ts`).
- A circular dependency between two manifests would cause a runtime import error. Mitigated by the `dependsOn` DAG validation.

## Revisit Conditions

- If module count exceeds ~20 and import-time registration becomes a cold-start bottleneck.
- If third-party/community modules require sandboxing beyond namespace enforcement.
- If server-component streaming requires lazy module resolution instead of eager registration.
