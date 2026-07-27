# M15 — performance review polish + documents consolidation

Three independent items based on user feedback after using M14 live. Do them
in order; each is scoped separately.

## 1. Show auto-metrics WHILE writing a review, not just after

User: "no auto stuff while writing the performance review tho? like
attendance and stuff like that should be auto I think."

The auto-metrics scorecard already exists —
`getPerformanceAutoMetrics(userId, orgId, employeeId, startDate, endDate)`
in `src/modules/performance/queries.ts` — and already renders on the
employee profile's Performance tab. It does NOT currently show up on the
`/[orgSlug]/performance` page's "Write Review" form
(`src/app/(dashboard)/[orgSlug]/performance/_components/review-queue.tsx`),
where a manager is actually scoring someone — which is exactly where it's
most useful (a manager scoring "Reliability" should see the person's actual
attendance/late-arrival numbers right there, not have to tab over to their
profile).

Fix: in `review-queue.tsx`, when a `Write Review` form is expanded for a
given `ReviewItem`, fetch and display that employee's `AutoMetrics` for the
active cycle's date range above the score inputs — a compact version of the
same stat-tile layout `performance-tab.tsx` already uses. Since
`review-queue.tsx` is a client component and `getPerformanceAutoMetrics` is
server-only, either: (a) have the parent `page.tsx` fetch auto-metrics for
every pending-review employee up front and pass them down as a prop map
(`Record<employeeId, AutoMetrics>`), which is simplest and avoids new
client-server plumbing, or (b) add a small server action wrapper if fetching
for all 14+ employees up front is wasteful — your judgment, but (a) is
probably fine at this org size and matches how the page already fetches
`reviewQueue` up front.

## 2. Performance review PDF export

User wants this reachable from Documents (mirroring how payroll payslips
work), in two shapes:
- **Whole-office, per quarter**: one PDF, first page is an office-wide
  productivity overview, followed by one page per employee's individual
  review.
- **Per-employee, per quarter**: one employee's single review as its own
  PDF.

Model this directly on the payroll PDF export from M13.5/M13.6 —
`src/modules/payroll/pdf-actions.tsx`, `src/modules/payroll/pdf/
payslip-document.tsx`, `src/modules/payroll/pdf/types.ts` — same
`@react-pdf/renderer` approach, same real-PNG-logo-via-base64-data-URI
pattern (`src/modules/payroll/pdf/payslip-document.tsx`'s `logoBase64`
constant — copy this, don't reinvent it), same "summary page first, then
per-entity pages" structure already built for `downloadPeriodPdf`'s
`SummaryPage`.

Create `src/modules/performance/pdf-actions.tsx`
(`downloadCyclePdf(orgSlug, cycleId)` and `downloadEmployeeCyclePdf(orgSlug,
reviewId)`), `src/modules/performance/pdf/review-document.tsx`, `src/modules/
performance/pdf/types.ts`. Permission gating: `performance.review.view_all`
for the whole-cycle export; `performance.review.view_all` OR the caller
being the specific employee (self, and only for their own PUBLISHED review)
for the single-employee export — mirror `downloadEmployeePdf`'s
admin-or-self pattern in payroll exactly.

**Content, per employee page**: overall score + label (`getRatingLabel`),
competency breakdown if advanced mode, strengths/improvements/goals,
self-assessment, reviewer name + date — everything already in
`ReviewItem`/`getEmployeeReviewHistory`. Additionally, per the user's
request, include the **auto-metrics for that employee's cycle**: attendance
reliability, late arrivals, leave days taken, hours worked, AND overtime
hours. Check whether `AutoMetrics` (in `queries.ts`) already includes
overtime — if not, extend `getPerformanceAutoMetrics` to also return
overtime hours for the range (the attendance module's
`EmployeeAttendanceOverview.overtimeCount`/existing shift-metrics logic has
this — reuse it, don't recompute overtime rules from scratch; check
`src/modules/attendance/queries.ts` and `src/modules/attendance/shift-
helpers.ts` for the existing overtime-minutes logic already used by
payroll).

**Content, office-wide summary page** (whole-cycle export only): cycle name
+ date range, org name + logo, total employees reviewed, average overall
score across all published reviews, a simple distribution (count of
employees at each of the 5 rating levels), and org-wide aggregate
attendance/leave/OT numbers for the cycle if that's a reasonable
aggregation (sum or average — your call on which reads better, state which
you picked). Only include **PUBLISHED** reviews in both the summary
aggregate and the per-employee pages that follow — unpublished/pending
reviews are internal drafts and shouldn't appear in an exported report.

**Reachability**: add a "Download All (PDF)" action on the
`/[orgSlug]/performance` page itself, next to each cycle in the cycle list
(gated by `performance.review.view_all`, same as the payroll period page's
button) — AND make it reachable from Documents, following the exact
by-month/by-employee folder pattern payroll already has in
`src/modules/documents/explorer-queries.ts` + `src/app/(dashboard)/
[orgSlug]/documents/page.tsx` (look at the `payroll` branch there —
`by-month`/`by-employee` folders, virtual on-demand-PDF file entries). Add
a parallel `performance` branch: Documents → Performance → By Quarter →
[cycle name] (virtual PDF for the whole cycle + per-employee virtual PDFs
inside), same shape as Documents → Payroll → By Month. Only show this
top-level Documents folder when the `performance` module is enabled for the
org (check how the existing root folder list already conditionally shows
Payroll).

## 3. Employee documents — consolidate into one query path

User: "the documents of the employee should also show up in the employee
tab which it does not currently... make it centrally stored and accessed so
these kind of inconsistencies do not occur again."

Investigation before fixing: there are currently TWO separate, independently
written query implementations over the same `EmployeeDocument` table —
`src/modules/documents/queries.ts`'s `listDocuments()` (used by
`client-actions.ts`'s `fetchEmployeeDocuments`, which feeds the employee
profile's Documents tab — `documents-tab.tsx`), and `src/modules/documents/
explorer-queries.ts`'s `getCategoryFoldersForEmployee`/
`getDocumentsForCategory` (used by the Documents section's file-explorer
page). Live testing during this session's review found these two currently
agree for the handful of employees that have documents — but this is
exactly the kind of duplicated-implementation setup that drifts over time
(the same class of problem already hit twice this project — the payroll
settings-nav and the M13.5 payroll test both existed because near-duplicate
logic lived in two places). Don't assume the user is wrong just because it
worked when checked once — audit thoroughly:

- Check every code path that WRITES an `EmployeeDocument` row (upload
  actions in `src/modules/documents/actions.ts`, anything in onboarding
  that attaches a document, anywhere else `tx.employeeDocument.create` is
  called) and confirm they all write through the same shape/fields — no
  divergent "shadow" document-like records stored elsewhere that either UI
  surface fails to pick up.
- Check whether `excludeSensitive`/permission-scoping differs between
  `listDocuments` and `getCategoryFoldersForEmployee` in a way that could
  make one view show fewer documents than the other for a non-admin viewer.
- Once you understand the actual gap (there may be one even if this
  session's spot-check didn't catch it — check different employees,
  different roles, sensitive-vs-non-sensitive categories, and archived
  documents specifically), fix it by consolidating: `explorer-queries.ts`'s
  per-employee folder/category functions should call into
  `queries.ts`'s `listDocuments` (or a shared helper both call) rather than
  maintaining separate Prisma queries. The employee profile's Documents tab
  and the Documents section's explorer should end up reading through the
  same underlying function for "documents belonging to employee X" — that's
  the actual fix for "centrally stored and accessed," not just patching
  today's symptom.

Report in your summary exactly what the root-cause discrepancy was (or, if
after auditing you genuinely can't find one — e.g. it turns out to be user
error or empty seed data for the specific employee they checked — say so
explicitly rather than fabricating a fix for a bug that isn't there. Do the
consolidation refactor regardless, since it's valuable on its own merits
even if today's specific instance was a false alarm).

## Verification checklist

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean (no new warnings)
- [ ] `npx vitest run` — all passing, plus a test for whatever the
      documents investigation turns up (if a real bug is found, add a
      regression test for it)
- [ ] Live: open a pending review's "Write Review" form on `/performance`,
      confirm the employee's real attendance/late/leave numbers show above
      the score inputs
- [ ] Live: download the whole-cycle PDF, confirm page 1 is the office
      summary, subsequent pages are individual PUBLISHED reviews only
      (not pending/draft ones), numbers cross-check against what's shown
      in the UI
- [ ] Live: download a single employee's review PDF from Documents →
      Performance → By Quarter → [cycle] → [employee]
- [ ] Live: for at least 2 different employees (one with documents seeded,
      one you upload a fresh document for during testing), confirm the
      Documents section and the employee profile's Documents tab show
      identical results

Do NOT run `npm run db:seed` or any destructive command against the shared
database. If you need to create a test document to verify the consolidation
fix, upload it through the real UI/action, not a raw SQL insert.
