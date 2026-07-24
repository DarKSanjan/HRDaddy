# kiro brief — M8: Dashboards

The dashboard is the first thing anyone sees every morning. It should be genuinely excellent — and excellent here means *legible at a glance*, not decorated.

**Read first:** `docs/product/dashboard-metrics.md` (every metric is already defined — source tables, filters, timezone behaviour, role visibility), the chart system in `src/core/ui/charts/` from M2b, and the M3 brief's "Rules that apply to every module".

---

## The one rule that governs this brief

**Every widget must answer a question someone actually has.** No metric goes on the dashboard because it was easy to compute. If a viewer cannot say what they would *do* differently based on a number, that number does not belong there.

Corollary: sometimes the right answer is **not a chart**. A single number reads better as a `StatTile`. Reach for the plot only when shape, trend or comparison is the point.

---

## Composition is module-driven

The dashboard assembles itself from `widgets` declared in module manifests, filtered by the org's enabled modules and the viewer's permissions. A widget for a disabled module must not render, and must not query. This is the lego premise made visible — do not hardcode a widget list.

Widgets declare a size (`sm` / `md` / `lg`) and the kernel lays them out on a 12-column grid. Laptop-first at 1440×900: the important widgets are above the fold without scrolling.

---

## Role-specific dashboards

### Owner / HR admin
- **Headline tiles:** active employees (with delta vs last month), present today, on leave today, pending leave approvals, overdue onboarding tasks, documents expiring in 30 days.
- **Headcount over time** — line, 12 months, with joiners and leavers as a second view rather than a second axis. *Never a dual-axis chart.*
- **Headcount by department** — horizontal bar, sorted descending. Categorical colour, fixed order.
- **Attendance this week** — stacked bar per day: present / remote / on leave / absent. 2px surface gap between segments.
- **Leave usage by type** — donut, with a direct-labelled legend.
- **Upcoming:** birthdays and work anniversaries in the next 30 days.
- **Recent activity** — the audit feed, human-readable ("Ava Lim approved leave for Ben Chen"), not raw rows.

### Manager
Scoped to direct reports only, enforced server-side: team present today, team on leave, pending approvals awaiting *them*, team attendance for the week, overdue onboarding for their reports.

### Employee
Their own world: leave balance per type with a small usage bar, clock in/out control with today's status, my pending requests, my onboarding progress, my documents expiring, latest payslip when published.

---

## Chart discipline

Everything from the M2b chart system. Restating the traps, because these are the ones that get violated:

- **Never a dual-axis chart.** Two measures of different scale → two charts, small multiples, or index to a common base.
- Categorical colour assigned by **entity identity, in fixed order, never cycled and never by rank**. A filter that removes a series must not repaint the survivors.
- Sequential = one hue light→dark. Diverging = two hues with a **neutral grey** midpoint.
- Status colours (`--success`/`--warning`/`--danger`) mean state and are never reused as "series 4". Always with an icon or label, never colour alone.
- **Text in text tokens, never the series colour.**
- Legend for ≥2 series; also direct-label when ≤4. One series needs no legend — the title names it.
- Hover tooltips by default. Tabular figures on all numbers. Table view available on every chart.

---

## Performance

The dashboard is the most-loaded page in the product, so it must not be a query waterfall.

- Aggregate in **SQL**, not by pulling rows into JS and reducing. Counting 500 employees in application code is the wrong shape.
- All widget queries run **in parallel**, not sequentially.
- Each widget streams independently with its own `<Suspense>` and skeleton — one slow widget must not block the page.
- Every metric is org-scoped and timezone-correct per `docs/product/dashboard-metrics.md`. "Today" means today in the *organisation's* timezone, not the server's. Test an org in a non-server timezone.

---

## States

Every widget authors empty, loading and error states. Empty is the common case for a new organisation and must be **useful**, not sad: a new org with no employees should see "Add your first employee" with a working action, never a zero and a blank chart. A widget that fails must not take the dashboard down with it.

---

## Tests

Unit: each metric's calculation, including timezone boundaries and empty-org behaviour; widget visibility by role and by enabled modules.

Integration: a disabled module's widget neither renders nor queries; a manager's widgets contain only their reports' data; cross-tenant data never appears.

E2E: dashboard loads at 1440×900 for owner, manager and employee, each showing the right widgets, with zero console errors.

---

## Definition of done

All gates clean. Dashboards assemble from manifests, respect permissions and enabled modules, aggregate in SQL, and are verified in a browser at 1440×900 in both light and dark with screenshots captured for each role.
