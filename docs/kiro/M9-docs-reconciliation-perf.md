# kiro brief — M9: Docs reconciliation + performance audit

Two independent deliverables. Do them in order; each ends with its own gate.

---

## Part A — Docs reconciliation

The docs under `docs/` were written before the Supabase/RLS migration, the module kernel, and the Singapore statutory work landed. They now describe a system that doesn't quite exist. Bring them into agreement with the actual codebase — read the code, don't guess.

### A1. Four missing ADRs

Follow the exact format of `docs/architecture/decisions/ADR-015-deployment-model.md` (Status / Context / Decision / Alternatives Considered / Consequences / Risks / Revisit Conditions). Number them ADR-016 through ADR-019, add them to whatever index/README lists existing ADRs if one exists.

- **ADR-016 — Supabase Auth + Postgres RLS for tenant isolation.** Decision: every tenant-scoped query runs inside `dbAs()` (`src/core/db/client.ts`), which switches the Postgres session role and installs `request.jwt.claims` via `set_config` in a single round trip, then asserts `current_user = 'authenticated'` before running the callback — a silent role-switch failure throws `RlsScopeError` rather than running unscoped. RLS policies live in `prisma/migrations/*_rls_*`. `dbAdmin` bypasses RLS entirely and is confined to `src/core/**` by an ESLint boundary rule. Cover why cross-tenant isolation lives in Postgres itself rather than only in application code (defense in depth — a bug in a query builder can't leak another tenant's rows).
- **ADR-017 — Module kernel / manifest architecture.** Decision: each feature module (`src/modules/*/manifest.ts`) declares its own permissions, nav entries, and dashboard widgets via `defineModule`; the kernel (`src/core/modules/`) composes sidebar nav, permission checks, and dashboard widgets from whichever modules an org has enabled. Cover the "lego" premise — a module that isn't enabled must not appear in nav, must not be queryable, and must not render a dashboard widget.
- **ADR-018 — Singapore statutory data as versioned rate tables.** Decision: CPF contribution rates (`src/modules/payroll/rates/cpf-2026-01-01.ts`) and MOM leave entitlement rules (`src/core/leave/balances.ts`) are versioned, dated data files rather than inline constants, so a future rate change doesn't require touching calculation logic. Cover the PR-year-anniversary CPF quirk and the service-based annual leave accrual (7 days after 1 completed year, +1/year, capped at 14).
- **ADR-019 — Design system: token-only colour, no hardcoded hex in components.** Decision: every colour is a CSS custom property in `src/core/ui/tokens.css`, consumed via Tailwind's `@theme inline`; components never hardcode hex. Cover the brand gradient, the org-overridable `--accent-500`, and light/dark mode via `.dark` class + `prefers-color-scheme`.

### A2. Update existing docs against the real system

- `docs/product_brief.md` — reflect Supabase as the actual data layer, the module list actually built (employees, leave, attendance, onboarding, documents, payroll, dashboards — all seven, not aspirational ones), and the modular-org-assembly premise as implemented.
- `docs/diagrams/entity-relationship-diagram.md` — regenerate against the real `prisma/schema/*.prisma` files. Every model, every relation, every `@@map`'d table name.
- `docs/security/permissions-matrix.md` — regenerate against every `permission.key` declared across `src/modules/*/manifest.ts` and `src/core/**`. One row per permission, columns per role, sourced from `defaultRoles`, not invented.
- `docs/security/tenant-isolation.md` — describe the actual `dbAs()` mechanism (single round-trip claim installation, `RlsScopeError` on role-switch failure, the `SECURITY DEFINER` `user_org_ids()` helper that breaks policy recursion, the semaphore in front of the connection pooler).
- `docs/security/threat-model.md` — add entries for defects found and fixed during implementation review: RLS policies with no GRANTs (would have failed closed, not open, but still worth recording), the `organisation_memberships` self-referencing policy recursion, the camelCase/snake_case column mismatch that would have silently no-op'd every policy, the `activity-tab.tsx` authorization hole where a privileged audit read trusted a client-supplied `userId`/`orgId` prop instead of deriving identity from session. Add an **open item**: the database password was pasted in plaintext during an early session and has not yet been rotated — flag it as outstanding, do not attempt to rotate it yourself (no infrastructure credentials access).

### Gate for Part A
`tsc --noEmit` and `eslint` stay clean (docs changes shouldn't touch code, but if you touched anything to verify a claim, run this). No placeholder text, no "TBD" anywhere in the new/updated docs.

---

## Part B — Performance audit

The dashboard used to fail outright under load (connection pool exhaustion — 13 widgets each opening an interactive transaction). That's fixed: `dbAs()` now collapses 3 round trips into 1, and a semaphore caps concurrent transactions at 10. This part verifies the fix actually helped and finds what's next.

### B1. Measure, don't guess

Instrument and measure, against the local dev DB (or a local Postgres if that's more reliable than fighting the pooler):
- Cold and warm page-load timing for `/[orgSlug]/dashboard` (Owner role, Northstar Studios — the org with all widgets enabled), `/[orgSlug]/employees` (list of 12), `/[orgSlug]/payroll`.
- Count of concurrent Postgres connections/transactions opened during a single dashboard load — confirm it stays under the semaphore ceiling and under the pooler's actual limit.
- Any N+1 query pattern — check widget queries and the employees list for per-row queries that should be a single batched query.
- Bundle size for the dashboard route (`next build` output) — flag anything unexpectedly large (unused chart library code, barrel-import pulling in more than needed).

### B2. Write it up

New file: `docs/product/performance-report.md`. Structure: methodology (what you measured and how, so it's reproducible), current numbers, comparison against the pre-fix architecture (3 round trips per scoped query, no concurrency cap — describe the failure mode qualitatively since the pre-fix code is gone, don't fabricate old numbers), and a short prioritized list of further optimizations if you find real ones. Do not recommend speculative optimizations with no measured problem behind them.

### Gate for Part B
The report's numbers must come from an actual run you performed, not estimated. If a measurement tool isn't available in this environment, say so explicitly in the report rather than inventing a number.

---

## Before you finish

Run `npm test`, `tsc --noEmit`, `eslint .` — all clean. Commit with a message describing what changed, not "M9 work".
