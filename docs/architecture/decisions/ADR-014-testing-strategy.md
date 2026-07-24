# ADR-014: Testing Strategy

**Status:** Accepted

## Context

HR Daddy handles sensitive data (payroll, personal information) and complex state machines (leave, attendance, onboarding). Bugs in permission logic or balance calculations have real business impact. The testing strategy must catch regressions at appropriate levels without over-investing in slow tests.

## Decision

**Three-tier testing: Vitest for unit/integration, Playwright for E2E.** Unit tests cover business rules, calculations, validators, and state machines. Integration tests use a real test database to verify tenant isolation, repository scoping, and service orchestration. E2E tests cover critical user workflows end-to-end in a browser.

## Alternatives Considered

- **Jest** — slower, heavier, more configuration. Vitest is faster, ESM-native, and compatible with the Vite ecosystem.
- **Cypress** — excellent DX but heavier than Playwright; slower execution; limited multi-browser support.
- **Testing Library only (no E2E)** — misses integration bugs between server actions, database, and UI.

## Consequences

- Fast feedback loop: unit tests run in < 5s, catch most logic errors
- Integration tests verify the critical tenant isolation boundary
- E2E tests validate complete workflows including auth flow and permissions
- CI pipeline: typecheck → lint → unit → integration → E2E (fail-fast)

## Risks

- Test database setup adds CI complexity (mitigated: Docker Compose test profile)
- E2E tests are inherently slower and flakier (mitigated: limited to critical paths; retry on flake)

## Revisit Conditions

- If E2E test suite exceeds 10 minutes (parallelise or reduce scope)
- If visual regression testing is needed (add Playwright screenshot comparison)
- If load testing becomes necessary (add k6 or artillery for API endpoints)
