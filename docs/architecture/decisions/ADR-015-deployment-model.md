# ADR-015: Deployment Model

**Status:** Accepted

## Context

HR Daddy targets self-hosted SME environments. The deployment must be simple enough for a non-DevOps person to run, yet production-ready. Complex orchestration (Kubernetes, multi-region) is inappropriate for V1's target audience.

## Decision

**Docker Compose with a single application container, PostgreSQL, and optional background worker.** The application runs as one Next.js container serving both SSR and API. PostgreSQL runs alongside in its own container. File storage uses a Docker volume. A reverse proxy (Caddy) handles TLS termination. Background jobs run in the same image with a different entrypoint.

## Alternatives Considered

- **Bare metal (no containers)** — harder to reproduce, dependency conflicts, no isolation.
- **Kubernetes** — massively over-engineered for a single-org self-hosted deployment.
- **Platform-as-a-Service (Vercel/Railway)** — incompatible with self-hosted requirement; vendor lock-in.
- **Multi-container microservices** — unnecessary complexity for V1's scope.

## Consequences

- `docker compose up` is the entire deployment command
- Single `.env` file configures everything
- Database migrations run at container startup
- Horizontal scaling requires moving to a managed database + load balancer (future)
- Backups are straightforward: pg_dump + volume tar

## Risks

- Single container is a single point of failure (mitigated: Docker restart policies; acceptable for SME use)
- Vertical scaling limited to single machine (mitigated: PostgreSQL and storage can be externalised independently)

## Revisit Conditions

- If managed hosting offering requires multi-tenant horizontal scaling
- If background job volume requires a dedicated queue system (Redis + Bull)
- If zero-downtime deployments are required (add blue-green or rolling update)
