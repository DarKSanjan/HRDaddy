# HR Daddy — Architecture & V1 Design

**Date:** 2026-07-25
**Status:** Approved
**Supersedes:** the implicit architecture in the pre-existing scaffold (hand-rolled session auth, single-tier Prisma access, unbranded shadcn defaults)

---

## 1. Context

HR Daddy is an open-source, self-hostable, modular HRMS for small and medium businesses. The vision is a system that assembles itself out of interchangeable parts — each organisation switches on the pieces it needs and the product reshapes around that choice.

The repository already contains a large planning corpus (43 documents, ~28,000 lines) covering use cases, business rules, permissions, threat modelling, and a 68-task roadmap. That corpus is sound and is retained. It has four gaps this document closes:

1. **No module system.** The "lego" premise — the product's central differentiator — appears nowhere in the docs or the code.
2. **No Supabase.** The planning assumed plain Postgres with hand-rolled auth.
3. **No jurisdiction.** HR is jurisdiction-bound; the docs are country-agnostic, which makes statutory leave and payroll unimplementable.
4. **No design system.** The UI is stock shadcn slate with hardcoded greys bypassing its own tokens.

### Problems in the existing scaffold

| Location | Problem |
|---|---|
| `src/lib/auth.ts` | Hand-rolled HMAC cookie session. No rotation, no revocation, no expiry claim in the payload. Its own comment says to replace it before production. |
| `src/proxy.ts:16` | `pathname.includes('.')` short-circuits the auth check, so any path containing a dot bypasses it. |
| `src/actions/auth.ts:100` | Signup creates user + organisation + OWNER membership from one form, with no email verification and no organisation configuration. |
| `prisma/schema.prisma` | Payroll amounts are `Int`, leave is `Decimal`, compensation is `Int` — money handling is inconsistent across the schema. |
| `src/components/sidebar.tsx` | `bg-gray-50` and hardcoded `text-gray-*` bypass the theme tokens defined in `globals.css`. |

Auth and UI are replaced. The Prisma models and the permission-key concept survive as a starting point.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Supabase full stack — Auth, Postgres with RLS, Storage | Supabase is Apache-2.0 and self-hostable, so this preserves the open-source and self-host promises. Auth gives email verification, password reset, MFA and later SSO for free; each of those is a security liability if hand-built. RLS gives DB-level tenant isolation. |
| D2 | Module registry inside the monolith, with a manifest contract | Real lego — navigation, permissions, settings and dashboards assemble from manifests. Ships as one deploy. The contract is designed so modules can later become npm packages without a rewrite. |
| D3 | Verified, resumable 5-step signup wizard | An organisation is a configured entity, not a name in a text box. Module selection during setup is where the product explains itself. |
| D4 | Singapore as the V1 jurisdiction | Statutory correctness requires picking one. Country config is a module, so others follow the same shape. |
| D5 | Payroll with statutory CPF calculation | Chosen deliberately over records-only, with the legal risk acknowledged. Mitigated by versioned rate fixtures, official worked-example tests, and an explicit disclaimer. |
| D6 | Linear/Vercel visual language | Dense, sharp, restrained. Suits HR's data tables, and makes the gradient logo land precisely because nothing else competes with it. |
| D7 | Supabase project + Vercel deploy | Live URL for review at any point. `docker-compose` self-hosting stays working. |
| D8 | kiro-cli writes code; Claude specs, verifies, and corrects | Batched per milestone to conserve credits. |

### Infrastructure

- **Supabase project:** `hrdaddy` — ref `mtzkhisddplixfabycud`, region `ap-southeast-1`, $0/month
- **URL:** `https://mtzkhisddplixfabycud.supabase.co`
- **Publishable key:** `sb_publishable_ThnRcGjQQ5oE59JL2ZqmYg_yn0GVmBp`
- **Vercel team:** `sanjans-projects-a064ebb4`

---

## 3. Architecture

### 3.1 Kernel and modules

```
src/
  core/                      # the kernel — modules depend on this, never the reverse
    auth/                    # Supabase Auth integration, session, DAL
    tenancy/                 # org context resolution, membership validation
    permissions/             # registry; modules contribute keys
    modules/                 # defineModule, registry, loader, guards
    events/                  # in-process event bus
    audit/                   # append-only audit writer
    storage/                 # Supabase Storage adapter
    notifications/           # in-app + email adapter
    db/
      admin.ts               # service-role client — import-restricted to core
      client.ts              # dbAs(user) — RLS-scoped
    ui/                      # app shell, design system primitives
  modules/
    employees/               # core module, always enabled
    leave/
    attendance/
    onboarding/
    documents/
    payroll/
    sg-compliance/
prisma/
  schema/
    _core.prisma
    employees.prisma
    leave.prisma
    ...                      # one file per module (Prisma 7 multi-file schemas)
```

**Dependency rule:** `modules/*` may import from `core/*`. `core/*` may never import from `modules/*`. Modules reach each other only through declared `dependsOn` and the event bus. Enforced by an ESLint boundary rule, not convention.

### 3.2 The manifest contract

```ts
export default defineModule({
  id: 'leave',
  name: 'Leave',
  version: '1.0.0',
  description: 'Leave types, balances, requests and approvals',
  dependsOn: ['employees'],

  permissions: [
    { key: 'leave.request.create', description: '...', defaultRoles: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'OWNER'] },
    { key: 'leave.request.approve', description: '...', defaultRoles: ['MANAGER', 'HR_ADMIN', 'OWNER'] },
  ],

  nav: [
    { label: 'Leave', href: '/leave', icon: 'CalendarDays', permission: 'leave.request.create', badge: 'pendingCount' },
  ],

  settings: z.object({
    leaveYearStart: z.string(),
    allowNegativeBalance: z.boolean().default(false),
    approvalChain: z.enum(['manager', 'hr', 'both']).default('manager'),
  }),

  widgets: [
    { id: 'pending-leave', permission: 'leave.request.approve', component: PendingLeaveWidget },
  ],

  events: {
    emits: ['LeaveRequested', 'LeaveApproved', 'LeaveRejected'],
    on: { EmployeeDeactivated: cancelPendingRequests },
  },

  seed: async (ctx) => { /* create default leave types for ctx.org.country */ },
  onEnable: async (ctx) => {},
  onDisable: async (ctx) => {},  // must be non-destructive — data is retained
})
```

**What the kernel derives from manifests:**
- Sidebar navigation, filtered by the viewer's permissions and the org's enabled modules
- The complete permission key registry
- The Settings page — each module's settings form renders from its Zod schema
- Dashboard composition — widgets from enabled modules only
- Event subscriptions

`organisation_modules (org_id, module_id, enabled, settings jsonb, enabled_at)` holds per-org state.

**Route guarding.** Module routes physically exist in the bundle. A `moduleGuard(moduleId)` in each module's route group returns 404 when the module is disabled for the active org — a disabled module must be indistinguishable from one that was never installed.

**Disabling is non-destructive.** `onDisable` never drops data. Re-enabling restores the previous state. Deleting module data is a separate, explicit, confirmed action.

---

## 4. Data and tenancy

### 4.1 Identity

Supabase Auth owns `auth.users`. A `public.users` mirror row is created by a database trigger on insert, carrying application-level fields. Application code never writes to `auth.users`.

### 4.2 Two clients, deliberately

| Client | Role | Where it may be used |
|---|---|---|
| `dbAdmin` | service role, bypasses RLS | `src/core/**` only — enforced by ESLint `no-restricted-imports` |
| `dbAs(user)` | opens a transaction, `SET LOCAL request.jwt.claims`, RLS applies | everywhere else |

Every request path that touches tenant data goes through `dbAs`. `dbAdmin` exists for exactly three things: the signup transaction before a membership exists, background jobs, and migrations.

### 4.3 RLS

Every tenant-owned table carries `org_id uuid not null` and gets a policy of the form:

```sql
create policy tenant_isolation on <table>
  using (org_id in (
    select org_id from organisation_memberships
    where user_id = auth.uid() and is_active
  ));
```

This means tenant isolation is enforced **twice** — once in application code via `requirePermission`, once in Postgres. The cross-tenant test suite attacks both layers independently, including a test that runs with application checks stubbed out to prove RLS holds on its own. A table without an RLS policy is a build failure, checked by a migration test that enumerates `pg_tables` against `pg_policies`.

### 4.4 Money

**All monetary values are `Int` cents.** No floats, no `Decimal`, no exceptions. `Decimal` survives only for leave day counts, which need 0.5 granularity. The existing schema's mixed `Int`/`Decimal` money handling is corrected.

### 4.5 Storage

Private bucket `employee-documents`. Object path `org/{orgId}/employee/{employeeId}/{uuid}`. Storage RLS policies mirror the table policies. Access is by 60-second signed URL, generated server-side after a permission check. No object is ever public. Upload failures roll back the metadata row; orphaned objects are swept by a background job.

---

## 5. Authentication and signup

Supabase Auth handles email verification, password reset, and session management. Sessions are validated server-side in the DAL on every request; no trust is placed in client-supplied organisation identifiers.

### The 5-step wizard

| Step | Content | Persistence |
|---|---|---|
| 1 | Account + email verification code | `auth.users` created, unverified. **No organisation exists yet.** |
| 2 | Company profile — legal name, slug (validated for uniqueness and reserved words), size, industry, country, timezone, currency, leave year start, working days, working hours | `org_setup_progress` row |
| 3 | **Module selection** — Leave, Attendance, Onboarding, Documents, Payroll, each with a plain-language description of what it adds | `org_setup_progress` |
| 4 | Seed defaults — departments, job titles, and country-appropriate leave types, all editable before commit | `org_setup_progress` |
| 5 | Invite team, or CSV import, or skip | organisation committed |

Progress persists server-side, so a dropped session resumes where it left off. The organisation is committed in a single transaction at the end of step 5.

---

## 6. Design system

### Tokens

Derived from the HR Daddy logo gradient: cyan `#0EE7FF` → indigo `#6758FF` → purple `#8A1FFF`.

- **App accent** defaults to the mid-stop indigo `#6758FF`, and **an organisation can override it**. This is the mechanism by which HR Daddy's brand recedes when you are working inside a company.
- **Light and dark are both authored.** Dark canvas is `#0B0B0F` — near-black, matching the logo's inner square — not the current slate-900.
- 4px sub-grid, 6px default radius, hairline 1px borders in place of shadows (shadows only on overlays), tabular figures (`font-variant-numeric: tabular-nums`) on every numeric column.

### Where the gradient is allowed

Exactly four places: auth pages, marketing surfaces, empty-state accents, and a small `◈ HRDaddy` wordmark pinned to the sidebar footer. Everywhere else uses the org accent. This satisfies the requirement that HR Daddy branding sits small and low, especially inside an organisation.

### Interaction

Command palette (`⌘K`) for navigation and actions. Full keyboard navigation on data tables. Every table has authored empty, loading, and error states — not spinners over blank space.

---

## 7. Singapore statutory pack

Sourced from MOM and CPF Board, July 2026. Encoded as versioned fixtures under `src/modules/sg-compliance/`, never as inline constants.

### 7.1 Leave entitlements (MOM)

| Type | Entitlement |
|---|---|
| Annual leave | 7 days after 1 year of service, +1 day per additional year, capped at 14. Pro-rated for incomplete years. |
| Outpatient sick leave | 14 days/year |
| Hospitalisation leave | 60 days/year, **inclusive of** the 14 outpatient days |
| Maternity | 16 weeks. First two children: first 8 weeks employer-paid, last 8 government-paid. Third child onward: all 16 government-paid. |
| Paternity | 4 weeks, government-paid, capped at $2,500/week |
| Childcare | 6 days/year until the child turns 7. Employer pays days 1–3; days 4–6 government-reimbursed, capped at $500/day. |

### 7.2 CPF contribution rates, effective 2026-01-01

Applies to Singapore Citizens and PRs only. Foreigners on work passes are excluded.

**Table 1 — Citizens and PRs (3rd year onward)**

| Age | Employer | Employee | Total | Max on OW (total / employee) |
|---|---|---|---|---|
| 55 and below | 17% | 20% | 37% | $2,960 / $1,600 |
| Above 55–60 | 16% | 18% | 34% | $2,720 / $1,440 |
| Above 60–65 | 12.5% | 12.5% | 25% | $2,000 / $1,000 |
| Above 65–70 | 9% | 7.5% | 16.5% | $1,320 / $600 |
| Above 70 | 7.5% | 5% | 12.5% | $1,000 / $400 |

**Graduated phase-in bands** (total wages for the calendar month):
- ≤ $50 — nil
- \> $50 to $500 — employer share only, at the employer rate × TW
- \> $500 to $750 — employer rate × TW **+** a graduated employee component of `k × (TW − 500)`, where `k` is 0.6 / 0.54 / 0.375 / 0.225 / 0.15 by ascending age band
- \> $750 — full rates

**Tables 2–5** cover PR years 1 and 2 under Graduated/Graduated and Full-employer/Graduated arrangements. All five are captured in `docs/reference/statutory/singapore/CPF-contribution-rates-2026-01-01.pdf` and encoded as fixtures.

**Ceilings:** Ordinary Wage ceiling $8,000/month. Annual ceiling $102,000 for OW + AW combined. Additional Wage ceiling = $102,000 − total OW already subject to CPF that year.

### 7.3 Payslips — 12 mandatory items

Per the Employment (Employment Records, Key Employment Terms and Pay Slips) Regulations 2016:

1. Employer's name · 2. Employee's name · 3. Date of payment · 4. Basic salary · 5. Salary period (start and end) · 6. Allowances (fixed and ad-hoc) · 7. Additional payments (bonus, rest-day, public-holiday pay) · 8. Deductions (fixed and ad-hoc) · 9. Overtime hours worked · 10. Overtime pay · 11. Overtime period if it differs from the salary period · 12. Net salary

Rules: issued with payment or within 3 working days. No-pay leave and absences must appear as **separate itemised deduction lines** showing days and amounts — silently reducing gross salary produces a non-compliant payslip. Retain 2 years for current employees, 1 year after departure. Penalties are administrative: up to $1,000 first occasion, $2,000 repeat, **per affected employee**.

Key Employment Terms must be issued in writing to every covered employee engaged for 14 days or more.

---

## 8. Payroll calculation

### CPF computation order

The order is prescribed by CPF Board and is easy to get wrong. The employer share is a **residual** — never computed independently, because independent rounding of both shares does not reconcile against the total.

```
1. total    = round_half_up(rate_total × wages)      → nearest dollar
2. employee = floor(rate_employee × wages)           → drop cents
3. employer = total − employee                       → residual
```

When both OW and AW are payable in the same month, compute CPF on each separately, sum, then apply the rounding rules to the result.

### Implementation constraints

- Rate fixtures are selected by **pay-period date**, not by today's date, so historical payslips remain reproducible after a rate change.
- Each fixture carries `effectiveFrom`, the source URL, and a SHA-256 of the source PDF.
- Test fixtures are drawn from CPF Board's own published worked examples. A rate table that fails to reproduce them fails the build.
- Published payslips are immutable. Correction requires a formal reopen, which is audited.
- A payslip cannot publish unless all 12 mandatory items validate against the Zod schema.
- A disclaimer appears on the payroll module and on every generated payslip: figures are computed from configured rate tables, are not tax advice, and must be verified before filing.

---

## 9. Testing

| Level | Coverage |
|---|---|
| Unit | CPF calculation against official worked examples, leave accrual and pro-rating, attendance duration across midnight and DST, permission resolution, state transitions |
| Integration | Cross-tenant isolation (both layers, plus RLS-only with app checks stubbed), audit record creation, notification dispatch, module enable/disable, storage permission enforcement |
| E2E (Playwright) | Owner signup through wizard, HR adds employee, employee signs in, clock in/out, leave submit → manager approve → employee sees result, onboarding assignment and completion, document upload and retrieval, payroll publish and payslip view |
| Browser verification | Every workflow at desktop, tablet, and mobile widths, with console and network error inspection, and screenshots captured |

A migration test enumerates every table in `pg_tables` and fails if any tenant-owned table lacks an RLS policy.

---

## 10. kiro harness protocol

1. Claude writes `docs/kiro/<milestone>.md` — a dense, complete brief with file layout, contracts, acceptance criteria, and explicit non-goals.
2. Claude runs `kiro-cli chat --no-interactive -a --effort high` with the brief.
3. Claude verifies independently: `tsc --noEmit`, `eslint`, `vitest run`, `playwright test`, plus real browser screenshots at three widths and console/network inspection.
4. Claude sends **one consolidated correction round** per milestone.
5. Claude commits, updates docs, moves to the next milestone.

Budget target: ~2 kiro invocations per milestone across 8 milestones. Claude does verification, review, and small corrective edits directly rather than spending kiro credits on them.

---

## 11. Milestones

| # | Milestone | Gate |
|---|---|---|
| M1 | Kernel — auth, tenancy, RLS, permissions, module registry, events, audit, storage, design system, app shell | Cross-tenant test suite passes against an empty feature set |
| M2 | Signup wizard and org setup | An org can be created, configured, and resumed mid-setup |
| M3 | Employees module | First vertical slice: permissions enforced, cross-tenant rejected, audit written |
| M4 | Leave module | Submit → approve → balance updates, with MOM defaults seeded |
| M5 | Attendance module | Clock in/out, timezone, corrections with audit |
| M6 | Onboarding and Documents | Templates applied, documents stored and retrieved under signed URLs |
| M7 | Payroll with CPF | Official worked examples reproduce exactly |
| M8 | Seed, verification, deploy, docs | Two-org demo, E2E green, deployed, docs reconciled |

---

## 12. Documentation changes

**New:** ADR-016 Supabase and RLS · ADR-017 Module kernel · ADR-018 Singapore statutory pack · ADR-019 Design system.

**Reconciled:** `product_brief.md`, the ERD, `permissions-matrix.md` (permissions become module-owned), `tenant-isolation.md` (RLS layer added), `threat-model.md` (RLS, storage signing, payroll integrity).

Existing planning documents are augmented, not replaced. Nothing is deleted without a documented replacement.

---

## 13. Assumptions and open items

**Assumptions**
- Single Supabase project serves dev and the review deployment. Production separation is a later concern.
- Email delivery uses Supabase Auth's built-in sender for V1; a dedicated provider is a V2 swap behind the notification adapter.
- Org slugs are globally unique and immutable after creation.
- V1 is English-only. Currency displays as SGD; the field exists for future use.

**Open item — DATABASE_URL.** Prisma needs the Postgres connection string, whose password is set at project creation and is not retrievable through the management API. Migrations can proceed via the Supabase migration API without it, but local `prisma migrate` and the deployed runtime need it. Retrieve from Supabase dashboard → Project Settings → Database, and place in `.env.local`. This does not block M1 kernel work.

**Accepted risk — payroll correctness.** Statutory calculation was chosen with the legal exposure understood. Mitigations: versioned fixtures, official worked-example tests, immutable published payslips, audited reopens, and an explicit disclaimer. This does not substitute for review by a Singapore payroll professional before any real-world use.
