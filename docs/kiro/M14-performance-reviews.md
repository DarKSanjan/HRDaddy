# M14 — Performance reviews + auto-metrics scorecard

New module from scratch (no existing schema/nav to extend) — follow the exact
architectural conventions the other modules already use (`leave`, `payroll`).
Read `src/modules/leave/manifest.ts` and `src/modules/payroll/manifest.ts`
before starting — this module's manifest, permission style, and nav
structure should look like a sibling of those, not a one-off.

Confirmed scope with the user before writing this brief:
- Both a manager-driven review cycle AND a zero-input auto-generated
  metrics scorecard, shown together.
- Rating scale: an org-level **simple/advanced toggle**, same pattern as
  the payroll-complexity toggle from M13.5/M13.6 (`src/core/payroll-
  settings.ts`, `src/modules/payroll/settings.ts`,
  `src/app/(dashboard)/[orgSlug]/settings/payroll/`) — simple mode is one
  overall rating + comments, advanced mode is per-competency scoring that
  rolls up into the overall rating.
- Cadence: quarterly review cycles.

---

## 1. Schema

New file `prisma/schema/performance.prisma`:

```prisma
model PerformanceCycle {
  id        String   @id @default(cuid())
  orgId     String   @map("org_id")
  name      String   // e.g. "Q3 2026"
  startDate DateTime @map("start_date")
  endDate   DateTime @map("end_date")
  status    PerformanceCycleStatus @default(DRAFT)
  createdAt DateTime @default(now()) @map("created_at")

  organisation Organisation @relation(fields: [orgId], references: [id], onDelete: Cascade)
  reviews      PerformanceReview[]

  @@index([orgId])
  @@map("performance_cycles")
}

model PerformanceReview {
  id               String   @id @default(cuid())
  orgId            String   @map("org_id")
  cycleId          String   @map("cycle_id")
  employeeId       String   @map("employee_id")
  reviewerId       String?  @map("reviewer_id")   // the manager who submitted it — null until submitted
  overallScore     Int?     @map("overall_score") // 1–5. In advanced mode this is DERIVED from competency scores (rounded average), not independently editable.
  strengths        String?
  improvements     String?
  goals            String?
  selfAssessment   String?  @map("self_assessment") // employee's own free-text, optional, filled independently of the manager's review
  status           PerformanceReviewStatus @default(PENDING)
  submittedAt      DateTime? @map("submitted_at")
  publishedAt      DateTime? @map("published_at")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  organisation      Organisation      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  cycle             PerformanceCycle  @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  employee          Employee          @relation("PerformanceReviewSubject", fields: [employeeId], references: [id], onDelete: Cascade)
  reviewer          Employee?         @relation("PerformanceReviewer", fields: [reviewerId], references: [id])
  competencyScores  PerformanceCompetencyScore[]

  @@unique([cycleId, employeeId]) // one review per employee per cycle
  @@index([orgId])
  @@index([employeeId])
  @@map("performance_reviews")
}

model PerformanceCompetencyScore {
  id         String               @id @default(cuid())
  reviewId   String               @map("review_id")
  competency PerformanceCompetency
  score      Int                  // 1–5

  review PerformanceReview @relation(fields: [reviewId], references: [id], onDelete: Cascade)

  @@unique([reviewId, competency])
  @@map("performance_competency_scores")
}

enum PerformanceCycleStatus {
  DRAFT
  ACTIVE
  CLOSED
}

enum PerformanceReviewStatus {
  PENDING    // cycle open, manager hasn't submitted yet
  SUBMITTED  // manager submitted, not yet visible to employee
  PUBLISHED  // visible to the employee
}

enum PerformanceCompetency {
  JOB_KNOWLEDGE
  QUALITY_OF_WORK
  COMMUNICATION
  TEAMWORK
  INITIATIVE
  RELIABILITY
}
```

Wire the two new relations onto `Employee` in `prisma/schema/employees.prisma`
(`performanceReviewsReceived` / `performanceReviewsGiven`, named relations
matching `"PerformanceReviewSubject"`/`"PerformanceReviewer"`) and the four
new arrays onto `Organisation` in `prisma/schema/organisation.prisma`
(follow the exact pattern every other module already uses there — look at
how `leaveRequests`/`payrollRecords` etc are listed).

Create the migration (next number after `00009_add_employee_bank_details`).
**Enable RLS on all three new tables** with the standard `tenant_isolation`
policy keyed on `org_id IN (SELECT public.user_org_ids())` — copy the exact
pattern from migration `00008_shift_templates_rls`, in the same migration
that creates the tables (don't ship a table without RLS even briefly, that
was the M12 bug that had to be fixed after the fact). Apply via the Supabase
MCP `apply_migration` tool, confirm with `get_advisors` afterward that there
are no new RLS gaps — do NOT run any seed/reset command against the shared
database.

## 2. Org setting: review complexity toggle

Same shape as the payroll toggle. Add to `OrganisationModule.settings` JSON
keyed by `moduleId: "performance"`:
```json
{ "reviewComplexity": "simple" | "advanced" }
```
Default **`"simple"`** — this is a brand-new module with no existing data to
preserve, so there's no "don't silently change existing behavior" concern
the payroll toggle had; simple is the right default because it's the lower-
friction starting point for an org that's never done a review cycle before.

Create `src/core/performance-settings.ts` (`getReviewComplexity`/
`setReviewComplexity`, `dbAdmin`-based, following `src/core/payroll-
settings.ts` exactly), a thin re-export at `src/modules/performance/
settings.ts`, and a `togglePerformanceReviewComplexity` server action in
`src/modules/performance/settings-actions.ts` gated by `department.manage`
(same permission the other settings toggles use). Add a
`/[orgSlug]/settings/performance` page mirroring `/settings/payroll/page.tsx`
+ its `PayrollSettingsPanel`, and add a "Performance" tab to the
`SettingsNav` component (`src/app/(dashboard)/[orgSlug]/settings/
_components/settings-nav.tsx`), gated on the `performance` module being
enabled — follow the exact pattern the existing `Payroll`/`Shifts` tabs use
there.

## 3. Module manifest + permissions

New `src/modules/performance/manifest.ts`, registered in
`src/modules/register.ts` (add the import alongside the other five).

Permissions (mirror the naming style in `leave`/`payroll` manifests):
- `performance.review.view_own` — ALL roles (employee sees their own
  published reviews + their own auto-metrics)
- `performance.review.submit` — OWNER, HR_ADMIN, MANAGER (a manager submits
  reviews for their direct reports; HR_ADMIN/OWNER can submit for anyone)
- `performance.review.view_all` — OWNER, HR_ADMIN (see every review org-wide)
- `performance.cycle.manage` — OWNER, HR_ADMIN (create/open/close review
  cycles)

Nav entry:
```ts
nav: [
  {
    label: 'Performance',
    href: '/performance',
    icon: 'TrendingUp', // check this exists in lucide-react and in app-sidebar.tsx's iconMap — add it to iconMap if missing, same as DollarSign/ClipboardCheck were added in M13
    permission: 'performance.review.view_own',
  },
],
```
No children needed this round — cycle management and the team review queue
both live on the one `/performance` page, gated by permission inside the
page itself (see section 5).

`dependsOn: ['employees']`.

## 4. Queries + actions

New `src/modules/performance/queries.ts` and `src/modules/performance/
actions.ts`, following the `dbAs`-per-user-RLS pattern every other module
uses (never `dbAdmin` for anything permission-scoped — only the settings
toggle above uses `dbAdmin`, and only because `OrganisationModule` isn't
subject to per-row RLS the way employee-scoped data is).

Needed functions:
- `listCycles(userId, orgId)` — all cycles for the org, newest first.
- `createCycle(orgSlug, formData)` — server action, `performance.cycle
  .manage`. Auto-suggest the next quarterly name/date-range (look at
  existing cycles' end dates to compute the next quarter; if none exist,
  base it on today's date) but let the admin override name/dates before
  creating. Creates the cycle in `DRAFT`, and — this is the important part —
  **creates one `PerformanceReview` row per active employee** in `PENDING`
  status, so there's always exactly one review row per employee per cycle
  to fill in (this is what makes the "X of Y submitted" completion tracker
  in section 5 trivial to compute).
- `openCycle` / `closeCycle` — status transitions, `performance.cycle.manage`.
  Closing a cycle does NOT delete or lock existing review data — it just
  stops new submissions (enforce this in `submitReview` below).
- `submitReview(orgSlug, reviewId, formData)` — server action,
  `performance.review.submit`, and must additionally verify the caller is
  either HR_ADMIN/OWNER or the specific employee's manager (check
  `Employee.managerId` — same authorization check `leave`'s approval action
  already does for manager-scoped actions, follow that exact pattern). In
  **simple** mode, form carries one `overallScore` (1–5) + strengths/
  improvements/goals text. In **advanced** mode, form carries 6 competency
  scores (one per `PerformanceCompetency`) + the same text fields;
  `overallScore` is computed server-side as `Math.round(average of the six
  scores)`, never taken from client input in advanced mode. Sets status to
  `SUBMITTED`, `submittedAt = now()`.
- `publishReview(orgSlug, reviewId)` — server action, `performance.cycle
  .manage`, flips `SUBMITTED → PUBLISHED`, sets `publishedAt`. Only
  published reviews are visible to the employee themselves.
- `submitSelfAssessment(orgSlug, reviewId, text)` — server action,
  `performance.review.view_own` + ownership check (caller's own employee
  record only), just writes `selfAssessment` — independent of the review's
  status, an employee can write this whenever the cycle is open.
- `getEmployeeReviewHistory(userId, orgId, employeeId)` — all
  `PUBLISHED` reviews for one employee (plus the caller's own `PENDING`/
  `SUBMITTED` self-assessment-in-progress row if it's their own profile),
  most recent first, including competency scores.
- `getCycleReviews(userId, orgId, cycleId)` — every review in a cycle with
  employee names + status, for the completion tracker / manager queue.
  Managers viewing this should only see rows for their direct reports
  unless they also hold `performance.review.view_all`.

### Auto-metrics scorecard (zero manual input)

New `getPerformanceAutoMetrics(userId, orgId, employeeId, startDate,
endDate)` in `src/modules/performance/queries.ts`. This is purely derived
from data that already exists — attendance and leave — computed over the
given cycle's date range:
- Attendance reliability: `daysPresent / expectedWorkdaysInRange` as a
  percentage (expected workdays = count of `OrganisationSettings.workingDays`
  weekdays between startDate/endDate). `src/modules/attendance/queries.ts`'s
  `getAttendanceSummary` is month-scoped only — either call it once per
  month in the range and sum, or add a small date-range variant there
  (`getAttendanceSummaryForRange`) if that's cleaner; your call, but don't
  duplicate the underlying query logic, factor it so both the monthly and
  range versions share the same core.
- Late arrivals count in range.
- Leave days taken in range (`src/modules/leave/queries.ts` has the
  building blocks — `getEmployeeBalances`/leave request history — join
  APPROVED leave requests overlapping the range).
- Overtime hours in range, if attendance/payroll data has it — check
  `EmployeeAttendanceOverview.overtimeCount`/`totalHoursWorked` for the
  existing shape and reuse rather than recompute from scratch.

Return a plain object with these numbers — no new table, no caching, just
computed at request time same as the existing attendance dashboard queries.

## 5. UI

### `/[orgSlug]/performance` — cycle management + team queue

New page. Layout depends on the viewer's permission:
- Anyone with `performance.cycle.manage`: a cycle list (name, date range,
  status, "X of Y reviews submitted" completion count computed from the
  review rows created in section 4), a "Start New Cycle" button opening a
  small form (name pre-filled with the next quarter's suggested name/dates,
  editable), and per-cycle "Open"/"Close" actions.
- Anyone with `performance.review.submit` (managers included): under the
  active cycle, a queue of their direct reports' `PENDING` reviews with a
  "Write Review" action opening the review form (simple or advanced,
  depending on the org's `reviewComplexity` setting) inline or on a
  sub-route — your call on exact routing, but keep it inside `/performance`,
  don't scatter this across employee profile pages for the *authoring* flow
  (authoring happens here; *viewing your own* history happens on the
  employee profile, see below).

### Employee profile — new "Performance" tab

Add to `TABS` in `profile-tabs.tsx` and build a new `_components/
performance-tab.tsx` (matches the existing tab component pattern —
`employment-tab.tsx` is the closest reference for structure). Shows,
gated by `performance.review.view_own` (viewing your own profile) or
`performance.review.view_all`/being their manager (viewing someone else's):
- The auto-metrics scorecard (stat tiles — reuse `StatTile`/`ChartCard`
  from `@/core/ui/charts` per the dataviz skill's existing conventions in
  this codebase, same as the attendance dashboard) for the org's current
  active cycle's date range.
- Review history: past `PUBLISHED` reviews, each showing overall score
  (with the 5-point label — see below), reviewer name, date, strengths/
  improvements/goals text, and competency breakdown if the review was
  scored in advanced mode.
- If viewing your OWN profile and there's a `PENDING`/`SUBMITTED` review
  for the current open cycle: a self-assessment text box (calls
  `submitSelfAssessment`), independent of whatever the manager has or
  hasn't submitted.

### 5-point rating labels

Use a shared constant (put it in `src/modules/performance/queries.ts` or a
small `labels.ts` in that module) mapping 1–5 to: 1 "Needs Improvement", 2
"Below Expectations", 3 "Meets Expectations", 4 "Exceeds Expectations", 5
"Outstanding" — this is the standard 5-point scale used across most
mainstream HRMS products (Workday, BambooHR, Lattice all use materially
this same 5-point language), so don't invent different wording.

## 6. Dashboard widget (optional, nice-to-have)

If time allows, a small widget for managers — "Pending Reviews" count for
their direct reports in the active cycle — following the exact pattern of
`PendingLeaveWidget` in `leave/manifest.ts`. Not required for this round if
it doesn't fit cleanly; the core module (schema, queries, actions, the two
main pages) is the actual scope. Skip it rather than rush it.

## Verification checklist

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean (no new warnings)
- [ ] `npx vitest run` — all passing, plus new tests for:
      - `submitReview`'s advanced-mode overall-score averaging (a few
        concrete competency-score combos → expected rounded average,
        actual unit tests against the real exported function, not a
        hand-copied duplicate — this is the exact mistake from the
        M13.5 payroll test, don't repeat it)
      - the manager-authorization check on `submitReview` (a non-manager,
        non-admin caller must be rejected)
      - `createCycle`'s one-review-per-active-employee row creation
- [ ] RLS enabled on all three new tables, confirmed via `get_advisors`
      showing no new findings
- [ ] Full flow works live: create a cycle → submit a review as a manager
      (test both simple and advanced mode by toggling the org setting) →
      publish it → confirm the employee's own profile now shows it in
      history → confirm the auto-metrics scorecard shows real numbers
      matching what the attendance/leave pages already show for the same
      employee and date range (cross-check, don't just eyeball it)
- [ ] Settings → Performance tab toggle works and is reachable (this
      exact reachability bug happened for the payroll toggle in M13.5 —
      confirm the settings-nav entry actually renders before declaring
      done)

Do NOT run `npm run db:seed` or any command that writes to or resets the
shared database. If you want to demonstrate the full flow for your own
verification, create one cycle and one or two reviews through the real UI/
actions (not a raw SQL insert) against the live dev data already in the
database — that exercises the actual code path anyway, which is a better
test than a script would be.
