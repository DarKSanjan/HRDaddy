# ADR-008: Attendance Timezone Strategy

**Status:** Accepted

## Context

Organisations operate in specific timezones but employees may clock in from different locations. Attendance records must be unambiguous, sortable, and correctly assigned to business days. Timezone handling is a common source of bugs.

## Decision

**Store all timestamps in UTC; display in the organisation's configured timezone.** The `clock_in` and `clock_out` fields are `TIMESTAMP WITH TIME ZONE` (always UTC in storage). A `session_date` field records which business day the session belongs to (the date in org timezone at clock-in time). Display layer converts UTC to org timezone using the IANA timezone from OrganisationSettings.

## Alternatives Considered

- **Store in org timezone** — breaks if org changes timezone; ambiguous during DST transitions; prevents global reporting.
- **Store in employee's local timezone** — inconsistent across the org; makes team reporting complex.
- **Store offset alongside timestamp** — redundant with TIMESTAMP WITH TIME ZONE; adds complexity without benefit.

## Consequences

- No timezone ambiguity in stored data; UTC is absolute
- `session_date` enables fast date-based queries without timezone conversion in SQL
- Overnight shifts (clock-in before midnight, clock-out after) correctly belong to the clock-in date
- If org changes timezone, historical records remain correct (they're UTC)

## Risks

- Developer displaying raw UTC to users without conversion (mitigated: utility function `toOrgTimezone()` used in all display components)
- DST transitions causing "missing hour" or "duplicate hour" in local display (mitigated: IANA timezone library handles DST correctly)

## Revisit Conditions

- If multi-timezone organisations need per-employee timezone support
- If international compliance requires storing the local timezone offset alongside UTC
