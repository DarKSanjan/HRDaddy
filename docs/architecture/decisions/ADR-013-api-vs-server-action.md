# ADR-013: API vs Server Action Boundaries

**Status:** Accepted

## Context

Next.js App Router provides two mechanisms for server-side logic: server actions (form mutations callable directly from components) and API routes (traditional HTTP endpoints). Both have different trade-offs for security, caching, and external consumption.

## Decision

**Server actions for all internal mutations; API routes for external/programmatic access.** Internal UI operations (create employee, approve leave, clock in) use server actions — they get automatic CSRF protection, type-safe arguments, and progressive enhancement. API routes (`/api/v1/...`) are reserved for: health checks, webhook receivers, and future external integrations.

## Alternatives Considered

- **API routes for everything** — consistent but loses server action benefits (automatic CSRF, progressive enhancement, co-location with UI).
- **Server actions for everything** — not callable from external clients; no standard REST interface for integrations.
- **tRPC** — type-safe RPC layer but adds dependency, own patterns, and complexity for a team already using server actions.

## Consequences

- Internal mutations are co-located with their forms (excellent DX)
- CSRF protection is handled automatically by Next.js for server actions
- External API surface is minimal in V1 (health, webhooks)
- Future API expansion adds routes without changing internal mutation patterns

## Risks

- Server actions are relatively new; edge cases in error handling and caching still being discovered
- Mixing patterns could confuse contributors (mitigated: clear convention — if it's from the UI, it's a server action)

## Revisit Conditions

- If a mobile app or third-party integration needs a full REST/GraphQL API
- If server actions prove problematic for complex multi-step mutations
- If real-time features require WebSocket endpoints alongside server actions
