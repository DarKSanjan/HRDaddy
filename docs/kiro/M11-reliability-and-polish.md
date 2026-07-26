# kiro brief — M11: Reliability fixes, calendar rebuild, HRMS polish

Production was reported "everything is 404" and "super slow" and "save doesn't work." Two infra fixes already landed (Vercel region moved from `iad1` to `sin1` to match Supabase's `ap-southeast-1`; `DATABASE_URL` switched from the session-mode pooler to the transaction-mode pooler). Both helped a lot, but a real, reproducible application bug remains — proven from production logs, not guessed. Fix that first, then the UX/feature items.

**Read first:** `src/core/db/client.ts`, `src/core/auth/dal.ts`, `src/core/modules/index.ts` — you need to understand `dbAs()`, `getOrgContext()`, and `moduleGuard()` before touching any of this.

---

## 1. Root-cause bug: concurrent queries sharing one transaction's connection

**Evidence:** Vercel runtime logs show this literal warning on the current production deployment, on the `/[orgSlug]/employees.rsc` route:
```
(node:4) DeprecationWarning: Calling client.query() when the client is already
executing a query is deprecated and will be removed in pg@9.0. Use async/await
or an external async flow control mechanism instead.
```
A Prisma interactive transaction (`dbAs(userId, async (tx) => {...})`) pins ONE physical Postgres connection for its whole duration. Firing two queries against that same `tx` concurrently via `Promise.all` — instead of sequentially with `await` — makes the underlying `pg` client issue two queries on one connection at once, which is not valid wire-protocol usage. Depending on timing this either silently serializes (no benefit, just confusing) or corrupts/aborts a query, which is very likely the source of intermittent failures that surface upstream as `notFound()` calls (see §2).

**Confirmed instance:** `src/modules/employees/queries.ts:145` —
```ts
const [employees, total] = await Promise.all([
  tx.employee.findMany({ ... }),
  tx.employee.count({ where }),
])
```
Both `tx.employee.findMany` and `tx.employee.count` run on the same `tx`. Fix: sequential `await`, not `Promise.all`. Yes this costs one extra round trip — the transaction-mode pooler makes that cheap, and correctness matters more than saving one round trip here.

**Audit the whole codebase for the same pattern.** `grep -rn "Promise.all" src/modules src/core` found it also in `src/modules/employees/queries.ts:333`, `src/modules/employees/actions.ts`, `src/modules/attendance/queries.ts`, `src/modules/documents/queries.ts`, `src/modules/payroll/queries.ts`, `src/modules/onboarding/queries.ts`, `src/modules/leave/queries.ts`, and `src/core/dashboard/context.ts`. For every `Promise.all` call:
- If every promise in the array is an **independent `dbAs()` call** (each opens its own transaction/connection) — that's fine, leave it, real parallelism.
- If any two promises in the array call methods on the **same `tx`** (i.e. you're inside one `dbAs`/`$transaction` callback and firing more than one query against that callback's `tx`) — convert to sequential `await`. This is the bug.

## 2. `notFound()` must not swallow real errors

`src/core/auth/dal.ts` (`getOrgContext`) and `src/core/modules/index.ts` (`moduleGuard`) both call `notFound()` whenever a lookup comes back falsy — including a case where the underlying query *should* have succeeded and a transient issue (like §1, or a brief pool hiccup) caused it to return something unexpected instead of throwing. Result: any transient database blip anywhere in the request renders as a **permanent-looking 404**, which is confusing and, per the user report, has happened on `/employees`, `/leave/approvals`, and `/settings/organisation` — different routes, same shape of failure, all intermittent.

Distinguish the two cases explicitly:
- Query genuinely returns no row (org doesn't exist / user isn't a member / module is disabled) → `notFound()` is correct, keep it.
- Query throws (connection error, timeout, anything unexpected) → this must NOT be caught and converted to `notFound()`. Let it propagate so Next's nearest `error.tsx` handles it as a real error with a retry affordance, not a page that looks like it doesn't exist. If there's a `try/catch` anywhere in this path currently swallowing the distinction, remove it. If there's no `error.tsx` at the `(dashboard)/[orgSlug]` level, add one — a real error state with a "Try again" action, consistent with the dashboard widgets' existing "Failed to load widget / Retry" pattern.

## 3. Org name save doesn't reflect in the sidebar until a full reload

Reproduced: editing org name at `/settings/profile` and saving shows "Organisation name updated," the change **does** persist (confirmed via full page reload), but the sidebar header (top-left org name) keeps showing the old name until a hard navigation. `router.refresh()` is called on success but the sidebar's org name isn't picking up the refreshed data. Find why — likely the layout that supplies `orgName` to `AppSidebar` sits outside what `router.refresh()` re-renders for this route, or `getOrgContext`'s `cache()` wrapper is serving a stale per-request cache across the refresh. Fix so the sidebar updates immediately on save, no reload needed.

## 4. Verify every save/edit path actually persists — do not assume

The org name save above LOOKED broken (stale sidebar) but the underlying save was actually fine — a UI staleness bug, not a data-loss bug. Do not assume the reverse either. For every editable thing in the app, **submit a real change, then hard-reload the page and confirm the new value is there**, not just that a success toast appeared:
- Employee profile edit (personal tab, employment tab) — as an Owner, editing an employee added in M10. Test this specifically; it's new code from this session and was never verified past "the form opens."
- Organisation logo upload.
- Leave request submission and approval/rejection.
- Attendance clock in/out.
- Onboarding task completion.
- Anything else with a save/submit button.

Report explicitly, for each one, whether you reproduced a real persistence bug or confirmed it already works.

## 5. Team Calendar needs to actually look like a calendar

`/[orgSlug]/leave/calendar` currently reads as a plain list — the user's exact words: "it should actually look like a calendar instead of this... it looks kind of unprofessional." Rebuild it as a real month-grid calendar: 7-column week header, weeks as rows, each day cell showing whoever is on leave that day (small avatar/name chips, colour-coded by leave type using the existing leave-type colours), month navigation (prev/next/today), and a sensible empty state for days with nothing. Follow the dataviz skill's component patterns already used elsewhere in this app (check `src/core/ui/charts/` and the existing calendar-adjacent components before inventing new primitives). Keep it laptop-first and touch-friendly per the earlier design system rules — no hover-only affordances, real touch targets on mobile.

## 6. Modern HRMS feature gaps

Bring the existing modules up to what current top-tier ESS/HRMS platforms provide, **without adding whole new modules or infrastructure**. Scope to genuine polish of what exists:
- Notifications: confirm the bell icon in the header actually opens a real notification list backed by real events (leave approved/rejected, onboarding task assigned, document expiring) — not a decorative icon. If it's currently a stub, wire it to real data.
- Org chart / reporting-line view: a simple visual tree of manager → reports, reachable from Employees or Departments — this is a very standard HRMS feature and currently absent.
- Bulk actions on the employees table (the row checkboxes already exist — confirm bulk archive/export actually does something; if the checkboxes are decorative, wire them up).
- Leave calendar (see §5) is itself one of these gaps.

Do not add benefits enrollment, performance reviews, or anything requiring a new data model beyond what's listed above — that's out of scope for this pass.

---

## Rules that still apply

- No emojis. Token-only colours (no hardcoded hex). Every mutation goes through `dbAs()` + `requirePermission`. Every edit of already-audited data writes an audit entry.
- **Every `Promise.all` you write or touch must not combine two queries on the same `tx`.** This is the rule this whole brief exists because of — do not reintroduce it.

## Gate before you report done

`npm test`, `tsc --noEmit`, `eslint .` all clean. Then, against a **real deployed environment or a real local dev server with the actual Supabase database** (not mocks): click every sidebar link, for Owner and Employee roles, in both Northstar Studios and Harbour Logistics. Submit a real save on at least the employee edit form and the org profile form, and confirm persistence after a hard reload. Load the dashboard and the employees list and note whether they feel fast. Report exactly what you changed, file by file, what you tested and its result (not just "should work"), and anything you deliberately left out of scope.
