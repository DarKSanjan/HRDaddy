# Tenant Isolation Design

This document describes how HR Daddy enforces multi-tenant data isolation as actually implemented. Every piece of organisation-owned data is inaccessible to users of other organisations, regardless of the access vector — UI, API, background jobs, file storage, or cache.

---

## 1. Architecture Overview

Tenant isolation is enforced at **two independent layers**:

1. **Application layer** — `requirePermission()` and org-context resolution from session.
2. **Database layer** — Postgres Row-Level Security (RLS) policies that reject cross-tenant queries even if the application layer is bypassed.

The database layer is the authoritative boundary. A bug in a query builder, a missing WHERE clause, or a forgotten `orgId` filter cannot leak another tenant's rows because Postgres itself enforces the restriction.

---

## 2. The `dbAs()` Mechanism

All tenant-scoped database access goes through `dbAs(userId, fn)` in `src/core/db/client.ts`.

### Single Round-Trip Claim Installation

`dbAs` opens a Prisma interactive transaction and executes a single SQL statement that:

1. Installs `request.jwt.claims` (JSON containing `sub` and `role`) via `set_config(..., true)` (session-local).
2. Switches the session role to `authenticated` via `set_config('role', 'authenticated', true)`.
3. Returns `current_user` for assertion.

```sql
SELECT
  set_config('request.jwt.claims', $1, true),
  set_config('role', 'authenticated', true),
  current_user AS current_role
```

This was previously three separate round trips; collapsing them into one reduced transaction hold time by ~60%.

### `RlsScopeError` on Role-Switch Failure

If `current_user` is not `'authenticated'` after the SET (e.g. a pooler error silently dropped the command), `dbAs` throws `RlsScopeError` immediately rather than executing the callback unscoped. This prevents a silent loss of tenant isolation — the failure mode is loud, not leaky.

```typescript
if (current_role !== 'authenticated') {
  throw new RlsScopeError(
    `Expected to run as 'authenticated' but session role is '${current_role}'. ` +
    `Refusing to execute — RLS would not be enforced.`
  )
}
```

### Semaphore-Based Concurrency Control

Interactive transactions hold a connection for their entire duration. The dashboard fans out ~13 widget queries concurrently. Without throttling, all 13 tried to acquire connections simultaneously and exceeded the pooler's 15-connection limit, causing `unable to start a transaction in the given time` failures.

The fix is a semaphore (`MAX_CONCURRENT_TX = 10`) that queues excess requests rather than failing them:

- Active transactions are capped at 10 (comfortably under the pooler's limit).
- Excess requests wait in a FIFO queue and proceed when a slot is released.
- Widgets stream in slightly staggered rather than half of them erroring.

### `dbAdmin` — Bypassing RLS

The raw Prisma client (`dbAdmin`) bypasses RLS entirely and is restricted to `src/core/**` by an ESLint boundary rule:

```javascript
// eslint.config.mjs
// src/modules/**, src/app/**, src/actions/** cannot import @/core/db/admin
```

Feature modules never have access to the unscoped client.

---

## 3. RLS Policies

All policies are defined in `prisma/migrations/00001_rls_policies/migration.sql` and `prisma/migrations/00002_rls_gaps/migration.sql`.

### The `user_org_ids()` Helper

A `SECURITY DEFINER` function that breaks infinite policy recursion:

```sql
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT org_id FROM organisation_memberships
  WHERE user_id = auth.uid()::text AND is_active
$$;
```

**Why SECURITY DEFINER:** A policy on `organisation_memberships` that SELECTs from `organisation_memberships` (to check "is the user a member of this org?") causes infinite recursion. Running the lookup as the function owner (exempt from RLS) breaks the cycle.

Access is restricted: `REVOKE ALL` from public/anon, `GRANT EXECUTE` only to `authenticated`.

### Standard Tenant Policy

Every org-owned table has:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <table>
  USING (org_id IN (SELECT public.user_org_ids()));
```

Tables covered: `organisation_settings`, `organisation_modules`, `organisation_memberships`, `invitations`, `employees`, `departments`, `job_titles`, `work_locations`, `employment_types`, `leave_types`, `leave_policies`, `leave_balances`, `leave_requests`, `attendance_records`, `onboarding_templates`, `employee_onboardings`, `employee_onboarding_tasks`, `document_categories`, `employee_documents`, `payroll_periods`, `payroll_records`, `payroll_line_items`, `notifications`, `audit_logs`.

### Special Policies

| Table | Policy | Reason |
|-------|--------|--------|
| `organisations` | `id IN (SELECT user_org_ids())` | Keyed by `id`, not `org_id` |
| `users` | `self_or_colleague` | Can see self, or anyone sharing an org |
| `org_setup_progress` | `user_id = auth.uid()` | Exists before any org; private to user |
| `organisation_memberships` | `user_id = auth.uid() OR org_id IN (...)` | User can see own membership or org's memberships |
| `onboarding_template_tasks` | Scoped through parent template's `org_id` | No direct `org_id` column |

### Audit Log — Append Only

```sql
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
```

The audit log cannot be modified or deleted through the `authenticated` role, even by application code running through `dbAs`.

### Grants

RLS narrows which rows a role sees; it grants nothing. Without explicit `GRANT` statements, every `dbAs` query fails with `permission denied`. The migration grants `SELECT, INSERT, UPDATE, DELETE` on all public tables to `authenticated`, with default privileges for future tables.

---

## 4. Storage Isolation

Employee documents are stored in Supabase Storage's `employee-documents` bucket. Object keys follow the pattern `org/{orgId}/employee/{employeeId}/{uuid}`.

Storage policies scope access by path segment:

```sql
CREATE POLICY employee_documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
  );
```

The storage adapter uses the caller's session (not a service-role key), ensuring these policies are always evaluated.

---

## 5. Additional Protections (Migration 00002)

- **`onboarding_template_tasks`** — RLS added; scoped through parent template join.
- **`_prisma_migrations`** — `REVOKE ALL` from `anon` and `authenticated`; migration history is not accessible to application roles.
- **`handle_new_user()` function** — direct RPC access revoked from `public/anon/authenticated`; only callable as a trigger.
- **`user_org_ids()` access** — tightened to `authenticated` role only.

---

## 6. Organisation Context Resolution

Organisation context is derived from the authenticated Supabase session:

1. User authenticates → Supabase session established.
2. Middleware resolves `orgSlug` from the URL path and validates active `OrganisationMembership`.
3. `userId` from session + `orgId` from validated membership form the scope for `dbAs()`.

The session's `userId` is the sole identity input to `dbAs()`. Even if a request body or URL contains an `orgId`, it is only used for validation/assertion — the database-layer isolation depends only on the claims installed by `dbAs()` matching the user's actual memberships (as evaluated by `user_org_ids()`).

---

## 7. Failure Modes

| Scenario | Behaviour |
|----------|-----------|
| Role switch silently fails | `RlsScopeError` thrown; query never executes |
| `user_org_ids()` function dropped | All policies fail **closed** (deny all) |
| Connection pool exhausted | Semaphore queues requests; widgets stagger rather than error |
| Membership revoked mid-session | Next `dbAs()` call returns zero rows (RLS filters based on current membership state) |
| `dbAdmin` used outside `src/core/` | ESLint build error; CI fails |
