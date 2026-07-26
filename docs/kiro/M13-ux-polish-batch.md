# M13 — Leave Approval Safety, Calendar Hover Card, Org Chart Graph, Payroll PDF, Documents Explorer, Team Attendance Dashboard, Sidebar Overhaul

Seven independent UX items, dispatched to kiro as separate scoped runs rather than one giant one — M12 shipped as a single large dispatch and needed five follow-up fixes after the fact; smaller reviewable chunks are cheaper to verify correctly. M12 (shift/overtime/compliance) has already landed and been reviewed.

---

## 0. Sidebar overhaul (do this one first — other items below build on it)

Two real problems, reported live by the owner:

**Bug: two sidebar items highlight as "active" at once.** `src/core/ui/shell/app-sidebar.tsx` computes `isActive` as `pathname === href || pathname.startsWith(`${href}/`)`. Since nav is a flat list, visiting `/attendance/team` matches both "Attendance" (`/attendance`, prefix match) and "Team Attendance" (`/attendance/team`, exact match) simultaneously — same for "Employees" (`/employees`) and "Org Chart" (`/employees/org-chart`). Any nav entry whose href is a prefix of another's has this bug.

**Fix: real parent/child nav, not a flat list.** Add `children?: NavEntry[]` to the `NavEntry` interface in `src/core/modules/index.ts`. Update `resolveNav` there to carry children through. Update the manifests that currently register these as separate flat top-level entries — `src/modules/attendance/manifest.ts` ("Team Attendance") and `src/modules/employees/manifest.ts` ("Org Chart", check its exact current registration) — to instead register them as a `children` entry under their parent ("Attendance", "Employees" respectively).

In `app-sidebar.tsx`: render children as an expandable sub-list under their parent (expand automatically when the current path matches the parent section, collapse otherwise — check for an existing disclosure/accordion primitive in `src/core/ui/` before building one). Active-state logic: only the single deepest-matching entry (parent OR the matching child, never both) gets the full active treatment; if a child is active, the parent shows a lighter "section is open" indication (e.g. bold label, not the same accent-filled pill the true active leaf gets) so it's visually clear which is the *page* and which is the *section*.

**New: collapsible icon-only mode.** Add a collapse toggle (icon button, top or bottom of sidebar, whichever fits the existing header/footer layout) that shrinks the sidebar to icons-only with a narrower fixed width, showing labels as tooltips on hover. Persist the collapsed/expanded state (localStorage is fine, this is a pure UI preference, no need for a DB round-trip). Collapsed state should gracefully hide child nav items (or show them as a flyout on hover of the parent icon — your call on whichever reads cleaner, check for precedent in similar sidebar patterns) rather than trying to render a full expanded tree in a narrow icon rail.

**General polish pass:** the owner flagged the sidebar's look/style as something they want improved, not just the two functional issues above — while in this file, tighten up spacing/icon consistency/hover states to match the rest of this app's already-established design system (check `src/core/ui/` primitives and existing polished pages like the employee profile or leave calendar for the bar to hit). Don't invent a new visual language, extend the existing one.

Whatever you build here, make the new nesting/collapse feel like it was designed in from the start, not bolted on — check how the existing settings-nav sub-highlighting (`pathname.startsWith(`/${orgSlug}${settingsEntry.href}`)` around line 171 of app-sidebar.tsx) already handles a related case before introducing a second, inconsistent pattern.

---

## 0.5 More seed data

The owner wants richer seed data to actually see the new dashboards (team attendance, org chart, calendar) populated well rather than sparse. Expand `prisma/seed-attendance.ts` (more months of history, more employees with varied patterns — some chronically late, some with lots of overtime, some with clean records, so the new Team/Org Attendance dashboard's graphs and per-employee stats actually show a visually interesting spread rather than everyone looking the same) and check whether `prisma/seed.ts`'s two orgs (Northstar Studios, Harbour Logistics) could use 1-2 more employees each to make the org chart and department breakdowns look less sparse. Keep it deterministic (same seeded data every run, no `Math.random()` without a fixed seed) since that's how the rest of the seed scripts already work — check the existing pattern before adding new randomization.

---

## 1. Leave approval — two-step confirm, no accidental one-click approve

`src/app/(dashboard)/[orgSlug]/leave/_components/approval-list.tsx` already does this correctly for **reject** (`rejectLeaveSchema` requires a non-empty reason, and the UI already shows a textarea + confirm/cancel before submitting). **Approve** is currently a single click straight to the server action — that's the actual bug report: "cant be approved by mistake" means approve needs the same confirm step, just with an *optional* message instead of a required reason.

Change: clicking "Approve" should reveal the same kind of inline form reject already has — an optional `<textarea name="note">` ("Add a message (optional)") plus "Confirm Approval" / "Cancel" buttons — mirroring `showRejectForm` state exactly, as `showApproveForm`. Don't invent a new interaction pattern, copy the existing reject one. `approveLeaveSchema` already accepts an optional `note` field (`src/modules/leave/schemas.ts`) — no backend change needed here at all, this is UI-only.

---

## 2. Team calendar hover card

`src/app/(dashboard)/[orgSlug]/leave/_components/team-calendar-view.tsx` renders leave chips per day but the only interaction is a native `title` tooltip. Replace with a real hover card showing: employee name, department (if the employee has one — `Employee.departmentId` may be null), leave type + dates, status, who reviewed it and when (`reviewedById`/`reviewedAt` — resolve to a name), the review note if any, and a "View employee →" link to `/${orgSlug}/employees/${employeeId}`.

Data changes needed in `src/modules/leave/queries.ts`:
- `LeaveCalendarEntry` interface (and both `getTeamLeaveCalendar` and whatever the org-wide equivalent is — grep for other calendar query functions in this file) needs to add: `departmentName: string | null`, `reason: string | null`, `reviewedByName: string | null`, `reviewedAt: Date | null`, `reviewNote: string | null`. Get these via the existing `include` on the `leaveRequest.findMany` call — add `employee: { select: { ..., department: { select: { name: true } } } }` and `reviewedBy: { select: { firstName: true, lastName: true } }`, then map to the new fields. Don't add new queries, extend the existing include.

UI: use a floating popover on hover (position near the chip, dismiss on mouse-leave or click-away) rather than a native tooltip — check if this codebase already has a popover/tooltip primitive under `src/core/ui/` before building a new one. Keep it keyboard/focus accessible (appears on focus too, not just mouse hover) since this app has an accessibility bar set elsewhere.

---

## 3. Org chart — real interactive graph, not a list

`src/app/(dashboard)/[orgSlug]/employees/org-chart/_components/org-chart-tree.tsx` currently renders the manager→reports hierarchy as nested lists. Owner wants an actual node-and-connector graph, hover interactivity.

Add `@xyflow/react` (React Flow) as a dependency — it's the standard React library for this, handles layout, pan/zoom, and node/edge rendering out of the box, MIT licensed, no backend needed. Do not hand-roll SVG positioning math for this.

- Keep `src/modules/employees/org-chart-queries.ts` as-is (the manager→reports tree-building query is fine, this is a rendering change only).
- Build the React Flow node graph from that same tree: one node per employee (name, job title, small avatar/initials, department color-coded if practical), edges from manager to each direct report, auto-layout top-down (a simple layered/dagre-style layout — `@xyflow/react` doesn't auto-layout by itself, use `dagre` or `elkjs` for the layout pass, either is fine, pick whichever has simpler API for a top-down org tree).
- Hover a node: highlight it and its direct reports/manager connector, show a small info popover (same info you'd want on a hover card — job title, department, direct report count).
- Click a node: navigate to that employee's profile page.
- Keep pan/zoom enabled (React Flow gives you this for free) since org charts for larger orgs won't fit on screen.
- This must still work with zero employees / a single employee with no reports (empty/trivial states) without erroring.

---

## 4. Payroll PDF export

Read `src/modules/payroll/queries.ts` and `actions.ts` first to see the actual shape of `PayrollRecord` + `PayrollLineItem` data available (gross, net, CPF employee/employer, and whatever line items exist by the time this milestone runs, including `OVERTIME` if M12 landed) — the PDF must show a real, correct breakdown, not a placeholder.

Add `@react-pdf/renderer` as a dependency — renders PDFs from React components server-side, fits this Next.js server-action-heavy codebase better than a headless-browser approach (no Puppeteer/Chromium binary to manage in a serverless function).

Two downloads:
- **Whole-period PDF** (the "download the pdf of the payroll of that month with all the employees" ask): one combined multi-page PDF, one page (or section) per employee, for a given `PayrollPeriod`. Button lives on the payroll period detail page.
- **Single-employee PDF**: same per-employee page layout, generated for one `PayrollRecord`. Button lives wherever you can currently see an individual employee's payroll record (the payroll period's employee list, and/or the employee's own payslip view if one exists — check both).

Each employee's page/section needs a proper payslip breakdown: employee name + employee ID/number, pay period dates, gross pay, each `PayrollLineItem` listed individually by name and type (earnings, allowances, deductions, overtime — grouped and signed appropriately, deductions shown as negative/subtracted), CPF employee contribution, CPF employer contribution (shown separately, employer portion is informational not deducted from net), net pay, org name/logo if available (`getOrgBranding` already exists per the layout code — reuse it, don't refetch differently).

Generate via a server action returning the PDF bytes (or a signed download), not by piping through client-side JS — check how other file downloads in this app are already wired (documents module has file downloads, follow that pattern for auth/permission-checking consistency) rather than building a new download mechanism.

---

## 5. Documents — file-explorer reorganization

`src/modules/documents/` currently models documents as flat `EmployeeDocument` rows under a `DocumentCategory` (e.g. "Resume", "NRIC/Passport", "Contract") per employee — check `schemas.ts`/`queries.ts` for the exact current category list before changing anything. There is no folder hierarchy model, and there doesn't need to be one — build the folder *view* as a computed tree over existing data, don't add a new folder table.

Target structure, as the owner described it:

```
Documents/
├── Employee Documents/
│   ├── <Employee Name>/          (one folder per employee)
│   │   ├── Resume
│   │   ├── NRIC / Passport
│   │   └── ... (existing DocumentCategory rows for that employee)
│   └── ...
└── Payroll/
    ├── By Month/
    │   ├── <Period Name>/         (one folder per PayrollPeriod)
    │   │   └── <Employee Name> — download button (generates PDF on demand, per M13 §4 — do NOT persist a stored file for this, generate live each time, per the reviewer's earlier decision to keep payslips always-accurate rather than stored copies that can drift)
    └── By Employee/
        └── <Employee Name>/
            └── <Period Name> — same on-demand PDF download
```

- "Employee Documents" is real data (existing `EmployeeDocument`/`DocumentCategory` rows) — build breadcrumb navigation (Documents → Employee Documents → Jane Tan → Resume) over what's already there. Existing upload/view/download actions in `documents/actions.ts` and `client-actions.ts` stay as-is, this is a navigation/IA change, not a data model change.
- "Payroll" is entirely virtual — no `EmployeeDocument` rows involved, just a folder-shaped UI over `PayrollPeriod`/`PayrollRecord` queries, ending in the same PDF-download buttons from §4. Reuse the same server action, don't duplicate PDF generation logic between the payroll page and the documents page.
- Respect existing permission checks — `attendance.view_team`-style scoping should apply here too: an employee should not browse into another employee's "Employee Documents" or "Payroll" folder they have no permission to see. Check what permission gates the existing per-employee document view and apply the same gate to both new virtual folders.
- Build this as a real file-explorer UI: breadcrumbs, folder/file icons, click-to-navigate, not a nested-accordion list. Check `src/core/ui/` for any existing tree/list primitives before building new ones.

---

## 6. Team/Org Attendance — make it an actual dashboard

`src/app/(dashboard)/[orgSlug]/attendance/team/page.tsx` and `_components/team-attendance-table.tsx` (from M12) currently render one sortable table and nothing else. Owner wants this to read as a dashboard: an overview of ~3 charts on top, the existing table below.

- Reuse `getTeamAttendanceOverview`/`getOrgAttendanceOverview` (`src/modules/attendance/queries.ts`) — they already return per-employee `daysPresent`/`totalHoursWorked`/`lateCount`/`undertimeCount`/`overtimeCount` for the month, which is enough to build the charts from without a new query. If a chart genuinely needs data those queries don't return (e.g. a day-by-day trend rather than a monthly total), check `getEmployeeAttendanceHistory`/`getAttendanceWithShiftMetrics` before writing a new query — reuse first.
- Suggested three: (1) present-vs-absent-vs-on-leave headcount for today or the period, (2) a late-arrivals trend or ranking (who has the most late days this month — a simple bar is fine, don't need a time series if the data doesn't support one cleanly), (3) total overtime hours by employee or department. Use your judgment on which three are most useful given what the queries actually return — these are a starting point, not a spec to force-fit.
- **Read the `dataviz` skill/guidelines this codebase's charts already follow before building these** — check `src/core/dashboard/widgets/chart-widgets.tsx` and `chart-clients/attendance-bar.tsx` (already referenced elsewhere in this app) for the established chart library, color system, and card/tooltip conventions, and match them exactly. Don't introduce a second charting approach alongside whatever the main dashboard already uses.
- Make employee rows in the table clickable — clicking a row navigates to `/${orgSlug}/employees/${employeeId}` (that profile page already exists, this is a navigation-only change, same pattern as any other employee-name-links-to-profile spot in this app — check the main Employees list table for the exact existing pattern and match it, e.g. hover state, cursor, whether the whole row is clickable or just the name).

---

## Verification checklist

1. `tsc --noEmit`, `eslint`, `vitest run` all clean.
2. Approve a leave request with and without a message — confirm both commit correctly and the two-step confirm can't be bypassed.
3. Hover a calendar chip — confirm department/approver/reason data is real (check against a request you know the details of), not placeholder.
4. Org chart renders as connected nodes for an org with a multi-level manager hierarchy, and doesn't crash for an org with one employee and no reports.
5. Download a whole-period payroll PDF and a single-employee PDF, open both, confirm the numbers match what's in the DB for that period/employee exactly (spot check gross/net/CPF/line items against a direct query).
6. Navigate the documents explorer: Employee Documents → an employee → a category → open a real document; Payroll → By Month → a period → an employee → PDF downloads and matches §4/§5's numbers; confirm a non-admin employee can't browse into someone else's folder.
7. Sidebar: visiting Team Attendance or Org Chart highlights exactly one nav item, never two. Collapse to icon-only, confirm labels appear on hover and the state survives a page reload.
8. Team/Org Attendance dashboard renders its charts with real (not placeholder) numbers matching the table below them, and clicking an employee row lands on their actual profile page.
