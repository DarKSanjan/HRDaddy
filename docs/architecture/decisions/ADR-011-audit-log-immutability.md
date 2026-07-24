# ADR-011: Audit Log Immutability

**Status:** Accepted

## Context

Audit logs must provide a tamper-proof record of all administrative actions for compliance, dispute resolution, and security investigation. If audit records can be modified or deleted through the application, they lose their evidentiary value.

## Decision

**Append-only audit log with no application-level delete.** The `AuditLog` table only supports INSERT operations from the application. The application database user has `REVOKE UPDATE, DELETE ON audit_log` at the PostgreSQL level. No API endpoint, server action, or background job can modify or remove audit entries. The AuditService exposes only `record()` and `query()` methods.

## Alternatives Considered

- **Soft-delete with retention** — allows "hiding" records which defeats the purpose of immutability.
- **External audit service** — adds deployment dependency and network latency; overkill for V1.
- **Blockchain-backed audit** — absurd complexity for an SME HR tool.
- **Application-level restriction only** — a compromised app could still delete records; DB-level REVOKE is stronger.

## Consequences

- Audit records are trustworthy — even a compromised application cannot delete history
- Storage grows indefinitely (mitigated: audit records are small JSONB; typical org generates < 1GB/year)
- Data correction requires DBA access with elevated privileges (by design — this is an exceptional operation)
- Queries must be efficient despite unbounded table growth (indexed on org_id + created_at DESC)

## Risks

- Unbounded table growth in very active organisations (mitigated: partitioning by month if needed)
- GDPR "right to erasure" may conflict with indefinite retention (mitigated: audit records store entity IDs, not full PII; PII deletion from source tables is itself audited)

## Revisit Conditions

- If regulatory requirements mandate audit log deletion after a specific period
- If table size impacts query performance (add partitioning)
- If external compliance tools require audit export in specific formats
