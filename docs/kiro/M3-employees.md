# kiro brief — M3: Employees module

The first real feature module, and the proof that the kernel works. Everything after this follows its shape.

**Read first:** `docs/superpowers/specs/2026-07-25-hrdaddy-design.md`, `docs/security/permissions-matrix.md`, `src/modules/employees/manifest.ts`.

**Next.js 16.2** — consult `node_modules/next/dist/docs/`. `params`/`searchParams` are Promises.

---

## Rules that apply to every module from here on

1. **All tenant reads and writes go through `dbAs(userId, tx => …)`** from `src/core/db`. Never `dbAdmin` in feature code — an ESLint rule enforces this.
2. **Every mutation calls `requirePermission(orgId, key)`** before touching data. Server-side, always. A hidden button is not access control.
3. **Every mutation writes an audit event** via `src/core/audit`.
4. **Never trust an org id from the client.** Resolve it with `getOrgContext(slug)`.
5. **Money is `Int` cents.** Format for display only at the edge.
6. Routes live under `src/app/(dashboard)/[orgSlug]/employees/` and are wrapped in `moduleGuard('employees')`.
7. UI uses `src/core/ui` primitives and tokens. No emoji, no hardcoded colours. Laptop-first at 1440×900.

---

## Scope

### Directory — `/[orgSlug]/employees`
Table: name (with avatar), job title, department, manager, employment status, start date. Server-side search across name/email/job title. Filters for department, status, employment type, location. Sortable columns, pagination, URL-persisted state so a filtered view is shareable. Row click opens the profile. Bulk selection with export to CSV.

Empty state distinguishes **no employees yet** (offer "Add employee") from **no results for these filters** (offer "Clear filters"). They are different situations and must not share one message.

### Profile — `/[orgSlug]/employees/[employeeId]`
Header with avatar, name, title, department, status badge, and actions. Tabs: Personal, Employment, Documents (placeholder until M6), Leave (placeholder until M4), Activity.

**Sensitive fields.** `dateOfBirth`, `nationalId`, `address`, `personalEmail`, `phone` and compensation are visible only to the employee themselves and to `employee.view_all` holders. A manager viewing a report sees employment data but **not** these. Enforce on the server by omitting them from the query — never fetch-then-hide, because the data still reaches the client.

### Create and edit
`/[orgSlug]/employees/new`, and inline edit on the profile. An employee may exist **with or without a login account** — that distinction is core. Creating with "invite to portal" checked also creates an `Invitation`; without it, a record-only employee. Zod validation server-side. Work email unique per organisation.

### Lifecycle
Activate, suspend, deactivate, archive. Transitions follow `docs/diagrams/state-machines.md`. Deactivating requires a reason, writes an audit event, and must handle direct reports — block, or require reassignment, and say which.

### Org structure — `/[orgSlug]/settings/organisation`
CRUD for departments, job titles, work locations, employment types. Department manager assignment. Archiving a department in use must not orphan employees: require reassignment first.

### Reporting lines
Assign a manager. **Reject cycles** — A reports to B reports to A, at any depth. Test this explicitly. Removing a manager requires deciding what happens to reports.

---

## Tests

Unit: sensitive-field visibility per role; cycle rejection in reporting lines; status transition validity; search and filter query building.

Integration (`RUN_DB_TESTS=1`, following `src/core/org-setup/__tests__/commit.integration.test.ts`): cross-tenant read returns nothing; a manager cannot read another team's sensitive fields; audit rows written on create/update/deactivate; employee-without-account creates no user row.

E2E: HR adds an employee → appears in directory → open profile → edit → change reflected after reload.

---

## Definition of done

`tsc --noEmit`, `eslint`, `vitest run` clean. Directory, profile, create, edit, lifecycle and org structure all work against the live database. Cross-tenant access rejected. Verified in a browser at 1440×900 in both themes with zero console errors.
