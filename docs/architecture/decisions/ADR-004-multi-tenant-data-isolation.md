# ADR-004: Multi-Tenant Data Isolation

**Status:** Accepted

## Context

HR Daddy supports multiple organisations in a single database. Cross-tenant data leakage is a critical security risk — one organisation must never see another's employees, payroll, or documents. The isolation strategy must be simple to implement correctly and hard to bypass accidentally.

## Decision

Use **organisation_id column on every tenant-owned table** combined with **middleware-enforced context injection**. The organisation_id comes exclusively from the authenticated session, never from client input. A `TenantScopedRepository` base class automatically includes `organisationId` in all WHERE clauses. Cross-tenant access returns 404, not 403.

## Alternatives Considered

- **Schema-per-tenant** — strong isolation but impractical for schema migrations across hundreds of tenants; connection pool explosion.
- **Database-per-tenant** — strongest isolation but operational nightmare for a self-hosted product.
- **Row-Level Security (RLS)** — PostgreSQL-native but tightly couples app to DB engine; harder to test; error messages less descriptive.

## Consequences

- Simple to understand and implement: every query has `WHERE organisation_id = ?`
- Single schema, single migration path, single connection pool
- Defence in depth: middleware + repository layer + NOT NULL constraint
- Cross-tenant attempts appear as 404 (no information leakage)

## Risks

- Developer forgetting org_id in a raw query (mitigated: repository base class, code review, automated tests)
- Background jobs processing wrong tenant (mitigated: explicit context injection, per-org iteration)

## Revisit Conditions

- If regulatory requirements demand physical data separation (healthcare, government)
- If a single tenant's data volume significantly impacts other tenants' query performance
