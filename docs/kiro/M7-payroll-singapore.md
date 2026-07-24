# kiro brief — M7: Payroll with Singapore CPF

**This module computes real statutory figures for real companies.** Wrong numbers mean real penalties. Precision here matters more than speed, and every rule below is sourced from CPF Board or MOM.

**Read first:** `docs/superpowers/specs/2026-07-25-hrdaddy-design.md` §7 and §8 (full rate tables and the computation order), and `docs/reference/statutory/singapore/CPF-contribution-rates-2026-01-01.pdf` (authoritative source, all five tables). Plus the M3 brief's "Rules that apply to every module".

---

## 1. Rate fixtures — data, not code

`src/modules/payroll/rates/cpf-2026-01-01.json`, carrying `effectiveFrom`, the source URL, and a SHA-256 of the source PDF.

**Select the fixture by pay-period date, never by today's date.** A payslip generated for March 2026 must reproduce identically when regenerated in 2028. That is the entire reason these are versioned.

Encode all five tables from the PDF:
1. Citizens and PR 3rd year onward
2. PR year 1, Graduated/Graduated
3. PR year 2, Graduated/Graduated
4. PR year 1, Full employer / Graduated employee
5. PR year 2, Full employer / Graduated employee

Each with the five age bands (≤55, >55–60, >60–65, >65–70, >70) and the wage bands (≤$50 nil; >$50–500 employer only; >$500–750 graduated phase-in; >$750 full rates), plus the max-contribution caps.

---

## 2. The calculation — order is prescribed and easy to get wrong

```
1. total    = round_half_up(rate_total    × wages)   → nearest dollar
2. employee = floor(rate_employee × wages)           → drop cents
3. employer = total − employee                       → RESIDUAL
```

**The employer share is a residual.** Never compute it independently — independently rounding both shares does not reconcile against the total, and the difference is real money.

Ceilings: Ordinary Wage **$8,000/month**. Annual **$102,000** for OW + AW combined. Additional Wage ceiling = `102,000 − OW subject to CPF year-to-date`, so the module must track YTD OW per employee.

When both OW and AW are payable in the same month, compute CPF on each separately, sum, then apply rounding to the result.

CPF applies to **Singapore Citizens and PRs only** — foreigners on work passes are excluded entirely. Employee residency status and PR start date therefore have to exist on the employee record; add them if absent.

---

## 3. Payslips — 12 mandatory items, enforced

Per the Employment (Employment Records, Key Employment Terms and Pay Slips) Regulations 2016:

employer name · employee name · date of payment · basic salary · salary period (start and end) · allowances (fixed and ad-hoc) · additional payments (bonus, rest-day, public-holiday) · deductions (fixed and ad-hoc) · overtime hours · overtime pay · overtime period if it differs from the salary period · net salary

Implement as a Zod schema. **A payslip cannot publish unless all twelve validate.** Not a warning — a hard block.

No-pay leave and absences must appear as **separate itemised deduction lines** showing days and amounts. Silently reducing gross salary produces a non-compliant payslip.

Retention: 2 years for current employees, 1 year after departure.

---

## 4. Workflow

Periods (`DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED → PAID`, with an audited `REOPENED`). Per-employee records with earning/allowance/deduction line items. Pull basic salary from the employee record; optionally pull overtime from attendance if that module is enabled.

**Published payslips are immutable.** Correction requires an explicit, audited reopen. Employees see only their own, and only once published.

Approval requires `payroll.approve`; `payroll.view_all` is sensitive and excludes managers.

---

## 5. Disclaimer — required

On the payroll module and on every generated payslip:

> Figures are computed from configured statutory rate tables. This is not tax advice. Verify before filing.

---

## 6. Tests — the most important part of this module

**Reproduce CPF Board's own published worked examples.** Build fixtures from them; a rate table that fails to reproduce them fails the build.

Cover explicitly: each age band boundary (exactly 55, 60, 65, 70 — check whether the boundary is inclusive and match the table); each wage band boundary ($50, $500, $750); the $8,000 OW ceiling; AW ceiling with YTD OW already consumed; all three PR arrangements; a foreigner (zero CPF); the rounding order, with a case where computing the employer share independently gives a different answer than the residual — that test is the guard against the most likely regression.

Integration: publishing without all 12 items is rejected; a published payslip cannot be mutated; reopen is audited; an employee cannot read another's payslip.

---

## Definition of done

All gates clean. Official worked examples reproduce exactly. Disclaimer present. Verified in a browser at 1440×900 in both themes.
