# Non-Functional Requirements

This document defines measurable non-functional requirements (NFRs) for HR Daddy V1. Each requirement has a specific, testable target to enable objective verification.

---

## 1. Security

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| SEC-001 | All tenant-owned queries must enforce organisation scope | 100% of queries include org_id filter from session context | Code review + integration tests with cross-tenant assertions |
| SEC-002 | Passwords must be hashed with bcrypt (cost factor ≥ 12) | Zero plaintext passwords in storage | Database inspection + unit test |
| SEC-003 | Sessions must expire after inactivity | 24-hour absolute timeout, 2-hour idle timeout | Automated session expiry test |
| SEC-004 | All sensitive operations must enforce server-side permissions | Zero client-only permission checks for mutations | Penetration test: call every mutation endpoint with insufficient role |
| SEC-005 | CSRF protection on all state-changing endpoints | 100% coverage via SameSite cookies + origin validation | Automated test: cross-origin POST without valid token → 403 |
| SEC-006 | File uploads validated by magic bytes, not extension | 100% of upload endpoints check file headers | Unit test: renamed malicious file → rejected |
| SEC-007 | Sensitive data encrypted at rest | Database-level encryption + application-level for PII fields (national ID, bank) | Infrastructure audit |
| SEC-008 | No secrets in application logs | Zero occurrences of passwords, tokens, or PII in log output | Log scan in CI pipeline |
| SEC-009 | Account lockout after failed login attempts | Lock after 5 failures for 15 minutes (BR-AUTH-004) | Automated brute-force test |
| SEC-010 | HTTP security headers on all responses | HSTS, X-Content-Type-Options, X-Frame-Options, CSP | Automated header scan (e.g., securityheaders.com equivalent) |

---

## 2. Privacy

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| PRV-001 | Employee personal data accessible only by authorised roles | Manager cannot view compensation; Employee cannot view others' PII | Role-based access test suite |
| PRV-002 | Sensitive data access creates audit trail | 100% of compensation/national-ID/bank-detail reads are logged | Audit log verification after access |
| PRV-003 | Deleted employee data follows retention policy | Soft-delete with 90-day retention before permanent removal | Background job verification |
| PRV-004 | No PII in URLs or query parameters | Zero occurrences of names, emails, IDs in URL paths beyond UUIDs | Code review + URL pattern scan |
| PRV-005 | Data export limited to authorised roles with rate limiting | Exports restricted to Owner/HR Admin; max 3 per hour | Permission + rate limit test |

---


## 3. Availability

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| AVL-001 | Application uptime (self-hosted) | 99.5% monthly (allows ~3.6 hours downtime/month) | Uptime monitoring |
| AVL-002 | Graceful degradation on external service failure | Email/storage failures do not block core operations | Chaos test: disable email/storage → core flows still work |
| AVL-003 | Database connection pool resilience | Auto-reconnect within 5 seconds after transient DB failure | Connection failure simulation |
| AVL-004 | Zero data loss on application restart | All committed transactions survive process restart | Kill process mid-transaction → verify data integrity |
| AVL-005 | Health check endpoint | Responds within 200ms with DB + storage connectivity status | Automated health probe |

---

## 4. Performance

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| PER-001 | Dashboard page load (server render) | < 500ms Time to First Byte (TTFB) for authenticated user | Load test with 50 concurrent users |
| PER-002 | Employee directory (100 records) | < 300ms response time | API load test |
| PER-003 | Leave submission (including balance check) | < 400ms end-to-end | API benchmark |
| PER-004 | Clock-in / clock-out | < 200ms response time | API benchmark (hot-path operation) |
| PER-005 | File upload (10MB) | < 5 seconds end-to-end (network dependent) | Upload test with max file size |
| PER-006 | Database query performance | Zero queries exceeding 1 second in normal operation | Query logging + slow query alerts |
| PER-007 | No N+1 query patterns in list views | All list endpoints use eager loading or batch queries | Query count assertion in tests |
| PER-008 | Payroll generation (50 employees) | < 3 seconds for full period generation | Integration benchmark |

---

## 5. Scalability

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| SCL-001 | Concurrent users per organisation | Support 50 concurrent users without degradation | Load test with concurrent sessions |
| SCL-002 | Employee records per organisation | Support up to 500 employees with sub-second queries | Seed 500 employees; measure query times |
| SCL-003 | Total organisations (multi-tenant) | Support 100 organisations on single instance | Seed 100 orgs; verify isolation + performance |
| SCL-004 | Attendance records per employee per year | Support 365 records with fast monthly aggregation | Seed full year; test monthly summary endpoint |
| SCL-005 | Leave requests per employee per year | Support 50 requests with fast balance calculation | Seed data; benchmark balance endpoint |
| SCL-006 | Document storage per organisation | Support up to 10GB (1000 documents × 10MB max) | Storage adapter capacity test |
| SCL-007 | Audit log growth | Support 100,000+ audit records with paginated queries < 500ms | Seed audit data; test filtered query performance |

---

## 6. Accessibility

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| A11Y-001 | WCAG 2.1 Level AA compliance | All interactive pages pass axe-core automated scan with zero critical violations | Playwright + axe-core integration in CI |
| A11Y-002 | Keyboard navigation | All primary workflows completable with keyboard only | Manual QA checklist + automated tab-order tests |
| A11Y-003 | Form labels and ARIA | All form inputs have associated visible labels; all dynamic content has ARIA attributes | axe-core scan |
| A11Y-004 | Colour contrast | All text meets 4.5:1 contrast ratio (normal) / 3:1 (large) | Automated contrast checker |
| A11Y-005 | Screen reader compatibility | All pages render meaningful content with NVDA/VoiceOver | Manual testing with screen reader |
| A11Y-006 | Focus management | Focus moves predictably; modals trap focus; closing returns focus to trigger | Automated focus-trap tests |
| A11Y-007 | Error announcements | Form validation errors are announced to assistive technology via aria-live | Screen reader verification |

---


## 7. Maintainability

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| MNT-001 | TypeScript strict mode | Zero `any` types in production code; strict: true enabled | TSC compilation with no errors |
| MNT-002 | Code module boundaries | Each domain module (leave, attendance, payroll) in separate directory with explicit exports | Architecture linting (dependency-cruiser or equivalent) |
| MNT-003 | Maximum function complexity | Cyclomatic complexity ≤ 15 per function | ESLint complexity rule |
| MNT-004 | Maximum file length | ≤ 300 lines per file (excluding generated code) | ESLint max-lines rule |
| MNT-005 | Consistent code style | Zero ESLint/Prettier violations in CI | Pre-commit hook + CI enforcement |
| MNT-006 | Database migrations are reversible | Every migration has a corresponding down migration | Migration test: up → down → up |
| MNT-007 | No circular dependencies | Zero circular imports between modules | dependency-cruiser check in CI |
| MNT-008 | Documentation coverage | All public API functions have JSDoc with @param and @returns | Documentation lint |

---

## 8. Observability

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| OBS-001 | Structured logging | All log entries are JSON with timestamp, level, requestId, orgId | Log format validation test |
| OBS-002 | Request correlation | Every HTTP request has a unique requestId propagated through all service calls | Trace request through multiple log entries |
| OBS-003 | Error tracking | All unhandled exceptions captured with stack trace + request context | Error boundary + global handler test |
| OBS-004 | Health metrics endpoint | Exposes memory usage, active connections, request count, error rate | Metrics endpoint returns valid JSON with required fields |
| OBS-005 | Slow query detection | Queries exceeding 500ms logged at WARN level with query text | Simulate slow query → verify log entry |
| OBS-006 | Audit trail completeness | All sensitive operations produce audit records within the same transaction | Transaction log analysis |
| OBS-007 | Log level configuration | Log level changeable via environment variable without restart | ENV change → verify new level applies |

---

## 9. Testability

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| TST-001 | Unit test coverage | ≥ 80% line coverage for business logic (domain services, validators) | Coverage report in CI |
| TST-002 | Integration test coverage | All permission checks, state transitions, and cross-aggregate interactions tested | Test inventory audit |
| TST-003 | End-to-end test coverage | All P0 user workflows have at least one Playwright E2E test | Playwright test count vs workflow count |
| TST-004 | Test isolation | Tests do not share mutable state; each test creates and destroys own data | Parallel test execution succeeds |
| TST-005 | Test execution time | Full unit test suite completes in < 60 seconds | CI timing measurement |
| TST-006 | Test data factories | Reusable factory functions for all entities (no manual object construction in tests) | Code review for factory usage |
| TST-007 | Cross-tenant test assertions | At least one integration test per module verifies cross-tenant access returns empty/404 | Test inventory audit |

---

## 10. Portability

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| PRT-001 | Single-command local setup | Developer can run `docker compose up` and have full stack running | Fresh clone → setup → verify |
| PRT-002 | No vendor lock-in for core | Database adapter is swappable; storage adapter is swappable | Interface-based architecture review |
| PRT-003 | Environment configuration | All runtime config via environment variables (12-factor compliant) | No hardcoded URLs, credentials, or feature flags in code |
| PRT-004 | Multi-platform development | Works on macOS, Linux, and Windows (WSL2) | CI matrix or documented verification |
| PRT-005 | Database migration portability | Migrations work with PostgreSQL 14+ | Test against minimum supported version |

---


## 11. Responsiveness

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| RSP-001 | Desktop layout | Fully functional at 1024px+ viewport width | Playwright visual test at 1280px |
| RSP-002 | Tablet layout | Fully functional at 768px-1023px width; navigation adapts | Playwright visual test at 768px |
| RSP-003 | Mobile layout | Core employee self-service usable at 320px-767px width | Playwright visual test at 375px |
| RSP-004 | Touch targets | All interactive elements ≥ 44×44px on mobile viewports | Automated size assertion |
| RSP-005 | No horizontal scroll | No unintended horizontal scrollbar at any supported width | Visual regression test |
| RSP-006 | Responsive tables | Tables gracefully adapt (card view or horizontal scroll container) on mobile | Manual + visual test |

---

## 12. Data Integrity

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| DI-001 | Monetary calculations use integer cents | Zero floating-point operations on monetary values | Static analysis + unit tests for all payroll arithmetic |
| DI-002 | Foreign key constraints on all relationships | 100% of entity relationships have FK constraints | Database schema inspection |
| DI-003 | Optimistic concurrency on shared resources | Leave approval, payroll approval, employee status changes use version checks | Concurrent modification test (two simultaneous approvals → one 409) |
| DI-004 | All timestamps stored in UTC | Zero non-UTC timestamps in database | Schema audit + insertion test |
| DI-005 | Audit records are truly immutable | No UPDATE or DELETE operations possible on audit table via application | DB permission audit + attempted mutation test → error |
| DI-006 | Unique constraints enforced | Employee work email unique per org; invitation email unique per org (pending) | Duplicate insertion tests |
| DI-007 | Transaction boundaries for multi-record operations | Organisation creation, leave approval, payroll publish are atomic | Failure injection mid-transaction → verify rollback |

---

## 13. Backup and Recovery

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| BR-001 | Automated database backups | Daily automated backups with 30-day retention | Backup schedule verification |
| BR-002 | Point-in-time recovery | Ability to restore to any point within last 7 days (WAL archiving) | Restore test to specific timestamp |
| BR-003 | Backup validation | Weekly automated backup restore test to verify integrity | Cron job + test query against restored DB |
| BR-004 | Recovery Time Objective (RTO) | Full recovery within 1 hour from backup | Timed restore drill |
| BR-005 | Recovery Point Objective (RPO) | Maximum 1 hour of data loss in disaster scenario | WAL shipping lag measurement |
| BR-006 | Document storage backup | Object storage configured with versioning or cross-region replication | Storage configuration audit |
| BR-007 | Configuration backup | All environment config and secrets backed up separately from data | Config management audit |

---

## 14. Developer Experience

| ID | Requirement | Target | Verification Method |
|----|-------------|--------|---------------------|
| DX-001 | Time to first running app (new developer) | < 15 minutes from git clone to working local environment | New developer onboarding test |
| DX-002 | Hot module replacement | Code changes reflected in browser within 2 seconds (dev mode) | Developer workflow timing |
| DX-003 | Seed data availability | One command generates realistic demo data (Northstar Studios org) | `npm run seed` produces verifiable demo state |
| DX-004 | Type safety | Full end-to-end type inference from database schema to API response | TypeScript compilation with no type errors |
| DX-005 | Error messages in development | All validation errors include field name, rule, and expected format | Manual verification of error responses |
| DX-006 | API documentation | All endpoints documented with input/output schemas | Schema-generated docs (this document + Zod inference) |
| DX-007 | Consistent project structure | New modules follow established pattern (service/repository/schema/route) | Architecture decision record + code review |
| DX-008 | CI pipeline duration | Full CI pipeline (lint + typecheck + unit + integration) completes in < 5 minutes | CI timing measurement |

---

## Requirement Priority

| Priority | IDs | Rationale |
|----------|-----|-----------|
| P0 (Must) | SEC-001–010, PRV-001–003, PER-001–004, DI-001–007, A11Y-001–004, TST-001–004, MNT-001–005 | Core security, performance, and quality |
| P1 (Should) | AVL-001–005, SCL-001–005, OBS-001–006, PRT-001–005, RSP-001–005, BR-001–005, DX-001–006 | Operational readiness |
| P2 (Nice) | SCL-006–007, A11Y-005–007, TST-005–007, OBS-007, RSP-006, BR-006–007, DX-007–008, MNT-006–008 | Excellence and polish |

---

## Verification Schedule

| Phase | NFR Categories Verified |
|-------|------------------------|
| Foundation (Milestone 0) | Security (SEC-001–004), Data Integrity (DI-001–007), Portability (PRT-001–003), DX (DX-001–004) |
| First Vertical Slice (Milestone 1) | Performance (PER-001–004), Accessibility (A11Y-001–004), Testability (TST-001–004) |
| Module Completion (Milestones 2–6) | All remaining NFRs verified per module |
| Pre-Release (Milestone 7) | Full NFR audit against all targets |
