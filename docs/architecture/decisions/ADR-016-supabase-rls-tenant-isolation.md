# ADR-016: Supabase Auth + Postgres RLS for Tenant Isolation

**Status:** Accepted

## Context

HR Daddy is multi-tenant. Every organisation's data lives in the same Postgres database; cross-tenant isolation is a hard security requirement — a query-builder bug, a missing WHERE clause, or a forgotten `orgId` filter must never leak another tenant's rows.

Application-layer-only scoping (adding `WHERE org_id = ?` to every query) is insufficient as a sole defence: one overlooked query or one ORM escape hatch defeats it. We needed a mechanism that enforces isolation even when the application code is wrong.

## Decision

Every tenant-scoped query runs inside `dbAs(userId, fn)` (`src/core/db/client.ts`), which opens a Prisma interactive transaction and, in a single SQL round trip, does all of the following:

1. Installs `request.jwt.claims` (containing the caller's `sub` and `role`) via `set_config('request.jwt.claims', ..., true)`.
2. Switches the session role to `authenticated` via `set_config('role', 'authenticated', true)`.
3. Asserts `current_user = 'authenticated'` before returning control to the callback — if the assertion fails (e.g. a pooler error silently dropped the SET), `dbAs` throws `RlsScopeError` rather than running unscoped.

Row-level security policies (`prisma/migrations/00001_rls_policies/migration.sql`) on every table enforce `org_id IN (SELECT public.user_org_ids())`. The `user_org_ids()` function is `SECURITY DEFINER`, which breaks infinite policy recursion on the `organisation_memberships` table that would otherwise occur when a policy SELECTs from the same table it guards.

A semaphore (`MAX_CONCURRENT_TX = 10`) in front of the connection pooler prevents interactive-transaction exhaustion that previously caused dashboard loads to fail under concurrency.

`dbAdmin` (the raw Prisma client, bypassing RLS) is confined to `src/core/**` by an ESLint boundary rule, so feature modules cannot accidentally use it.

## Alternatives Considered

- **Application-code-only scoping** — simpler but a single missed filter leaks data. No defence in depth.
- **Schema-per-tenant** — strong isolation but operational nightmare for migrations across hundreds of schemas.
- **Separate database per tenant** — strongest isolation but extreme cost/complexity at scale; incompatible with the shared-DB deployment model.
- **Postgres role-per-tenant** — sound in theory but operationally complex with connection pooling; Supabase Auth already provides the claims injection mechanism.

## Consequences

- A bug in a query builder or a forgotten filter cannot leak another tenant's rows — Postgres itself rejects the read.
- Every scoped query pays the cost of an interactive transaction (connection held for duration); the semaphore bounds this cost.
- Feature module developers never need to think about tenant scoping; `dbAs` handles it transparently.
- Audit log table is additionally protected: `REVOKE UPDATE, DELETE FROM authenticated` enforces append-only semantics at the database layer.
- Storage (Supabase Storage) is scoped by path segment (`org/{orgId}/...`) via storage policies, independent of application code.

## Risks

- Interactive transactions hold connections longer than simple queries; under extreme concurrency the semaphore introduces latency (widgets stream in staggered rather than failing).
- A Prisma version upgrade that changes transaction semantics could silently break the role-switch pattern. Mitigated by the `current_user` assertion.
- If the `user_org_ids()` function is inadvertently dropped or altered, all RLS policies fail closed (deny all), not open.

## Revisit Conditions

- If the application moves to a multi-database or schema-per-tenant model.
- If Prisma introduces native RLS support that makes the manual `set_config` pattern unnecessary.
- If connection-pool exhaustion resurfaces under production load profiles.
