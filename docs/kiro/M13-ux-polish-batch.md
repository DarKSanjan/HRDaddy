# M13 — Leave Approval Safety, Calendar Hover Card, Org Chart Graph, Payroll PDF, Documents Explorer

Five independent UX items. Do not start this milestone until M12 (shift/overtime/compliance) has landed and been reviewed — the payroll PDF item below should render whatever line item types exist at that point (including `OVERTIME` if M12 shipped it), and running two agents against this repo at once causes file races. Check with the reviewer before starting if unsure whether M12 has landed.

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

## Verification checklist

1. `tsc --noEmit`, `eslint`, `vitest run` all clean.
2. Approve a leave request with and without a message — confirm both commit correctly and the two-step confirm can't be bypassed.
3. Hover a calendar chip — confirm department/approver/reason data is real (check against a request you know the details of), not placeholder.
4. Org chart renders as connected nodes for an org with a multi-level manager hierarchy, and doesn't crash for an org with one employee and no reports.
5. Download a whole-period payroll PDF and a single-employee PDF, open both, confirm the numbers match what's in the DB for that period/employee exactly (spot check gross/net/CPF/line items against a direct query).
6. Navigate the documents explorer: Employee Documents → an employee → a category → open a real document; Payroll → By Month → a period → an employee → PDF downloads and matches §4/§5's numbers; confirm a non-admin employee can't browse into someone else's folder.
