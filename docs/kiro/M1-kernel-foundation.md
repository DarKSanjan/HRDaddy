# kiro brief — M1: Kernel Foundation

You are implementing the kernel of HR Daddy, an open-source modular HRMS for SMEs.

**Read first:** `docs/superpowers/specs/2026-07-25-hrdaddy-design.md` — it is the authoritative design. This brief scopes M1 only.

This milestone is **plumbing only**. No feature UI, no pages beyond what is listed. The design system and app shell are M1b, a separate task. Do not build them here.

---

## Hard rules

1. **This is Next.js 16.2, not the Next.js in your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before writing any code that touches a framework API. Specifically: `01-app/01-getting-started/16-proxy.md`, `01-app/02-guides/authentication.md`, `01-app/02-guides/upgrading/version-16.md`. Key differences: the middleware convention is now `proxy.ts`, route `params` and `searchParams` are Promises and must be awaited, `cookies()` and `headers()` are async, Turbopack is the default bundler.
2. **Prisma 7** with multi-file schemas. `@prisma/adapter-pg` is already wired.
3. **All money is `Int` cents.** No `Float`, no `Decimal` for money, ever. `Decimal` is permitted only for leave day counts.
4. **Every tenant-owned table has `orgId` and an RLS policy.** No exceptions.
5. **Do not invent scope.** If something is not in this brief, do not build it. Leave a `TODO(M<n>)` comment instead.
6. TypeScript strict. Everything must pass `npx tsc --noEmit` and `npx eslint`.

---

## 1. Dependencies

Add: `@supabase/supabase-js`, `@supabase/ssr`, `date-fns`, `@date-fns/tz`.
Remove: `bcryptjs`, `@types/bcryptjs` — Supabase Auth owns password handling now.

---

## 2. Schema — split into multi-file

Convert `prisma/schema.prisma` into `prisma/schema/` with one file per domain, and update `prisma.config.ts` to point `schema` at the directory.

```
prisma/schema/
  _base.prisma        # generator, datasource, shared enums
  identity.prisma     # User, OrganisationMembership, Invitation
  organisation.prisma # Organisation, OrganisationSettings, OrganisationModule, OrgSetupProgress
  employees.prisma    # Employee, Department, JobTitle, WorkLocation, EmploymentType
  leave.prisma        # unchanged models, moved
  attendance.prisma
  onboarding.prisma
  documents.prisma
  payroll.prisma
  audit.prisma        # AuditLog, Notification
```

**Model changes required:**

- `User.id` becomes the Supabase `auth.users` UUID. Drop `passwordHash` entirely — Supabase owns credentials. Keep `email`, `name`, `isActive`, timestamps.
- **New** `OrganisationModule`: `id`, `orgId`, `moduleId String`, `enabled Boolean @default(true)`, `settings Json @default("{}")`, `enabledAt`, `@@unique([orgId, moduleId])`, `@@index([orgId])`.
- **New** `OrgSetupProgress`: `id`, `userId`, `step Int`, `data Json`, `createdAt`, `updatedAt`, `@@unique([userId])`. Holds in-flight wizard state before an organisation exists.
- **Money correction:** every monetary field becomes `Int` (cents) with a name ending in `Cents` — `Employee.compensationAmount` → `compensationAmountCents`, `PayrollRecord.grossAmount` → `grossAmountCents`, `netAmount` → `netAmountCents`, `PayrollLineItem.amount` → `amountCents`.
- `Employee.nationalId` and `Employee.dateOfBirth` are sensitive; add a `/// @sensitive` doc comment on each so the permission layer can key off it later.

---

## 3. Database clients — `src/core/db/`

Two clients, and the distinction is a security boundary, not a convenience.

```ts
// src/core/db/admin.ts
// Service-role client. Bypasses RLS. Import restricted to src/core/** by ESLint.
export const dbAdmin: PrismaClient

// src/core/db/client.ts
// RLS-scoped. Opens a transaction, sets the JWT claims so Postgres RLS applies,
// runs the callback inside it.
export async function dbAs<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T>
```

`dbAs` must issue `SET LOCAL request.jwt.claims = '{"sub":"<userId>","role":"authenticated"}'` and `SET LOCAL ROLE authenticated` as the first statements inside the transaction, so every subsequent query is evaluated under RLS.

`dbAdmin` is legitimate in exactly three places: the signup transaction before a membership exists, background jobs, and migrations. Everything else uses `dbAs`.

---

## 4. Auth — `src/core/auth/`

Delete `src/lib/auth.ts` and `src/actions/auth.ts`. The hand-rolled HMAC session is replaced entirely by Supabase Auth.

Build:
- `supabase-server.ts` — server client via `@supabase/ssr` with cookie handling (remember `cookies()` is async in Next 16).
- `supabase-browser.ts` — browser client.
- `dal.ts` — the data access layer. All of these are `cache()`-wrapped per request:
  - `verifySession(): Promise<{ userId, email, name }>` — redirects to `/sign-in` when absent.
  - `getOrgContext(slug): Promise<{ org, membership, enabledModules }>` — resolves the org **and** validates the caller's active membership in one step. Returns `notFound()` when the org does not exist *or* the caller is not a member — these must be indistinguishable to the caller, to avoid leaking which org slugs exist.
  - `requirePermission(orgId, key)` — throws `PermissionDeniedError` when the caller lacks it.
- A database trigger migration mirroring `auth.users` inserts into `public.users`.

**Never** trust an org identifier from the request body or query string without resolving it through `getOrgContext`.

Replace `src/proxy.ts`. The current implementation has a real vulnerability at line 16 — `pathname.includes('.')` lets any path containing a dot skip the auth check. The replacement must match on an explicit static-asset prefix allowlist, never on the presence of a dot.

---

## 5. Permissions — `src/core/permissions/`

The registry is populated by module manifests rather than a hardcoded map.

```ts
export interface PermissionDef {
  key: string                  // e.g. 'leave.request.approve'
  description: string
  defaultRoles: OrgRole[]
  sensitive?: boolean
}

export function registerPermissions(moduleId: string, defs: PermissionDef[]): void
export function resolvePermissions(role: OrgRole, enabledModules: string[]): Set<string>
export function hasPermission(role: OrgRole, enabledModules: string[], key: string): boolean
```

A permission belonging to a disabled module must never resolve as granted, regardless of role — including for OWNER.

Port the existing keys from `src/lib/permissions.ts` into the `employees` module manifest, then delete that file.

---

## 6. Module registry — `src/core/modules/`

This is the heart of the milestone. Get the contract right; the rest of the product is built on it.

```ts
export interface ModuleManifest {
  id: string
  name: string
  version: string
  description: string
  dependsOn: string[]
  required?: boolean              // true for 'employees' — cannot be disabled
  permissions: PermissionDef[]
  nav: NavEntry[]
  settings?: ZodSchema
  widgets?: WidgetDef[]
  events?: { emits: string[]; on?: Record<string, EventHandler> }
  seed?: (ctx: ModuleContext) => Promise<void>
  onEnable?: (ctx: ModuleContext) => Promise<void>
  onDisable?: (ctx: ModuleContext) => Promise<void>
}

export function defineModule(m: ModuleManifest): ModuleManifest
```

Registry responsibilities:
- `getAllModules()` — every manifest known to the build.
- `getEnabledModules(orgId)` — those enabled for an org, with `required` modules always included.
- `resolveNav(role, enabledModules)` — nav entries filtered by permission and enabled state.
- `enableModule(orgId, moduleId)` — validates `dependsOn` are enabled first, runs `onEnable` then `seed`, in a transaction.
- `disableModule(orgId, moduleId)` — refuses when another enabled module depends on it, refuses when `required`, runs `onDisable`. **Never deletes data.**
- `moduleGuard(moduleId)` — for use in route groups. Calls `notFound()` when the module is disabled for the active org. A disabled module must be indistinguishable from one that was never installed.

Ship exactly one manifest in this milestone: `src/modules/employees/manifest.ts`, marked `required: true`, carrying the employee/department permission keys ported from the old permissions file. Its routes and UI are M3 — the manifest alone is enough to prove the registry works.

---

## 7. Events, audit, storage, notifications

**`src/core/events/`** — synchronous in-process bus. `emit(event, payload, ctx)` and `on(eventName, handler)`. Handlers must be idempotent. A throwing handler must be logged and must not roll back the emitting transaction.

**`src/core/audit/`** — `writeAudit({ orgId, actorId, action, targetType, targetId, before?, after?, metadata? })`. Append-only: the service exposes no update or delete path. Include a migration that `REVOKE`s `UPDATE, DELETE` on `audit_logs` from the `authenticated` role.

**`src/core/storage/`** — interface `StorageAdapter` with `upload`, `getSignedUrl(key, expiresInSeconds)`, `delete`, `exists`. Supabase Storage implementation against a private `employee-documents` bucket. Object keys follow `org/{orgId}/employee/{employeeId}/{uuid}`. Signed URLs default to 60 seconds. No object is ever public.

**`src/core/notifications/`** — interface only in this milestone: `NotificationAdapter.send(...)`, plus an in-app implementation writing to the `Notification` table. Email is a later swap; define the seam, do not build the sender.

---

## 8. RLS migration

Write a SQL migration that, for every tenant-owned table:

```sql
alter table <t> enable row level security;
create policy tenant_isolation on <t>
  using (org_id in (
    select org_id from organisation_memberships
    where user_id = auth.uid() and is_active
  ));
```

Then add a test — `src/core/db/__tests__/rls-coverage.test.ts` — that queries `pg_tables` and `pg_policies` and **fails** if any table carrying an `org_id` column lacks a policy. This test is the safety net that stops future tables from shipping unprotected.

---

## 9. ESLint boundaries

Add rules to `eslint.config.mjs`:
- `src/core/**` may not import from `src/modules/**` — the kernel must not know its modules.
- `src/core/db/admin` may not be imported outside `src/core/**` — the RLS bypass stays in the kernel.

These must be enforced by the linter, not by convention.

---

## 10. Tests

Vitest, colocated in `__tests__`:
- Permission resolution, including the disabled-module case for OWNER.
- Module dependency resolution: enabling with an unmet dependency fails; disabling a depended-upon module fails; disabling a `required` module fails.
- `dbAs` issues the claim-setting statements before any query.
- Event bus: handlers fire, a throwing handler does not break the emitter.
- Audit service exposes no mutation path.
- The RLS coverage test from §8.

---

## Non-goals for this milestone

No design system, no app shell, no sidebar, no dashboard, no signup wizard, no employee UI, no leave/attendance/payroll code. Those are later milestones with their own briefs. Sign-in and sign-up pages may remain visually unstyled — they are rebuilt in M1b.

---

## Definition of done

- `npx tsc --noEmit` clean
- `npx eslint` clean, including the new boundary rules
- `npx vitest run` green
- `npx prisma validate` passes against the split schema
- `src/lib/auth.ts`, `src/actions/auth.ts`, `src/lib/permissions.ts`, `src/lib/dal.ts` deleted, with their responsibilities living under `src/core/`
- No remaining import of `bcryptjs`
