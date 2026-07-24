# Planning Review

This document is a formal quality review of the HR Daddy V1 planning documentation. It verifies internal consistency, completeness, and readiness for implementation.

---

## Review Checklist

### 1. Are all major actors defined?

| Check | Status | Notes |
|---|---|---|
| Owner persona documented | PASS | Product vision defines Sarah (startup founder) |
| HR Administrator persona documented | PASS | Product vision defines Priya (HR manager) |
| Manager persona documented | PASS | Product vision defines David (engineering lead) |
| Employee persona documented | PASS | Product vision defines Alex (developer) |
| System Administrator noted as future | PASS | Explicitly marked as non-V1 platform role |
| Actors distinguished from roles | PASS | Glossary separates User/Account from org roles |
| Actor permissions defined | PASS | Full permissions matrix with 60+ permission keys |

**Verdict:** PASS — All V1 actors are defined with personas, permissions, and scope boundaries.

---

### 2. Are all P0 use cases documented?

| Module | Use Cases Documented | Coverage |
|---|---|---|
| Authentication | AUTH-001 through AUTH-011 | Complete |
| Organisation | ORG-001 through ORG-013 | Complete |
| Employee | EMP-001 through EMP-016 | Complete |
| Leave | LEAVE-001 through LEAVE-020 | Complete |
| Attendance | ATT-001 through ATT-014 | Complete |
| Onboarding | ONB-001 through ONB-013 | Complete |
| Documents | DOC-001 through DOC-013 | Complete |
| Payroll | PAY-001 through PAY-014 | Complete |
| Notifications | NOTIF-001 through NOTIF-010 | Complete |
| Audit | AUDIT-001 through AUDIT-010 | Complete |

**Verdict:** PASS — All P0 and P1 use cases catalogued with full detail.

---

### 3. Are permissions consistent?

| Check | Status | Notes |
|---|---|---|
| Permissions matrix covers all modules | PASS | Organisation, Employee, Leave, Attendance, Onboarding, Documents, Payroll, Audit, Notifications |
| Use cases reference correct permission keys | PASS | Cross-referenced against permission matrix |
| Scoped permissions (team/own) align with reporting | PASS | Manager sees only direct reports consistently |
| HR override permissions documented | PASS | leave.request.override, attendance.correct, onboarding.task.reopen |
| Sensitive field permissions distinct | PASS | employee.compensation.read separated from employee.read |
| Self-service scope consistent | PASS | BR-PERM-005 defines self-scope pattern |
| Server-side enforcement mandated | PASS | BR-PERM-001 requires server-side for all checks |

**Verdict:** PASS — Permission model is consistent across documentation.

---


### 4. Do sequence diagrams match use cases?

| Diagram | Matching Use Case(s) | Status |
|---|---|---|
| Authentication (register, login) | AUTH-001, AUTH-003 | PASS |
| Session validation | AUTH-007 | PASS |
| Password reset | AUTH-005 | PASS |
| Invitation acceptance | AUTH-006 | PASS |
| Organisation setup | ORG-001 | PASS |
| Employee creation (with/without login) | EMP-001, EMP-002 | PASS |
| Leave request submission | LEAVE-005 | PASS |
| Leave approval | LEAVE-011 | PASS |
| Clock in / clock out | ATT-001, ATT-002 | PASS |
| Attendance correction | ATT-006 | PASS |
| Onboarding assignment | ONB-005 | PASS |
| Document upload | DOC-002 | PASS |
| Document download | DOC-004 | PASS |
| Payroll creation and publication | PAY-001, PAY-011 | PASS |
| Dashboard loading | General | PASS |

**Verdict:** PASS — All critical workflows have matching sequence diagrams with failure paths.

---

### 5. Do state machines match business rules?

| State Machine | Related Business Rules | Status |
|---|---|---|
| Employee lifecycle | BR-EMP-003 (valid transitions) | PASS |
| Invitation lifecycle | BR-AUTH-003 (7-day expiry), BR-AUTH-008 (single-use) | PASS |
| Leave request lifecycle | BR-LEAVE-001 through BR-LEAVE-011 | PASS |
| Attendance session lifecycle | BR-ATT-001 through BR-ATT-009 | PASS |
| Onboarding lifecycle | BR-ONB-001 through BR-ONB-006 | PASS |
| Onboarding task lifecycle | BR-ONB-003, BR-ONB-004 | PASS |
| Document lifecycle | BR-DOC-005, BR-DOC-006 | PASS |
| Payroll period lifecycle | BR-PAY-004, BR-PAY-002, BR-PAY-007 | PASS |

**Verdict:** PASS — State machines are consistent with business rules; valid/invalid transitions documented.

---

### 6. Does the ERD support all workflows?

| Workflow | Required Entities | ERD Coverage | Status |
|---|---|---|---|
| Multi-tenant isolation | Organisation, org_id on all tables | All entities have organisation_id | PASS |
| Employee without login | Employee.userId nullable | Schema confirms nullable FK | PASS |
| Reporting chain | ReportingRelationship entity | Self-referential relationship modelled | PASS |
| Leave balance tracking | LeaveBalance per employee per type | Separate entity with allocated/used/pending | PASS |
| Attendance corrections | AttendanceCorrection linked to record | Correction entity with reason | PASS |
| Onboarding snapshot | EmployeeOnboarding + EmployeeOnboardingTask | Separate from template entities | PASS |
| Document visibility | DocumentCategory.sensitivityLevel | Category-driven visibility rule | PASS |
| Payroll line items | PayrollLineItem (earnings/deductions) | Type field distinguishes line item kinds | PASS |
| Audit immutability | AuditLog (append-only) | No UPDATE/DELETE at DB level documented | PASS |
| Holiday calendar | HolidayCalendar + Holiday | Referenced in leave + attendance | PASS |

**Verdict:** PASS — ERD supports all documented workflows without missing entities.

---

### 7. Are tenant boundaries explicit?

| Check | Status | Notes |
|---|---|---|
| organisation_id on all org-owned tables | PASS | ERD confirms NOT NULL FK on all tenant entities |
| Organisation context from session only | PASS | BR-ORG-002 mandates session-derived org_id |
| Repository base class enforces scoping | PASS | Architecture doc specifies tenant-scoped base repo |
| File storage paths include org_id | PASS | BR-DOC-003 + Storage architecture confirms path format |
| Notifications scoped to org | PASS | BR-NOTIF-003 |
| Audit events scoped to org | PASS | BR-AUDIT-004 captures org_id |
| Cross-tenant test strategy defined | PASS | Testing architecture includes cross-tenant tests |
| Background jobs iterate per-org | PASS | System architecture specifies per-org iteration |

**Verdict:** PASS — Tenant isolation is thoroughly documented across all layers.

---

### 8. Are sensitive fields identified?

| Sensitive Data | Protection Mechanism | Status |
|---|---|---|
| Passwords | bcrypt hash, never stored in plain text | PASS |
| Employee compensation | employee.compensation.read permission | PASS |
| Bank details | employee.sensitive.read permission | PASS |
| Personal ID numbers | employee.sensitive.read permission | PASS |
| Payroll records | payroll.read restricted to Owner + HR | PASS |
| Medical documents | HR-only category visibility | PASS |
| Audit logs | audit.read restricted to Owner + HR | PASS |
| Session tokens | httpOnly, Secure, SameSite cookies | PASS |
| Invitation tokens | Single-use, time-limited, cryptographically random | PASS |
| API error messages | Generic 403 messages (BR-PERM-003) | PASS |

**Verdict:** PASS — All sensitive data fields identified with explicit access controls.

---


### 9. Are audit requirements complete?

| Audited Operation | Documented | Severity Level |
|---|---|---|
| User registration | Yes | Normal |
| Login (success/failure) | Yes | Normal |
| Organisation creation | Yes | Normal |
| Member invitation/acceptance | Yes | Normal |
| Role changes | Yes | Elevated |
| Employee creation/modification | Yes | Normal |
| Employee status changes | Yes | Elevated |
| Manager assignment | Yes | Normal |
| Leave submission | Yes | Normal |
| Leave approval/rejection | Yes | Normal |
| Leave cancellation/override | Yes | Normal |
| Attendance clock-in/out | Yes | Low |
| Attendance correction | Yes | Elevated |
| Onboarding assignment/completion | Yes | Normal |
| Document upload/delete | Yes | Normal |
| Sensitive document access | Yes | Elevated |
| Payroll approval | Yes | Elevated |
| Payroll publication | Yes | Elevated |
| Payroll reopening | Yes | Critical |
| Ownership transfer | Yes | Critical |
| Permission changes | Yes | Elevated |

**Verdict:** PASS — All sensitive operations have audit requirements with appropriate severity levels.

---

### 10. Are notification triggers complete?

| Trigger | Recipients | Channel | Status |
|---|---|---|---|
| Member invited | Invitee (email) + Owner (in-app) | Email + In-app | PASS |
| Invitation accepted | Inviter (in-app) | In-app | PASS |
| Employee created | Manager (in-app) | In-app | PASS |
| Employee deactivated | Manager (in-app) | In-app | PASS |
| Manager assigned | New manager + employee + old manager | In-app | PASS |
| Leave requested | Approver (in-app + email) | In-app + Email | PASS |
| Leave approved/rejected | Employee (in-app + email) | In-app + Email | PASS |
| Leave cancelled | Context-dependent recipients | In-app | PASS |
| Attendance corrected | Employee (in-app) | In-app | PASS |
| Onboarding assigned | Employee + assignees (in-app + email) | In-app + Email | PASS |
| Onboarding task completed | Employee/HR (in-app) | In-app | PASS |
| Document uploaded by HR | Employee (in-app) | In-app | PASS |
| Document expiring (30d/7d) | HR + employee (in-app + email) | In-app + Email | PASS |
| Payroll approved | Owner (in-app) | In-app | PASS |
| Payslip published | All affected employees (in-app + email) | In-app + Email | PASS |

**Verdict:** PASS — All domain events have notification effects documented.

---

### 11. Are edge cases handled?

| Edge Case | Documented Resolution | Location |
|---|---|---|
| Owner is also an employee | Separate records; both roles active | Edge cases doc |
| Employee has no login account | Employee.userId nullable; no notifications | BR-EMP-001 |
| Employee has no manager | Leave routes to HR fallback | BR-LEAVE-010 |
| Manager is deactivated | Pending approvals route to HR; reports flagged | BR-CROSS-002 |
| Department change during pending leave | Leave stays with original context | Edge cases doc |
| Leave overlaps public holiday | Working day calc excludes holidays | BR-LEAVE-005 |
| Overnight attendance shift | Session belongs to clock-in date | BR-ATT-007 |
| Attendance session left open | Missing clock-out background job | BR-ATT-005 |
| Employee deactivated during onboarding | Onboarding cancelled with cascade | BR-ONB-005 |
| Document expires after employee leaves | Document retained for compliance | Edge cases doc |
| File upload succeeds but DB write fails | Compensating transaction cleanup | BR-DOC-007 |
| Two managers approve same request | Optimistic concurrency control | BR-DATA-004 |
| User belongs to multiple organisations | Per-org membership and role | BR-PERM-002 |
| Invitation accepted twice | Single-use token enforcement | BR-AUTH-008 |

**Verdict:** PASS — 20+ edge cases documented with explicit expected behaviour.

---

### 12. Are API contracts consistent?

| Check | Status | Notes |
|---|---|---|
| Consistent error model defined | PASS | 10 error categories with status codes |
| Input schemas use Zod | PASS | Architecture specifies Zod validation |
| Permission requirements per operation | PASS | Every API contract lists required permission |
| Idempotency requirements noted | PASS | Per-operation in API contracts doc |
| Transaction boundaries defined | PASS | Per aggregate in domain model |
| Notification side effects listed | PASS | Per operation in API contracts |
| Audit side effects listed | PASS | Per operation in API contracts |

**Verdict:** PASS — API contracts are internally consistent with defined patterns.

---

### 13. Are tasks small and testable?

| Check | Status | Notes |
|---|---|---|
| Tasks have single clear goal | PASS | Each task targets one capability |
| Tasks have acceptance criteria | PASS | Every task lists measurable criteria |
| Tasks reference business rules | PASS | BR-IDs included where applicable |
| Tasks identify affected files | PASS | Module/file paths specified |
| Tasks list dependencies | PASS | Task IDs reference predecessors |
| No vague tasks like "build leave management" | PASS | Broken into 8 specific tasks (M2-001 through M2-008) |
| Total task count manageable | PASS | 68 tasks across 8 milestones |

**Verdict:** PASS — Tasks are well-decomposed and independently verifiable.

---

## Contradictions Found

| # | Area | Description | Resolution |
|---|---|---|---|
| 1 | Employee derived states | State machine shows "On leave" as a state, but domain model describes it as derived | **Resolved:** "On leave" is a derived display state, not a stored status. Stored statuses are Draft, Invited, Active, Suspended, Deactivated, Archived. |
| 2 | Leave balance model | BR-LEAVE-009 says pending reserves balance, but domain model mentions both "reservation" and "deduction" language | **Resolved:** Pending = reservation (soft hold); Approved = confirmed deduction. Both are reflected in available balance calculation: `available = allocated - used - pending`. |
| 3 | Notification recipients | BR-NOTIF-001 says "Notifications target Users not Employees" but some events mention notifying "employee" | **Resolved:** Notification is sent to the User account linked to the Employee record. If Employee has no User link, no notification is created. "Notify employee" means "notify the User associated with that Employee." |
| 4 | Payroll access: Owner vs HR | BR-PAY-003 restricts to Owner + HR Admin, but M6-001 implies HR can approve | **Resolved:** Both Owner and HR Admin can manage payroll. The restriction is against Manager and Employee roles, not between Owner and HR. |

---

## Missing Decisions

| # | Area | Decision Needed | Recommendation |
|---|---|---|---|
| 1 | Email verification | Is email verification required before org creation? | Recommend: Allow org creation without verification but prevent inviting others until verified. Prevents friction for new users. |
| 2 | Multi-org switching UX | How does the user switch between organisations? | Recommend: Org switcher in header dropdown. Session stores current org context. Switch invalidates previous org context (BR-AUTH-006). |
| 3 | Leave accrual method | Are balances allocated annually upfront or accrued monthly? | Recommend: V1 supports annual upfront allocation only. Monthly accrual is a V2 feature. Simplifies balance calculation significantly. |
| 4 | Background job runner | Use node-cron in-process or a separate worker process? | Recommend: Separate worker process (same Docker image, different entrypoint). Prevents job failures from affecting web requests. |
| 5 | Email template management | Hardcoded templates or database-stored? | Recommend: Hardcoded Handlebars templates in V1. Database-stored templates are a V2 customisation feature. |

---

## Simplifications Made

| # | Area | Simplification | Justification |
|---|---|---|---|
| 1 | Payroll | Record-only (no tax calculation, no payroll integration) | V1 scope explicitly excludes actual payroll processing |
| 2 | Notifications | In-app + email only (no push, no SMS) | Stated in product vision as V1 constraint |
| 3 | Event bus | Synchronous in-process (no message broker) | Single-instance deployment for V1; async migration planned for V2 |
| 4 | File storage | Local filesystem default (S3 optional) | Reduces deployment complexity for self-hosting |
| 5 | Leave accrual | Annual allocation only (no monthly accrual) | Reduces balance calculation complexity for V1 |
| 6 | Reporting | Fixed dashboard widgets (no report builder) | Custom reporting is explicitly a non-goal for V1 |
| 7 | Authentication | Email/password only (no SSO/SAML) | SSO listed as explicit non-goal for V1 |
| 8 | Multi-language | English only | Multi-language explicitly a non-goal |

---


## Risks Accepted

| # | Risk | Likelihood | Impact | Mitigation | Acceptance Rationale |
|---|---|---|---|---|---|
| 1 | Synchronous event bus creates coupling | Medium | Medium | Consumers designed to be idempotent; clear migration path to async | V1 single-instance doesn't need message broker complexity |
| 2 | Local file storage limits scalability | Low (for V1) | Low | Storage adapter interface allows seamless S3 swap | Target market (SMBs) won't hit storage limits quickly |
| 3 | Single database without read replicas | Low (for V1) | Medium | Indexed queries; connection pooling; monitoring | 500-employee companies won't stress a single PostgreSQL instance |
| 4 | No automated backup in Docker Compose | Medium | High | Document manual pg_dump strategy; add backup job in V1.1 | Self-hosting users expected to manage their own backups |
| 5 | Session-based auth limits future API consumption | Low | Medium | API tokens can be added alongside sessions later | V1 is web-only; API consumers are a future concern |
| 6 | 87 business rules create testing burden | High | Low | Prioritise P0 rules; property-based tests for calculations | Comprehensive rules prevent ambiguity during implementation |
| 7 | Payroll decimal precision across currencies | Low | High | Integer cents storage; Decimal.js for all calculations | Eliminates floating-point risk entirely |

---

## Questions Requiring User Input

| # | Question | Blocking? | Default Assumption |
|---|---|---|---|
| 1 | Should HR Daddy support public registration or invitation-only signup? | No | Public registration with org creation. Invitation-only for org members. |
| 2 | Is there a preferred email delivery service (Resend, SES, SendGrid)? | No | Abstract via adapter; default to SMTP with console fallback in dev. |
| 3 | Should the demo seed include a second organisation to demonstrate multi-tenancy? | No | Yes — seed two orgs to make isolation visible in the demo. |
| 4 | Is there a preferred deployment target (AWS, DigitalOcean, Railway, self-hosted)? | No | Docker Compose for self-hosting; platform-agnostic. |
| 5 | Should V1 include email notifications or only in-app? | No | Both. Email adapter with console fallback in development. |

---

## Final Recommendation

**The planning documentation is complete and internally consistent. The project is ready to proceed to foundation implementation (M0).**

### Summary Assessment

| Dimension | Rating | Notes |
|---|---|---|
| Completeness | Strong | All major planning documents exist; 87 business rules, 100+ use cases, 20+ sequence diagrams |
| Consistency | Strong | Cross-references verified; no blocking contradictions found |
| Testability | Strong | Every task has acceptance criteria; every business rule has test requirements |
| Security | Strong | Threat model covers 20+ vectors; tenant isolation at every layer; permissions matrix comprehensive |
| Feasibility | Strong | Modular monolith avoids over-engineering; clear priority model prevents scope creep |
| Risk Management | Adequate | Risks identified and accepted with rationale; mitigations documented |

### Recommended Next Steps

1. Begin M0 (Foundation) immediately — no blocking questions remain
2. Validate email verification decision with product owner if available
3. Implement cross-tenant isolation tests early (M1-018) as a safety net
4. Review permission model after first vertical slice to confirm it works in practice
5. Establish CI pipeline before M2 to catch regressions early

### Planning Completion Gate

| Requirement | Status |
|---|---|
| Repository assessment | COMPLETE |
| Product vision | COMPLETE |
| V1 scope and non-goals | COMPLETE |
| Personas | COMPLETE |
| Domain glossary | COMPLETE |
| Use-case catalogue | COMPLETE |
| User journeys | COMPLETE |
| Sequence diagrams | COMPLETE |
| State machines | COMPLETE |
| Business rules catalogue | COMPLETE |
| Permissions matrix | COMPLETE |
| Domain model | COMPLETE |
| ER diagram | COMPLETE |
| Tenant isolation design | COMPLETE |
| System architecture | COMPLETE |
| Architecture decision records | COMPLETE (15 ADRs) |
| API contracts | COMPLETE |
| Event catalogue | COMPLETE (20 events) |
| Threat model | COMPLETE |
| Non-functional requirements | COMPLETE |
| Edge case catalogue | COMPLETE |
| Dashboard metrics | COMPLETE |
| Information architecture | COMPLETE |
| Page inventory | COMPLETE |
| Wireframes | COMPLETE |
| Dependency map | COMPLETE |
| Implementation roadmap | COMPLETE (68 tasks) |
| Planning review | COMPLETE (this document) |

**All 28 planning gate requirements are satisfied. Proceed to implementation.**
