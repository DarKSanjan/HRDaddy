# ADR-002: Database and ORM

**Status:** Accepted

## Context

HR Daddy requires relational integrity (foreign keys, unique constraints, transactions), complex queries (reporting, joins, aggregations), and strong data consistency guarantees. The data model includes 25+ entities with relationships.

## Decision

Use **PostgreSQL** as the primary database and **Prisma** as the ORM. PostgreSQL provides JSONB for flexible fields, partial indexes for soft-delete patterns, and row-level security capabilities. Prisma provides type-safe queries, schema-as-code migrations, and a clear mental model for the team.

## Alternatives Considered

- **MySQL** — lacks partial indexes and JSONB quality. Less capable for complex constraints.
- **MongoDB** — no relational integrity; tenant isolation harder to enforce; joins require application logic.
- **Drizzle ORM** — thinner abstraction, better raw SQL access, but less mature migration tooling and ecosystem.
- **TypeORM** — larger API surface, more bugs, decorator-heavy patterns.

## Consequences

- Schema changes are version-controlled via Prisma Migrate
- Type-safe database access reduces runtime errors
- Prisma's query engine adds a small abstraction cost; complex queries may need `$queryRaw`
- All monetary values stored as integer cents to avoid floating-point issues

## Risks

- Prisma connection pooling limits under high concurrency (mitigated: PgBouncer if needed)
- Prisma's generated client is large; cold starts may be slower in serverless (not relevant for Docker deployment)

## Revisit Conditions

- If query performance requires hand-optimised SQL beyond Prisma's capabilities
- If Prisma's migration tooling proves unreliable for production schema changes
- If the project moves to edge/serverless deployment where Prisma's engine is problematic
