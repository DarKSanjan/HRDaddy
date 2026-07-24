# ADR-001: Application Architecture

**Status:** Accepted

## Context

HR Daddy V1 needs an architecture that supports rapid development, clear module boundaries, server-side rendering for SEO and performance, and deployment simplicity for self-hosted SME environments. The team is small and cannot maintain multiple services.

## Decision

Use **Next.js App Router** as a modular monolith. Organise code into domain modules (auth, employee, leave, attendance, onboarding, documents, payroll, notifications, audit) with clear boundaries: each module owns its services, repositories, server actions, and route segments. Cross-module communication happens through direct function calls within the same process.

## Alternatives Considered

- **Separate backend (Express/Fastify) + React SPA** — doubles deployment surface, adds API serialization overhead, and requires separate auth handling. Rejected for V1 complexity.
- **Microservices** — excessive for a small team and SME target. Network boundaries add latency, deployment complexity, and distributed transaction problems.
- **Remix** — viable but smaller ecosystem, less corporate adoption, fewer hosting options for self-hosted environments.

## Consequences

- Single deployable artifact simplifies Docker-based self-hosting
- Server actions eliminate boilerplate API layer for internal mutations
- Module boundaries are conventions (directories), not enforced by runtime — requires discipline
- Tight coupling risk if modules bypass service boundaries

## Risks

- Next.js vendor lock-in for rendering layer (mitigated: business logic is framework-agnostic in service layer)
- App Router is relatively new; some patterns still evolving

## Revisit Conditions

- If team grows beyond 5 engineers working concurrently on different modules
- If a module needs independent scaling (e.g., payroll processing becomes compute-heavy)
- If Next.js App Router proves unstable for production workloads
