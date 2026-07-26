# M12 — Shift Templates, Overtime Pay, Compliance Extension Point

## Why

Owner wants: per-role default shift timing (e.g. an "Intern" employment type defaults to 10am–6pm, prefilled when you create an employee of that type, overridable per employee), overtime pay for hours beyond the shift / working weekends, and "late" / "did they work their full shift" visibility in the new attendance dashboard (separate M13 item, but depends on the shift baseline this milestone creates).

Also: the codebase is Singapore-only today (CPF is hardcoded). Owner wants future countries to be addable as expansion modules without rewriting the payroll engine. This milestone must leave that seam in place — **do not build a second country now**, just make sure Singapore's logic sits behind an interface a second country could implement later.

## Current state (verified by reading the code, not assumed)

- `Employee.compensationAmountCents` is currently *always* treated as a flat per-period salary — `src/modules/payroll/actions.ts` reads it straight into `grossAmountCents`. There is no hourly concept anywhere.
- `AttendanceRecord` has `clockIn`/`clockOut`/`durationMinutes` but nothing to compare against — no shift, no expected start time.
- `OrganisationSettings` already has `workingHoursStart`/`workingHoursEnd` (default `"09:00"`/`"17:00"`) — this is the org-wide fallback baseline, already exists, do not duplicate it.
- `PayrollLineItemType` enum (`prisma/schema/_base.prisma`) has `EARNING | ALLOWANCE | DEDUCTION` — no `OVERTIME`.
- CPF engine (`src/modules/payroll/cpf/calculate.ts`) already takes `owCents` (Ordinary Wage) and `awCents` (Additional Wage) as separate inputs and applies separate ceilings to each — the OW/AW split this milestone needs is already a first-class concept in that engine, it just needs the right number fed into the right bucket.

## Singapore compliance rules for overtime — research this milestone must follow

Two separate regulators, two separate rulesets. Get both right.

**MOM (Ministry of Manpower) — Employment Act Part IV, statutory overtime pay:**
- Only applies to employees within Part IV's scope: "workmen" earning ≤$4,500/month basic, and other (non-workman) employees earning ≤$2,600/month basic. Employees above these thresholds are NOT statutorily entitled to OT pay — the Act simply doesn't reach them. An org can still choose to pay OT above these thresholds as a contractual matter; the system must not silently deny that, just not pretend it's a legal minimum for that employee.
- Statutory OT rate: **at least 1.5× the hourly basic rate** for hours beyond normal working hours.
- Hourly basic rate formula (MOM-prescribed): `(12 × monthly basic salary) / (52 × 44)`. Only *basic* salary goes into this — not allowances.
- Statutory OT cap: **72 hours per month**. Flag when an employee crosses this so the org sees it, don't silently truncate their pay.
- Work on a rest day and work on a public holiday are **not** simple hourly multiples — MOM uses lump-sum-per-day rules there (e.g. rest-day work at employer's request for ≤half a normal day = 1 extra day's pay; more than half a day = 2 days' pay) that are genuinely more involved than "hours × multiplier". **Do not fake this as `hours × 2.0`.** For this milestone, implement straightforward weekday-overtime pay correctly per the 1.5× formula above, and for rest-day/public-holiday work, still flag and record the extra hours worked and let the org configure a rest-day day-rate multiplier they apply manually per pay run (i.e. surfaced as data + a configurable multiplier, not a hardcoded formula claiming to be MOM-exact) — noting in the UI that rest-day/PH pay should be double-checked against MOM's rules for that employee's contract. Do not claim full statutory compliance on the rest-day/PH case; do claim it on the weekday-OT case.

**CPF Board — is OT pay Ordinary Wage or Additional Wage:**
- A wage is OW for a month only if (a) it's due/granted wholly and exclusively for that month's employment, and (b) it's paid by the 14th of the following month. Otherwise it's AW.
- Overtime pay **is explicitly named by CPF Board as an OW example** — provided it's paid within that same-month-or-by-14th-next-month window. Since this app runs payroll per period and pays out promptly, OT computed and paid within the normal payroll run for the month it was earned classifies as **OW**, not AW. Only OT that ends up paid late (a following period, after the 14th) would need to be reclassified as AW for that later period — flag this as a known edge case in code comments, don't need to build a full remediation flow for it this milestone.
- Practically: feed the computed OT cents into the existing `owCents` input to `computeCpf()`, not `awCents`. Do not touch the CPF calculation engine itself (`calculate.ts`) — it already handles OW correctly, this is purely about what number goes into `owCents` before calling it.

Sources — hand these to whoever verifies the numbers, don't take my summary as gospel: MOM overtime pay guidance (mom.gov.sg), CPF Board's OW/AW guidance (ask.gov.sg/cpf), and cross-referenced against DollarsAndSense's and Talenox's practitioner explainers of the same rules, all of which agree on the same 1.5×, 72-hour cap, and OW-if-paid-on-time points.

## Schema changes

Add to `prisma/schema/employees.prisma` (or a new `prisma/schema/shifts.prisma` if that reads cleaner — your call):

```prisma
model ShiftTemplate {
  id                        String   @id @default(cuid())
  orgId                     String   @map("org_id")
  name                      String
  startMinutes              Int      @map("start_minutes")   // minutes from midnight, e.g. 540 = 09:00
  endMinutes                Int      @map("end_minutes")
  standardMinutesPerDay     Int      @map("standard_minutes_per_day")
  overtimeMultiplier        Decimal  @default(1.5) @db.Decimal(3, 2) @map("overtime_multiplier")
  restDayMultiplier         Decimal  @default(2.0) @db.Decimal(3, 2) @map("rest_day_multiplier")
  isArchived                Boolean  @default(false) @map("is_archived")
  createdAt                 DateTime @default(now()) @map("created_at")

  organisation      Organisation     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  employmentTypes   EmploymentType[]
  employees         Employee[]

  @@index([orgId])
  @@map("shift_templates")
}
```

- Use minutes-from-midnight ints, not strings — comparing "09:00" as a string works by luck, comparing ints is correct and matches what `OrganisationSettings.workingHoursStart` should probably have been (leave that field alone though, out of scope, just don't copy its stringly-typed pattern here).
- `EmploymentType.defaultShiftTemplateId String? @map("default_shift_template_id")` + relation — this is the "roles for interns/freelancers get a default shift" piece.
- `Employee.shiftTemplateId String? @map("shift_template_id")` + relation — per-employee override, nullable, falls back to `employmentType.defaultShiftTemplateId`, which falls back to `OrganisationSettings.workingHoursStart/End` if neither is set (existing field, already has a default).
- `Employee.payType PayType @default(SALARIED) @map("pay_type")` where `enum PayType { SALARIED HOURLY }` in `_base.prisma`.
- Add `OVERTIME` to `PayrollLineItemType` enum in `_base.prisma`.
- Add `countryCode String @default("SG") @map("country_code")` to `OrganisationSettings` — this is the whole ask for the "future countries as expansion modules" seam. One field, defaulting to what's already true today. Nothing else about multi-country needs to exist yet.

Run the migration, don't hand-edit the generated client.

## Compliance extension point (the seam, not a rewrite)

Do not restructure the existing CPF code. Add a thin interface next to it:

`src/modules/payroll/compliance/types.ts`:
```ts
export interface PayrollComplianceProvider {
  countryCode: string
  /** Statutory contribution engine (CPF for SG) */
  computeStatutoryContribution(input: /* existing CpfComputeInput shape */): /* existing CpfResult shape */
  /** Is this employee within scope for statutory OT pay (e.g. MOM Part IV thresholds)? */
  isOvertimeEligible(basicMonthlyCents: number, isWorkman: boolean): boolean
  /** MOM-prescribed hourly rate derivation from monthly basic */
  hourlyRateFromMonthlyCents(monthlyCents: number): number
  /** OW vs AW classification for a wage component paid in a given period relative to when it was earned */
  classifyWageTiming(earnedPeriodEnd: Date, paidDate: Date): 'OW' | 'AW'
}
```

`src/modules/payroll/compliance/sg.ts` — implements the above by calling into the existing `cpf/calculate.ts` for `computeStatutoryContribution`, and encodes the MOM thresholds/formula/72hr-cap and the CPF OW/AW same-month rule described above for the other three methods. This file is the only place that should know the numbers `4500`, `2600`, `1.5`, `72`, `44`, `52`, `14`.

`src/modules/payroll/compliance/index.ts` — `getComplianceProvider(countryCode: string): PayrollComplianceProvider`, returns the SG implementation for `'SG'`, throws a clear "not supported yet" error for anything else. That's it — no second country, just a single lookup function so adding one later means writing a new file and adding one case, not touching the payroll engine or the attendance/overtime calculation code that calls this interface.

Everywhere in `payroll/actions.ts` / `payroll/queries.ts` that currently calls `computeCpf(...)` directly or reasons about SG-specific numbers, go through `getComplianceProvider(org.countryCode)` instead.

## Attendance changes

`src/modules/attendance/queries.ts` / a new helper — given an employee's effective shift (their own `shiftTemplateId`, else their `employmentType.defaultShiftTemplateId`, else derive one from `OrganisationSettings.workingHoursStart/End` with a sane default `standardMinutesPerDay` of 480), compute per attendance record:
- `lateMinutes` — clock-in minus shift start, floored at 0.
- `undertimeMinutes` — shift standard minutes minus worked duration, floored at 0 (only meaningful once clocked out).
- `overtimeMinutes` — worked duration beyond shift standard minutes, floored at 0. Separately flag whether the date is a rest day (use `OrganisationSettings.workingDays` — already exists, already tells you which weekdays are working days) so weekday-OT and rest-day-OT are distinguishable downstream.

Don't add a migration column for these — compute them at query time from `clockIn`/`clockOut`/`durationMinutes` + the resolved shift, same pattern as everything else in this codebase that derives rather than stores.

## Payroll changes

- For `payType: HOURLY` employees, gross pay for a period is computed from summed attendance hours in that period × their `compensationAmountCents` (now treated as an hourly rate in cents) — not the current flat "compensationAmountCents = the whole period's pay" logic.
- For `payType: SALARIED` employees (existing behavior unchanged), additionally sum any `overtimeMinutes` accrued in the period, convert to cents via the compliance provider's `hourlyRateFromMonthlyCents`, multiply by their shift's `overtimeMultiplier` (or `restDayMultiplier` for rest-day hours), and add as a new `PayrollLineItem` with `type: OVERTIME`. Feed this amount into `owCents` before calling `computeStatutoryContribution` — do not add it as AW.
- Gate the overtime-pay line item behind `getComplianceProvider(org.countryCode).isOvertimeEligible(...)` for employees above the MOM thresholds — still show the worked OT hours/flag it in the UI for those employees (owner may pay it anyway by policy), just don't label it as statutory in the breakdown for someone outside Part IV scope.

## New-employee form

When creating/editing an employee: selecting an Employment Type looks up its `defaultShiftTemplateId` and prefills the shift-template picker (and pay type, if the employment type conventionally implies one — e.g. an org might want "Freelance" to default to `HOURLY`; that's a UI default only, not a hard rule the schema enforces). User can change it per employee same as any other prefilled field in this app.

## Settings

Org settings (or a new "Shift Templates" admin page under Employees settings, whichever fits the existing settings nav better — check `src/app/(dashboard)/[orgSlug]/settings/` for the existing pattern) needs basic CRUD for `ShiftTemplate`: name, start/end time, standard hours, the two multipliers. This is what lets the owner "create roles for interns/freelancers" with their own default timing, per their own words.

## Explicitly out of scope this milestone

- A second country's compliance module. The seam is the deliverable, not a second implementation.
- Exact MOM rest-day/public-holiday lump-sum pay formulas — flagged above, deliberately simplified with a visible caveat rather than faked as precise.
- Any "DLC" / vertical-specific modules (tuition center, etc.) — unrelated future idea, do not touch.
- Rewriting the CPF engine — it's correct, leave it, just route calls through the new interface.

## Verification checklist (for whoever reviews this before it ships)

1. `tsc --noEmit`, `eslint`, `vitest run` all clean.
2. Migration applies cleanly against the dev DB, existing seed data still loads.
3. Create an Employment Type with a default shift template, create a new Employee under it, confirm the shift prefills and is editable.
4. Clock in "late" against a test employee's shift, clock out past standard hours, confirm `lateMinutes`/`overtimeMinutes` show correctly wherever attendance is surfaced.
5. Run payroll for a period containing a flagged-OT employee, confirm an `OVERTIME` line item appears with the right cents, and that it landed in `owCents` (not `awCents`) going into the CPF calc — verify by reading the actual DB row, not just the UI.
6. Confirm an employee above the MOM Part IV threshold does NOT get an OT line item auto-labeled statutory (per the eligibility gate above).
