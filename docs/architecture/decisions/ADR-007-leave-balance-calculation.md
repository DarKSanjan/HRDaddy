# ADR-007: Leave Balance Calculation Strategy

**Status:** Accepted

## Context

Leave balances can be tracked in two ways: calculated from request history on every read, or maintained as a running counter updated on state transitions. The system must handle concurrent approvals, cancellations, and balance corrections without data corruption.

## Decision

**Deduct balance on approval, restore on cancellation.** Maintain a `LeaveBalance` record per employee per leave type per year with fields: `entitlement`, `used`, `pending`, `carry_over`. On submission, increment `pending`. On approval, decrement `pending` and increment `used`. On cancellation/withdrawal, decrement `pending` (if pending) or decrement `used` and restore (if approved). Use optimistic locking on LeaveRequest to prevent double-approval.

## Alternatives Considered

- **Calculate from history on every read** — simple model but expensive for dashboards with many employees; race conditions on concurrent submissions.
- **Reserve balance on submission** — similar to chosen approach but "reserve" vs "pending" is a naming distinction. We chose "pending" as the counter name.
- **Event-sourced balance** — rebuild from event stream. Over-engineered for V1; adds read model complexity.

## Consequences

- Balance reads are O(1) — direct field lookups, no aggregation
- Concurrent approval/cancellation is safe with optimistic locking
- Balance recalculation command exists for corrections or policy changes
- Half-day leave deducts 0.5 (DECIMAL field)

## Risks

- Balance drift if a transaction partially fails (mitigated: balance update within same DB transaction as status change)
- Complex undo logic for edge cases like approved leave for deactivated employee (mitigated: deactivation cancels pending leave in one transaction)

## Revisit Conditions

- If accrual-based systems need real-time balance that factors mid-month pro-rata
- If balance disputes require a full audit trail of every mutation (add balance history table)
