# ADR-012: Payroll Decimal and Rounding Strategy

**Status:** Accepted

## Context

Payroll calculations involve currency arithmetic. Floating-point numbers (JavaScript's `number` type) cannot accurately represent values like 0.1 + 0.2 (= 0.30000000000000004). Rounding errors accumulate across employees and pay periods, causing discrepancies in financial reports.

## Decision

**Store all monetary values as integer cents.** `gross_pay_cents`, `total_deductions_cents`, `net_pay_cents`, and `amount_cents` (line items) are all `INT` columns. The application performs arithmetic on integers. Display layer divides by 100 for human-readable currency. Rounding is applied only at the final display step, never during intermediate calculations.

## Alternatives Considered

- **DECIMAL/NUMERIC database type** — PostgreSQL handles this well, but JavaScript still uses float for arithmetic. Requires a decimal library (e.g., decimal.js) everywhere.
- **Floating-point with rounding** — error-prone; requires careful rounding at every step; 1-cent discrepancies are common.
- **Decimal.js throughout** — correct but verbose; integer cents is simpler and sufficient for whole-cent currencies.

## Consequences

- Zero floating-point errors in storage and arithmetic
- Simple integer comparison and equality checks
- Works perfectly for currencies with cent subdivisions (USD, EUR, GBP, SGD)
- Display formatting is a pure view concern: `(amountCents / 100).toFixed(2)`
- Validated invariant: `net_pay_cents === gross_pay_cents - total_deductions_cents`

## Risks

- Currencies with non-cent subdivisions (JPY has no decimal; BHD has 3 decimals) need adapter logic (mitigated: V1 targets cent-based currencies; add multiplier config later)
- Developers accidentally storing dollars instead of cents (mitigated: naming convention `_cents`, code review, validation)

## Revisit Conditions

- If supporting currencies with 0 or 3 decimal places (add per-currency multiplier)
- If sub-cent precision is needed for tax calculations (switch to DECIMAL with 4 places)
