# ADR-018: Singapore Statutory Data as Versioned Rate Tables

**Status:** Accepted

## Context

HR Daddy's payroll module implements Singapore CPF (Central Provident Fund) contribution calculations and MOM (Ministry of Manpower) leave entitlement rules. These statutory rates change periodically — CPF rates are revised by the CPF Board (most recently effective 1 January 2026), and leave entitlements are defined by the Employment Act. Hard-coding these values as inline constants in calculation logic means every rate change requires touching business logic code, with the attendant risk of introducing bugs.

## Decision

Statutory data is stored as **versioned, dated data files** rather than inline constants:

- **CPF contribution rates** live in `src/modules/payroll/rates/cpf-YYYY-MM-DD.ts` (e.g. `cpf-2026-01-01.ts`). Each file exports a `CpfRateFixture` containing: effective date, source URL, source SHA-256 (for auditability), ordinary wage ceiling ($8,000/month), annual ceiling ($102,000), and rate tables for all 5 residency/PR-year combinations, each with 5 age bands. The `graduatedK` multiplier handles the $500–$750 wage band graduated contribution.
- **Rate fixture selection** (`src/modules/payroll/rates/index.ts`) picks the applicable fixture by finding the latest `effectiveFrom` that is ≤ the pay period date.
- **MOM annual leave entitlement** (`src/core/calendar/index.ts` → `sgAnnualLeaveEntitlement()`) implements the Employment Act formula: 7 days after 1 completed year of service, +1 per additional year, capped at 14 days. This is consumed by `src/core/leave/balances.ts` which calculates tenure via `completedYearsOfService()` and pro-rates for the joining year at half-day granularity.

The **PR-year-anniversary CPF quirk**: a Permanent Resident employee's contribution table changes on their PR anniversary date (Year 1 → Year 2 → full rates at Year 3+), which does not align with calendar years. The rate fixture stores separate tables per PR year, and the calculation logic selects based on `prStartDate` + `prArrangement` (graduated/graduated or full/graduated).

## Alternatives Considered

- **Inline constants in calculation functions** — fast to implement but rate changes require modifying logic code; no audit trail of which rates applied to a historical payslip.
- **Database-stored rates** — maximum flexibility but adds schema complexity, migration burden, and makes it harder to code-review rate changes.
- **External API (CPF Board)** — no official programmatic API exists; web-scraping is fragile and introduces a runtime dependency.

## Consequences

- A CPF rate change is a new file + one-line addition to the fixture selector; calculation logic is untouched.
- Historical payslips remain reproducible: the fixture that was effective at the pay period date is deterministic.
- Source URL and SHA-256 provide an audit trail back to the published rate table.
- The `serviceBased` flag on `LeavePolicy` triggers the MOM entitlement formula; non-service-based policies use a flat `defaultAllowance`.
- Pro-rating at half-day granularity matches how leave is booked in the system (half-day leave is supported).

## Risks

- If CPF introduces mid-year rate changes (rare but possible), a single `effectiveFrom` date is sufficient — just add another fixture file.
- The PR-anniversary logic relies on `prStartDate` being correctly recorded on the employee record; a missing date defaults to full rates (conservative).

## Revisit Conditions

- If HR Daddy expands to multiple jurisdictions, requiring a generalised statutory-data framework rather than Singapore-specific files.
- If CPF Board publishes a machine-readable rate API.
- If the number of historical rate files exceeds ~10 and a database-backed approach becomes more maintainable.
