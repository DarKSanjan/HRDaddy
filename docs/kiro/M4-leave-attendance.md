# kiro brief — M4 + M5: Leave and Attendance

Two modules in one pass — they share a calendar and a working-day calculator, so building them together avoids duplicating that logic.

**Read first:** the M3 brief's "Rules that apply to every module" — they apply here unchanged. Also `docs/superpowers/specs/2026-07-25-hrdaddy-design.md` §7 for Singapore statutory entitlements.

---

## Shared: working-day service — `src/core/calendar/`

Both modules need this, so build it once, in the kernel.

- `isWorkingDay(date, orgSettings, holidays)` — respects the org's configured working days.
- `countWorkingDays(start, end, orgSettings, holidays)` — the basis of every leave calculation.
- Singapore public holidays for 2026 and 2027 as a **versioned fixture**, same pattern as the CPF rate tables: `effectiveYear`, source, and editable per organisation.
- All date maths in the **organisation's timezone**, not the server's and not the browser's. Use `date-fns` + `@date-fns/tz`, both already installed.

Test across DST boundaries even though Singapore has none — an org in another timezone will hit them, and this code will be reused.

---

## M4: Leave — `/[orgSlug]/leave`

### Entitlements (Singapore, MOM)
Annual leave **7 days after 1 year of service, +1 per additional year, capped at 14**, pro-rated for incomplete years. Outpatient sick 14. Hospitalisation 60, **inclusive of** the 14. Maternity 16 weeks. Paternity 4 weeks. Childcare 6 days.

The service-year calculation is the subtle part: entitlement changes on each work anniversary, so a leave year spanning an anniversary is not a single flat allowance. Test it directly.

### Requests
Submit with type, date range, optional half-day (AM/PM), reason, optional attachment. On submit:
- Reject **overlapping** requests against the employee's own pending or approved leave.
- Reject **insufficient balance** unless the policy allows negative.
- Compute `totalDays` via `countWorkingDays` — weekends and public holidays inside a range are not deducted.
- Balance moves to `pending`, not `used`, until approved. Approval moves pending→used. Rejection or cancellation releases it.

### Approval
Manager inbox at `/[orgSlug]/leave/approvals`. A manager may only approve **their own reports** — verify the reporting relationship server-side, not from the request. HR with `leave.request.approve` may override. Approving must be **idempotent under concurrency**: two managers hitting approve simultaneously must not double-deduct. Use a conditional update on the current status and test it.

Employee may withdraw while pending, cancel after approval (subject to policy). Every transition writes an audit event and notifies the counterparty.

### Views
Personal balances with a breakdown per type. Request history. Team calendar showing who is away — month view, colour by leave type using the validated chart palette from `src/core/ui/charts`, never raw hex.

---

## M5: Attendance — `/[orgSlug]/attendance`

### Clock in/out
One prominent control showing current state and elapsed time. Rules:
- **No double clock-in.** A second clock-in without a clock-out is rejected, not silently accepted.
- **Overnight shifts** — clock in 23:00, out 07:00 — belong to the *start* date and compute 8h, not negative.
- Missing clock-out: a session still open after the org's configured cutoff is flagged `MISSING_CLOCK_OUT` rather than silently accruing hours forever.
- `OFFICE` or `REMOTE`.
- All timestamps stored UTC, displayed in org timezone. Getting this wrong is the classic bug — test a clock-in at 23:30 SGT and confirm it lands on the right local date.

### History and corrections
Personal history with a monthly summary: days present, total hours, average start/end, late arrivals against configured hours. HR with `attendance.correct` may correct a record; a **reason is mandatory**, the original values are preserved in the audit `before`, and the employee is notified. Corrections are never silent.

Team view for managers, scoped to direct reports. CSV export.

---

## Tests

Unit: working-day counting across weekends and holidays; service-year entitlement at and around anniversaries; overlap detection including partial and half-day; balance transitions; overnight shift duration; double clock-in rejection; timezone boundary cases.

Integration: concurrent approval deducts once; cross-tenant leave invisible; a manager cannot approve a non-report; corrections write `before`/`after` audit.

E2E: employee submits leave → manager approves → balance updates and employee sees it. Clock in → clock out → history shows the session.

---

## Definition of done

All gates clean. Both modules work against the live database, enforce permissions server-side, write audit events, and are verified in a browser at 1440×900 in both themes.
