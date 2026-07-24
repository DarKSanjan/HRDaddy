# ADR-003: Authentication Strategy

**Status:** Accepted

## Context

HR Daddy handles sensitive employee data (compensation, national IDs, bank details). Authentication must be secure, support multi-organisation context, and work with server-rendered pages. The platform is self-hosted, so external OAuth providers cannot be assumed.

## Decision

Use **session-based authentication with httpOnly cookies**. Sessions are stored in the database for revocability. Passwords are hashed with bcrypt (cost 12). Sessions carry userId and organisationId. CSRF protection via double-submit cookie pattern.

## Alternatives Considered

- **JWT tokens** — stateless but not revocable without a blocklist (which becomes stateful anyway). Token size grows with claims. Cannot invalidate on password change or deactivation without server state.
- **NextAuth.js** — adds third-party dependency, complex configuration for custom session handling, and opinionated database schema.
- **Passport.js** — Express-oriented; awkward fit with Next.js App Router server actions.

## Consequences

- Sessions can be immediately revoked (employee deactivation, security incident)
- Database hit on every request for session validation (mitigated: lightweight indexed lookup)
- Organisation context stored in session enables fast tenant resolution
- No token refresh complexity; session extends on activity

## Risks

- Database becomes a bottleneck for session lookups under extreme load (mitigated: indexed queries, optional Redis cache layer)
- Cookie-based auth limits API consumption from non-browser clients (mitigated: API key support planned for V2)

## Revisit Conditions

- If external API consumers need token-based auth (add API keys alongside sessions)
- If SSO/SAML/OIDC is required for enterprise customers
- If session DB queries measurably impact response times
