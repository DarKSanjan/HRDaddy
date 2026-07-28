# M16 — Performance enrichment (reminders, acknowledgment, trend, charts, calibration) + polish pass

Schema is ALREADY MIGRATED — do not run `prisma migrate` or any DB command. Two columns were
added directly to `performance_reviews` via the Supabase MCP:

```sql
ALTER TABLE performance_reviews ADD COLUMN acknowledged_at TIMESTAMP(3);
ALTER TABLE performance_reviews ADD COLUMN reminder_sent_at TIMESTAMP(3);
```

`prisma/schema/performance.prisma` has already been updated to match (fields `acknowledgedAt`,
`reminderSentAt` added to `PerformanceReview`). Just run `npx prisma generate` (no DB connection
needed, reads schema only) to regenerate the client types before you start.

**Do NOT start a dev server. Do NOT run any command that connects to the database
(`prisma migrate`, `prisma db push`, `prisma studio`, seed scripts). Your sandbox cannot reach
the DB — every time this has been tried it hangs for hours. Verify with `tsc --noEmit`, `eslint`,
`vitest run`, and `next build` only. I will do all live verification against the deployed app
myself.**

---

## 1. Employee acknowledgment

Employees should be able to acknowledge they've read a published review.

- **Action** `acknowledgeReview(orgSlug, reviewId)` in `src/modules/performance/actions.ts`:
  - `requirePermission(org.id, 'performance.review.view_own')`
  - Resolve caller's `employeeId` via `getEmployeeIdForUser` — 404/error if the review doesn't
    belong to them (mirror the ownership check already in `submitSelfAssessment`).
  - Require `status === 'PUBLISHED'`. Error if already acknowledged (`acknowledgedAt` not null)
    — idempotent no-op is fine too, your call, just don't let it silently overwrite the timestamp.
  - Set `acknowledgedAt: new Date()`. Write audit (`performance.review.acknowledge`).
  - `revalidatePath` the employee's profile page.
- **Types**: add `acknowledgedAt: Date | null` to `ReviewItem` in `queries.ts`, select it in both
  `getCycleReviews` and `getEmployeeReviewHistory`.
- **UI** — `performance-tab.tsx`, in the published-reviews history list: if it's the employee's
  own profile and `!review.acknowledgedAt`, show a small "Acknowledge" button next to the review
  card that calls the action and refreshes. If acknowledged, show a small muted line
  "Acknowledged on {date}" (use the same `Intl.DateTimeFormat('en-GB', ...)` pattern already used
  for `publishedAt` in this file). When viewing someone else's profile (admin/manager view), show
  the acknowledgment status read-only (no button) — same muted line, or "Not yet acknowledged" in
  a neutral `Badge`.
- Also show acknowledgment status in the admin `review-queue.tsx` published list (small badge
  next to each published review: `Acknowledged` (success) or `Awaiting acknowledgment` (neutral)).
- **PDF**: in `downloadEmployeeCyclePdf`'s document (`review-document.tsx`), add a line near the
  footer of each employee page: "Acknowledged by employee: Yes, {date}" or "Not yet acknowledged".
  Good for compliance record-keeping — this was explicitly asked for as a record.

## 2. Reminders

No cron infra exists yet in this app (no `vercel.json` crons, no scheduled routes anywhere) — you're building the first one.

**A. Event-triggered — on cycle open** (`openCycle` in `actions.ts`):
After the cycle is set to `ACTIVE`, look up all `PENDING` reviews in that cycle, group by the
employee's `managerId`, and send **one notification per manager** (not one per employee) via
`getNotificationAdapter()` — mirror the pattern in `src/modules/leave/actions.ts` around line 163
(`notifier.send({ orgId, userId: manager.userId, title, message, link })`).
Message: `"You have {N} performance review${N === 1 ? '' : 's'} to complete for {cycleName}, due by {endDate formatted}."`
Link: `/${orgSlug}/performance`. Skip managers with no `userId` linked (same guard leave.actions.ts uses).

**B. Scheduled — cron reminder for stragglers.**
- New file `src/modules/performance/reminders.ts`, function `sendPerformanceReminders(): Promise<{ notified: number }>`.
  This runs outside any user session (system cron), so use `dbAdmin` directly (not `dbAs`) —
  this is the correct exception to the RLS-scoped-query rule since there's no user in context.
- Logic: find all `PerformanceCycle` rows with `status: 'ACTIVE'` and
  `endDate` between now and now + `REMINDER_WINDOW_DAYS` (export `REMINDER_WINDOW_DAYS = 3` as a
  constant from this file). For each such cycle, find `PerformanceReview` rows with
  `status: 'PENDING'` and `reminderSentAt: null`. Group by the employee's `managerId`, send one
  grouped notification per manager (same message shape as above, but frame it as a reminder:
  `"Reminder: {N} performance review${...} still pending for {cycleName} — due {endDate}."`).
  After sending, set `reminderSentAt: new Date()` on every review row that was included, so the
  same review is never reminded twice.
- Route `src/app/api/cron/performance-reminders/route.ts`:
  ```ts
  import { NextRequest, NextResponse } from 'next/server'
  import { sendPerformanceReminders } from '@/modules/performance/reminders'

  export async function GET(request: NextRequest) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await sendPerformanceReminders()
    return NextResponse.json(result)
  }
  ```
- Add to `vercel.json`:
  ```json
  "crons": [
    { "path": "/api/cron/performance-reminders", "schedule": "0 1 * * *" }
  ]
  ```
  (1am UTC = 9am Singapore, daily.) Keep the existing `"regions"` key as-is.
- I'll set the `CRON_SECRET` env var on Vercel myself after you're done — don't worry about it,
  just read it from `process.env.CRON_SECRET` as shown above.

## 3. Trend chart (score over time)

On `performance-tab.tsx`, above or alongside the review history list, add a line chart of the
employee's `overallScore` across their published reviews, chronological (oldest → newest).

- Add `cycleStartDate: Date` to `ReviewItem` in `queries.ts` (select `cycle.startDate` in
  `getEmployeeReviewHistory`'s include, alongside the existing `cycle: { select: { name: true, ... } }`).
- In `performance-tab.tsx`, derive the chart data by sorting `publishedReviews` by `cycleStartDate`
  ascending, mapping to `{ cycle: r.cycleName, score: r.overallScore }`.
- Use `LineChart` from `@/core/ui/charts/line-chart.tsx` — check its prop shape (mirror how
  `overtime-hours-bar.tsx` / `attendance-headcount-donut.tsx` consume the chart components: same
  import path, same `CHART_COLORS`/tokens, don't invent new chart code or hardcode colors).
  Single series (`dataKey: 'score'`), `xKey: 'cycle'`, y-axis domain 1–5.
- Only render the trend chart when there are **2 or more** published reviews — with 0 or 1, a
  trend has no meaning; show nothing (not an empty chart) in that case.

## 4. Replace flat numbers with real visuals

Read `CHART_COLORS` / `AXIS_STYLE` / `GRID_STYLE` from `src/core/ui/charts/palette.ts` — never
hardcode a hex or Tailwind color for anything chart-related. Reuse the existing chart components
in `src/core/ui/charts/` (`bar-chart.tsx`, `donut-chart.tsx`, `line-chart.tsx`) — do not write new
recharts wrappers from scratch when one already exists that fits.

**A. Auto-metrics scorecard** (both `review-queue.tsx`'s write-review form and
`performance-tab.tsx`'s metrics card) — currently 5 flat number tiles. Change to:
- **Attendance**: replace the `{pct}%` tile with a small `DonutChart` — two segments,
  `daysPresent` vs `expectedWorkdays - daysPresent` ("Present" / "Absent"), with the percentage
  as the center label (`DonutChart` already supports `label`/`labelValue` for a center stat —
  use it). Keep it compact (`height={120}` or similar, no legend needed at this size — it's
  self-explanatory with the center label).
- **Hours**: replace the separate "Hours Worked" and "Overtime" tiles with a single small 2-bar
  `BarChart` — "Regular Hours" (`totalHoursWorked - overtimeHours`) vs "Overtime Hours"
  (`overtimeHours`), one bar each.
- **Late Arrivals** and **Leave Taken**: leave these as plain stat tiles. They're single scalar
  counts with nothing to compare against — charting a single number is empty decoration, not a
  chart. (This is intentional, not something left unfinished — don't "fix" it by inventing a
  fake comparison axis for these two.)
- Keep the overall card compact — this sits inline inside an expanded review form
  (`review-queue.tsx`), so don't blow up its height. `height={100}`–`140` range for the mini
  charts, grid them 2-up alongside the two stat tiles.

**B. Performance PDF** (`src/modules/performance/pdf/`) — `@react-pdf/renderer` can't render
recharts (it's not a real DOM). Build a small PDF-native chart helper instead:
- New file `src/modules/performance/pdf/pdf-charts.tsx`, exporting a `PdfBarChart` component
  built from `@react-pdf/renderer`'s own primitives (`View`, `Text` — plain flexbox bars are
  simplest and most reliable in `@react-pdf/renderer`; you don't need `Svg`/`Rect` unless you
  want to, flexbox-width-as-bar-length works fine and is less fiddly to get proportions right).
  Props: `data: Array<{ label: string; value: number; colorIndex?: number }>`, `maxValue?: number`
  (defaults to max of the data). Render one horizontal bar per row: a label, a bar whose width is
  `(value / maxValue) * 100%` filled with `CHART_COLORS[colorIndex ?? i]` (these are already raw
  hex strings — safe to use directly in PDF styles, unlike the CSS-variable-based `AXIS_STYLE`/
  `GRID_STYLE` which won't resolve inside `@react-pdf/renderer` — don't use those two there), and
  the numeric value printed at the end of the bar.
- **Cycle summary page** (`downloadCyclePdf`'s first page): replace the plain "1★: 2, 2★: 1, ..."
  distribution text/table with a `PdfBarChart` — one bar per score value 1–5, `value` = count of
  reviews at that score.
- **Per-employee page, advanced mode** (6-competency breakdown): replace the plain
  label/score list with a `PdfBarChart` — one bar per competency, `maxValue={5}`.
  Simple mode (single overall score) stays as-is — no chart needed for one number.

## 5. Org chart tie-in

`src/modules/employees/org-chart-queries.ts`'s `getOrgChart` — add an optional
`avgTeamScore: number | null` to `OrgChartNode`, computed only when the `performance` module is
enabled for the org (pass `enabledModules: string[]` as a new param, or check it at the call
site and skip the extra query — your call on which is cleaner given the existing call site in
`org-chart-flow.tsx`/`org-chart-tree.tsx`). For each node that has `directReports.length > 0`,
compute the average `overallScore` across `PUBLISHED` reviews belonging to their direct reports
in the **latest CLOSED cycle** (most recent `PerformanceCycle` with `status: 'CLOSED'`, ordered by
`endDate desc`). Null if no closed cycle yet or no published reviews for that manager's reports.

In `org-chart-flow.tsx` (the custom React Flow node renderer), show a small badge on manager
nodes when `avgTeamScore` is not null — e.g. `★ 4.2` in a small `Badge` (use `scoreVariant`-style
thresholds like `performance-tab.tsx` already has: `<=2 danger, ===3 warning, >=4 success` —
extract that threshold logic to `src/modules/performance/labels.ts` or `utils.ts` if it doesn't
already live somewhere shared, and import it in both places instead of copy-pasting the
if/else). Keep it small and unobtrusive — this is a secondary annotation on an existing node, not
the focal point.

## 6. Team dashboard tie-in

`src/app/(dashboard)/[orgSlug]/attendance/team/page.tsx` is the existing "team dashboard" (it
already has 3 charts: `AttendanceHeadcountDonut`, `LateArrivalsBar`, `OvertimeHoursBar`). Add a
4th section — "Team Performance" — **only when the `performance` module is enabled** (check
`enabledModules.includes('performance')`, this page currently only guards on `attendance` — don't
hard-fail the whole page if performance is off, just skip this section).

- New component `src/app/(dashboard)/[orgSlug]/attendance/team/_components/team-performance-bar.tsx`
  — a `BarChart`, one bar per employee, `overallScore` from the latest `CLOSED` cycle's
  `PUBLISHED` review for that employee. Reuse `getCycleReviews(userId, orgId, cycleId,
  filterByManagerId)` from `performance/queries.ts` — it already supports scoping to a manager's
  direct reports, which is exactly what this page needs for the `MANAGER` role branch (mirror how
  this page already branches `role === 'MANAGER'` vs org-wide for the attendance queries). You'll
  need a small new query to find "the latest CLOSED cycle id" — add
  `getLatestClosedCycleId(userId, orgId): Promise<string | null>` to `performance/queries.ts`.
- If there's no closed cycle yet, or `enabledModules` doesn't include `performance`, don't render
  the section at all (no empty placeholder card).

## 7. Calibration view (Admin/HR only)

New section, gated behind `performance.cycle.manage` (same permission used for cycle management —
this is intentionally not visible to `MANAGER` role, it's for comparing managers against each
other).

- Query `getCalibrationData(userId, orgId, cycleId)` in `performance/queries.ts`: for a given
  cycle, fetch all `PUBLISHED` reviews with `reviewerId` set, group by reviewer, compute
  `{ reviewerId, reviewerName, avgScore, reviewCount }` per manager, plus the overall org average
  across the same review set. Return `{ byManager: [...], orgAverage: number }`.
- UI: add a "Calibration" tab/section to the cycle manager area (`cycle-manager.tsx` or a new
  component alongside it — your call on the cleanest place, but it should be reachable from the
  same `/performance` page, gated the same way the cycle-management controls already are).
  - A `BarChart`, one bar per manager, `avgScore`, sorted descending.
  - Below the chart: the org average as a plain stat line ("Org average: {x}"), and a short list
    of managers whose `avgScore` deviates from `orgAverage` by more than 0.5 in either direction,
    each with a `Badge` (`warning` if higher than org avg — possible rating inflation, `info` if
    lower — possible harshness) and the delta shown. Don't try to conditionally recolor individual
    bars in the shared `BarChart` component — it doesn't support per-bar color overrides today and
    adding that is out of scope here; the flagged-list-below-the-chart approach keeps the shared
    chart component untouched.
  - Cycle selector: reuse whatever cycle-picking pattern already exists on this page (there's
    already a list of cycles being rendered somewhere in `cycle-manager.tsx` — match that, don't
    invent a second cycle-selection UI pattern).

## 8. Polish pass — fix these while you're in here

- **Real bug**: `src/modules/payroll/actions.ts` line ~569, inside `publishPayrollPeriod` (or
  wherever the `momPayslipSchema` payload is built) — `overtimeHours: 0, // TODO M13: derive from
  attendance once dashboard ships`. The dashboard shipped in M13; this is now a live compliance
  bug — a payslip can show `overtimePayCents > 0` while `overtimeHours` is hardcoded to `0`, which
  is inconsistent on a MOM-format payslip. Fix: derive the actual overtime hours for the payroll
  period from attendance the same way `getPerformanceAutoMetrics` in
  `src/modules/performance/queries.ts` does — reuse `resolveShift`/`computeShiftMetrics` from
  `src/modules/attendance/shift-helpers.ts` (don't reimplement the OT calculation a third time),
  scoped to the payroll period's date range instead of a review cycle's. Look at how
  `getPerformanceAutoMetrics` structures this and mirror it for the payroll context.
- **Dead TODOs**: `src/app/(dashboard)/[orgSlug]/onboarding/page.tsx:18`,
  `src/actions/auth.ts:36`, `src/actions/auth.ts:65` all have stale `TODO(M2)` comments describing
  work that already shipped (the signup wizard, org-dashboard redirect, and email verification
  flow all exist today). Verify each one is genuinely done (read the surrounding code — don't
  blindly delete), then remove the stale comment. Don't touch the code itself, just the leftover
  scaffold comments.
- General: while you're touching `review-queue.tsx`, `cycle-manager.tsx`, `performance-tab.tsx`,
  and the org-chart/team-dashboard files for the above, if you notice any other hardcoded
  Tailwind color (`bg-green-100` etc. instead of the `Badge` variant system), inconsistent empty-
  state handling, or missing loading/disabled states on a new button you're adding, fix it in the
  same file — but don't go on a separate refactor tour of files unrelated to this milestone.

## Notes

- New permission is not needed for acknowledgment — it uses the existing
  `performance.review.view_own` (an employee acknowledging their own review is a natural extension
  of viewing it).
- Calibration is deliberately **not** added as a new permission key — reusing
  `performance.cycle.manage` keeps the permission surface small and matches the access decision
  (same people who manage cycles get to see calibration).
- Write real unit tests for anything with actual logic (reminder-window date math, calibration
  averaging, the payroll OT-hours fix) in the existing `__tests__` folders, following the pattern
  already in `src/modules/performance/__tests__/performance.test.ts`. Don't write a test docstring
  that promises coverage the test doesn't actually exercise.
- Run `tsc --noEmit`, `eslint`, `vitest run`, and `next build` before considering this done. Report
  back what you changed file-by-file and what you verified.
