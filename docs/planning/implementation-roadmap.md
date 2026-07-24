# Implementation Roadmap

This document breaks HR Daddy V1 into milestones with small, verifiable tasks. Each task includes ID, goal, dependencies, files affected, acceptance criteria, and priority.

---

## Priority Model

- **P0:** Core foundation — blocks all other work
- **P1:** Primary vertical features — required for V1 completeness
- **P2:** Extended features — important but can ship after P0+P1

---

## M0: Foundation

**Goal:** Establish project infrastructure, database, environment validation, error model, and testing framework.

---


### M0-001: Project structure and configuration

| Field | Value |
|---|---|
| **ID** | M0-001 |
| **Goal** | Establish Next.js project with TypeScript, Tailwind, ESLint, and module directory structure |
| **Dependencies** | None |
| **Files Affected** | `package.json`, `tsconfig.json`, `tailwind.config.ts`, `eslint.config.js`, `src/` directory structure |
| **Acceptance Criteria** | `npm run build` passes, `npm run lint` passes, TypeScript strict mode enabled |
| **Priority** | P0 |

### M0-002: Environment validation

| Field | Value |
|---|---|
| **ID** | M0-002 |
| **Goal** | Implement environment variable loading with Zod validation and fail-fast on missing config |
| **Dependencies** | M0-001 |
| **Files Affected** | `src/infrastructure/config/env.ts`, `.env.example`, `.env.local` |
| **Acceptance Criteria** | App refuses to start with missing required vars; all env vars typed; `.env.example` documents all variables |
| **Priority** | P0 |

### M0-003: Database connection and Prisma setup

| Field | Value |
|---|---|
| **ID** | M0-003 |
| **Goal** | Configure Prisma ORM, create initial schema, establish connection pooling |
| **Dependencies** | M0-002 |
| **Files Affected** | `prisma/schema.prisma`, `src/infrastructure/database/client.ts`, `docker-compose.yml` |
| **Acceptance Criteria** | `npx prisma migrate dev` succeeds; connection pool established on startup; health check endpoint verifies DB |
| **Priority** | P0 |

### M0-004: Error model and typed error hierarchy

| Field | Value |
|---|---|
| **ID** | M0-004 |
| **Goal** | Define application error classes: AuthError, ValidationError, PermissionError, NotFoundError, ConflictError, TenantError |
| **Dependencies** | M0-001 |
| **Files Affected** | `src/shared/errors/` |
| **Acceptance Criteria** | All error types have status codes, serialisation method, and do not leak sensitive information |
| **Priority** | P0 |

### M0-005: Testing infrastructure

| Field | Value |
|---|---|
| **ID** | M0-005 |
| **Goal** | Configure Vitest for unit/integration tests and Playwright for E2E; create test database setup |
| **Dependencies** | M0-003 |
| **Files Affected** | `vitest.config.ts`, `playwright.config.ts`, `tests/`, `src/tests/helpers/` |
| **Acceptance Criteria** | `npm run test` runs Vitest; `npm run test:e2e` runs Playwright; test DB is separate from dev DB; truncation between suites works |
| **Priority** | P0 |



### M0-006: Docker Compose development environment

| Field | Value |
|---|---|
| **ID** | M0-006 |
| **Goal** | Create Docker Compose file for PostgreSQL, app, and optional services |
| **Dependencies** | M0-003 |
| **Files Affected** | `docker-compose.yml`, `Dockerfile`, `.dockerignore` |
| **Acceptance Criteria** | `docker compose up` starts full stack; migrations run on startup; health check passes |
| **Priority** | P0 |

### M0-007: Shared validation schemas (Zod)

| Field | Value |
|---|---|
| **ID** | M0-007 |
| **Goal** | Create shared Zod schemas for common types: email, uuid, pagination, date ranges |
| **Dependencies** | M0-001 |
| **Files Affected** | `src/shared/validation/` |
| **Acceptance Criteria** | Schemas are reusable across modules; unit tests cover valid/invalid inputs |
| **Priority** | P0 |

### M0-008: Tenant-scoped base repository

| Field | Value |
|---|---|
| **ID** | M0-008 |
| **Goal** | Create base repository class that automatically scopes all queries by organisation_id |
| **Dependencies** | M0-003, M0-004 |
| **Files Affected** | `src/infrastructure/database/base-repository.ts` |
| **Acceptance Criteria** | All queries include org_id filter; cross-tenant access returns empty result; integration tests verify isolation |
| **Priority** | P0 |

---

## M1: Authentication + Organisation + Employee

**Goal:** Complete the first vertical slice — user signs in, creates an org, adds an employee, permissions enforced.

---

### M1-001: User registration

| Field | Value |
|---|---|
| **ID** | M1-001 |
| **Goal** | Implement user registration with email, password (bcrypt), and verification token |
| **Dependencies** | M0-003, M0-004, M0-007 |
| **Files Affected** | `src/modules/auth/`, `prisma/schema.prisma` (User model), registration page |
| **Acceptance Criteria** | User can register; password hashed with bcrypt cost 12; verification token generated; duplicate email rejected |
| **Priority** | P0 |

### M1-002: User login and session management

| Field | Value |
|---|---|
| **ID** | M1-002 |
| **Goal** | Implement login with httpOnly cookie sessions, CSRF protection, session store in DB |
| **Dependencies** | M1-001 |
| **Files Affected** | `src/modules/auth/services/session-service.ts`, `src/shared/auth/middleware.ts` |
| **Acceptance Criteria** | Login returns httpOnly cookie; session stored in DB; CSRF token validated on mutations; session expires after 24h idle / 7d max |
| **Priority** | P0 |

### M1-003: Password reset flow

| Field | Value |
|---|---|
| **ID** | M1-003 |
| **Goal** | Implement forgot password → reset token email → new password flow |
| **Dependencies** | M1-002 |
| **Files Affected** | `src/modules/auth/actions/`, password reset pages |
| **Acceptance Criteria** | Reset token valid 1h; all sessions invalidated on password change (BR-AUTH-002); rate-limited |
| **Priority** | P0 |



### M1-004: Account lockout

| Field | Value |
|---|---|
| **ID** | M1-004 |
| **Goal** | Lock accounts after 5 failed login attempts for 15 minutes (BR-AUTH-004) |
| **Dependencies** | M1-002 |
| **Files Affected** | `src/modules/auth/services/` |
| **Acceptance Criteria** | 5 failures → locked; correct password during lock → still locked; after 15min → unlocked; counter resets on success |
| **Priority** | P0 |

### M1-005: Organisation creation

| Field | Value |
|---|---|
| **ID** | M1-005 |
| **Goal** | Create organisation with default settings; assign creator as Owner |
| **Dependencies** | M1-002 |
| **Files Affected** | `src/modules/organisation/`, `prisma/schema.prisma` (Organisation, Settings, Membership) |
| **Acceptance Criteria** | Org created atomically with settings + owner membership; default timezone/currency/working days applied |
| **Priority** | P0 |

### M1-006: Organisation settings configuration

| Field | Value |
|---|---|
| **ID** | M1-006 |
| **Goal** | Allow Owner to configure timezone, currency, working days, working hours, date format, leave year |
| **Dependencies** | M1-005 |
| **Files Affected** | `src/modules/organisation/actions/`, settings UI pages |
| **Acceptance Criteria** | Settings persist; only Owner can modify (BR-ORG-005); changes apply org-wide immediately |
| **Priority** | P0 |

### M1-007: Organisation membership and invitations

| Field | Value |
|---|---|
| **ID** | M1-007 |
| **Goal** | Invite members via email with role assignment; implement invitation acceptance flow |
| **Dependencies** | M1-005, M1-002 |
| **Files Affected** | `src/modules/organisation/services/invitation-service.ts`, invitation pages |
| **Acceptance Criteria** | Invitations expire in 7 days (BR-AUTH-003); single-use (BR-AUTH-008); acceptance creates membership; roles assigned correctly |
| **Priority** | P0 |

### M1-008: Permission service implementation

| Field | Value |
|---|---|
| **ID** | M1-008 |
| **Goal** | Build permission resolution service that checks role + scope + conditions per the permissions matrix |
| **Dependencies** | M1-007 |
| **Files Affected** | `src/shared/permissions/` |
| **Acceptance Criteria** | All permission keys from matrix enforceable; server-side checks return 403 with generic message (BR-PERM-003); scoped checks (team, own) work correctly |
| **Priority** | P0 |

### M1-009: Audit service (append-only)

| Field | Value |
|---|---|
| **ID** | M1-009 |
| **Goal** | Implement audit event recording with before/after state, actor, org context, IP |
| **Dependencies** | M0-003, M1-002 |
| **Files Affected** | `src/modules/audit/`, `prisma/schema.prisma` (AuditLog) |
| **Acceptance Criteria** | Records append-only (no UPDATE/DELETE at DB level); captures actor, action, target, before/after, metadata; restricted to Owner + HR (BR-AUDIT-006) |
| **Priority** | P0 |

### M1-010: Employee creation

| Field | Value |
|---|---|
| **ID** | M1-010 |
| **Goal** | Create employee records with personal/employment details; optional login invitation |
| **Dependencies** | M1-008, M1-009 |
| **Files Affected** | `src/modules/employee/`, employee creation form |
| **Acceptance Criteria** | Employee created with org scope; work email unique per org (BR-EMP-002); optional user account link; audit event created; manager notified |
| **Priority** | P0 |



### M1-011: Employee directory and profile

| Field | Value |
|---|---|
| **ID** | M1-011 |
| **Goal** | Implement searchable employee directory and detailed profile view with permission-gated fields |
| **Dependencies** | M1-010 |
| **Files Affected** | `src/modules/employee/`, directory and profile pages |
| **Acceptance Criteria** | Directory paginates and searches; profile shows permitted fields only; sensitive fields (compensation) require elevated permission (BR-PERM-004); managers see only direct reports (BR-EMP-005) |
| **Priority** | P0 |

### M1-012: Departments, job titles, locations

| Field | Value |
|---|---|
| **ID** | M1-012 |
| **Goal** | CRUD for departments, job titles, and work locations; assign to employees |
| **Dependencies** | M1-005, M1-008 |
| **Files Affected** | `src/modules/employee/services/department-service.ts`, structure management pages |
| **Acceptance Criteria** | Departments cannot be archived with active employees (BR-CROSS-001); job titles and locations are org-scoped; assignment creates audit event |
| **Priority** | P0 |

### M1-013: Reporting relationships

| Field | Value |
|---|---|
| **ID** | M1-013 |
| **Goal** | Assign managers to employees; detect circular references (BR-EMP-006) |
| **Dependencies** | M1-010, M1-012 |
| **Files Affected** | `src/modules/employee/services/reporting-service.ts` |
| **Acceptance Criteria** | Manager assignment validated for cycles; removal flags employee as manager-less; notification sent to all parties; audit event recorded |
| **Priority** | P0 |

### M1-014: Employee status transitions

| Field | Value |
|---|---|
| **ID** | M1-014 |
| **Goal** | Implement employee lifecycle state machine (Draft→Invited→Active→Suspended→Deactivated→Archived) |
| **Dependencies** | M1-010 |
| **Files Affected** | `src/modules/employee/services/status-service.ts` |
| **Acceptance Criteria** | Only valid transitions allowed (BR-EMP-003); deactivation cascades (BR-EMP-004); reactivation creates fresh state (BR-CROSS-004); archived excluded from active queries (BR-EMP-008) |
| **Priority** | P0 |

### M1-015: Application shell and navigation

| Field | Value |
|---|---|
| **ID** | M1-015 |
| **Goal** | Build authenticated app layout with role-based navigation, org context display, notification bell |
| **Dependencies** | M1-002, M1-008, M1-005 |
| **Files Affected** | `app/(app)/layout.tsx`, navigation components, shell components |
| **Acceptance Criteria** | Navigation shows only permitted items per role; org name displayed; mobile-responsive sidebar; notification count badge |
| **Priority** | P0 |

### M1-016: Domain event bus (synchronous V1)

| Field | Value |
|---|---|
| **ID** | M1-016 |
| **Goal** | Implement in-process synchronous event bus for domain event emission and consumption |
| **Dependencies** | M0-003 |
| **Files Affected** | `src/shared/events/` |
| **Acceptance Criteria** | Events carry unique eventId; handlers are idempotent; notification failures don't fail originating transaction; audit failures DO fail transaction |
| **Priority** | P0 |

### M1-017: Notification service (in-app)

| Field | Value |
|---|---|
| **ID** | M1-017 |
| **Goal** | Create notifications table, deduplication logic, mark-read endpoints |
| **Dependencies** | M1-016, M1-002 |
| **Files Affected** | `src/modules/notifications/`, notification UI components |
| **Acceptance Criteria** | Notifications scoped to org (BR-NOTIF-003); no duplicates within 5-min window (BR-NOTIF-002); targets Users not Employees (BR-NOTIF-001); mark read/mark all read works |
| **Priority** | P0 |

### M1-018: Cross-tenant isolation tests

| Field | Value |
|---|---|
| **ID** | M1-018 |
| **Goal** | Write integration tests proving data isolation between organisations |
| **Dependencies** | M1-010, M0-008 |
| **Files Affected** | `tests/integration/tenant-isolation/` |
| **Acceptance Criteria** | Tests create two orgs; verify no data leakage on reads, writes, and queries; cover employees, memberships, settings |
| **Priority** | P0 |

---

## M2: Leave Management

**Goal:** Complete leave types, policies, balances, requests, approvals, and team calendar.

---



### M2-001: Leave type and policy schema

| Field | Value |
|---|---|
| **ID** | M2-001 |
| **Goal** | Create leave types (Annual, Sick, Unpaid, etc.) and leave policies with entitlement rules per org |
| **Dependencies** | M1-005, M1-008 |
| **Files Affected** | `src/modules/leave/`, `prisma/schema.prisma` (LeaveType, LeavePolicy) |
| **Acceptance Criteria** | Leave types org-scoped; policies define entitlement, accrual, carry-over; default types seeded on org creation |
| **Priority** | P1 |

### M2-002: Leave balance allocation and calculation

| Field | Value |
|---|---|
| **ID** | M2-002 |
| **Goal** | Allocate leave balances per employee per type; calculate available (allocated - used - pending) |
| **Dependencies** | M2-001, M1-010 |
| **Files Affected** | `src/modules/leave/services/balance-service.ts` |
| **Acceptance Criteria** | Balances allocated on employee creation; pending requests reserve balance (BR-LEAVE-009); half-day deducts 0.5 (BR-LEAVE-011); balance recalculation accurate |
| **Priority** | P1 |

### M2-003: Working day calculator

| Field | Value |
|---|---|
| **ID** | M2-003 |
| **Goal** | Calculate working days between two dates, excluding weekends and org holidays |
| **Dependencies** | M1-006 |
| **Files Affected** | `src/modules/leave/services/working-day-calculator.ts` |
| **Acceptance Criteria** | Respects org working days config; excludes public holidays (BR-LEAVE-005); handles leave spanning weekends; unit tested with various calendar scenarios |
| **Priority** | P1 |

### M2-004: Leave request submission

| Field | Value |
|---|---|
| **ID** | M2-004 |
| **Goal** | Employee submits leave request with validation for overlap, balance, and active status |
| **Dependencies** | M2-002, M2-003, M1-013 |
| **Files Affected** | `src/modules/leave/actions/`, leave request form |
| **Acceptance Criteria** | Overlap detection (BR-LEAVE-001); balance check (BR-LEAVE-002); routes to manager or HR fallback (BR-LEAVE-010); supports half-day; audit and notification created |
| **Priority** | P1 |

### M2-005: Leave approval and rejection

| Field | Value |
|---|---|
| **ID** | M2-005 |
| **Goal** | Manager/HR can approve or reject pending leave with state transition and balance effects |
| **Dependencies** | M2-004 |
| **Files Affected** | `src/modules/leave/services/leave-service.ts`, approval UI |
| **Acceptance Criteria** | Only manager of direct report can approve (BR-LEAVE-004); approval deducts balance (BR-LEAVE-003); rejection releases reservation; HR can override (BR-LEAVE-008); concurrent approval handled (BR-DATA-004) |
| **Priority** | P1 |

### M2-006: Leave cancellation and withdrawal

| Field | Value |
|---|---|
| **ID** | M2-006 |
| **Goal** | Employee can withdraw pending leave; HR can cancel approved future leave; balance restored |
| **Dependencies** | M2-005 |
| **Files Affected** | `src/modules/leave/actions/` |
| **Acceptance Criteria** | Cannot cancel past leave (BR-LEAVE-007); cancellation restores balance (BR-LEAVE-006); HR override works for any state (BR-LEAVE-008); audit event recorded |
| **Priority** | P1 |

### M2-007: Team leave calendar

| Field | Value |
|---|---|
| **ID** | M2-007 |
| **Goal** | Visual calendar showing approved and pending leave for team members |
| **Dependencies** | M2-005, M1-013 |
| **Files Affected** | Leave calendar page/component |
| **Acceptance Criteria** | Manager sees direct reports only; HR sees all; respects permission scoping; shows approved + pending with visual distinction |
| **Priority** | P1 |

### M2-008: Leave management E2E tests

| Field | Value |
|---|---|
| **ID** | M2-008 |
| **Goal** | Playwright tests covering submit → approve → balance update → calendar display |
| **Dependencies** | M2-007 |
| **Files Affected** | `tests/e2e/leave/` |
| **Acceptance Criteria** | Full approval flow passes; rejection flow passes; overlap detection tested; permission denial tested |
| **Priority** | P1 |

---

## M3: Attendance

**Goal:** Clock in/out, attendance history, corrections, timezone handling, missing clock-out detection.

---

### M3-001: Attendance schema and model

| Field | Value |
|---|---|
| **ID** | M3-001 |
| **Goal** | Create attendance records table with UTC timestamps, duration, location type, status |
| **Dependencies** | M1-010, M1-006 |
| **Files Affected** | `src/modules/attendance/`, `prisma/schema.prisma` (AttendanceRecord, AttendanceCorrection) |
| **Acceptance Criteria** | Timestamps stored UTC (BR-ATT-002); duration auto-calculated (BR-ATT-009); corrections linked to original; org-scoped |
| **Priority** | P1 |

### M3-002: Clock in action

| Field | Value |
|---|---|
| **ID** | M3-002 |
| **Goal** | Employee clocks in; prevent duplicate (BR-ATT-001); check leave status (BR-ATT-008) |
| **Dependencies** | M3-001, M2-004 |
| **Files Affected** | `src/modules/attendance/actions/`, clock widget component |
| **Acceptance Criteria** | No duplicate clock-in; cannot clock in on full-day leave; cannot clock in on holiday; records org timezone date; audit event (low severity) |
| **Priority** | P1 |



### M3-003: Clock out action

| Field | Value |
|---|---|
| **ID** | M3-003 |
| **Goal** | Employee clocks out; calculate duration; handle overnight sessions (BR-ATT-007) |
| **Dependencies** | M3-002 |
| **Files Affected** | `src/modules/attendance/actions/` |
| **Acceptance Criteria** | Must have open session (BR-ATT-006); duration calculated automatically; overnight session belongs to clock-in date; dashboard metrics updated |
| **Priority** | P1 |

### M3-004: Attendance history and monthly summary

| Field | Value |
|---|---|
| **ID** | M3-004 |
| **Goal** | View attendance history with date range filter; monthly summary with total hours |
| **Dependencies** | M3-003 |
| **Files Affected** | Attendance history page, monthly summary component |
| **Acceptance Criteria** | Displays in org timezone; paginated; filterable by date; shows duration per day; totals for month; permission-scoped (own/team/all) |
| **Priority** | P1 |

### M3-005: Attendance correction by HR

| Field | Value |
|---|---|
| **ID** | M3-005 |
| **Goal** | HR can correct clock-in/out times with mandatory reason; original preserved |
| **Dependencies** | M3-003, M1-009 |
| **Files Affected** | `src/modules/attendance/services/`, correction form |
| **Acceptance Criteria** | Only HR can correct (BR-ATT-004); reason required (BR-ATT-003); original values preserved; elevated audit event; employee notified |
| **Priority** | P1 |

### M3-006: Missing clock-out detection

| Field | Value |
|---|---|
| **ID** | M3-006 |
| **Goal** | Background job flags sessions open past working hours + 2h buffer (BR-ATT-005) |
| **Dependencies** | M3-003, M0-006 |
| **Files Affected** | `src/infrastructure/jobs/missing-clockout.ts` |
| **Acceptance Criteria** | Runs hourly; flags open sessions past threshold; HR dashboard shows count; does not auto-close (requires HR correction) |
| **Priority** | P1 |

### M3-007: Attendance E2E tests

| Field | Value |
|---|---|
| **ID** | M3-007 |
| **Goal** | Playwright tests for clock in/out flow, history view, correction |
| **Dependencies** | M3-005 |
| **Files Affected** | `tests/e2e/attendance/` |
| **Acceptance Criteria** | Full clock cycle passes; duplicate prevention tested; correction flow tested; leave-day blocking tested |
| **Priority** | P1 |

---

## M4: Onboarding

**Goal:** Templates, task instantiation, assignment, completion tracking, cancellation on deactivation.

---

### M4-001: Onboarding template CRUD

| Field | Value |
|---|---|
| **ID** | M4-001 |
| **Goal** | Create, edit, archive onboarding templates with tasks (title, description, assignee role, relative due day) |
| **Dependencies** | M1-005, M1-008 |
| **Files Affected** | `src/modules/onboarding/`, template management pages |
| **Acceptance Criteria** | Templates org-scoped; tasks have relative due dates; templates can be archived; only HR can manage |
| **Priority** | P1 |

### M4-002: Onboarding assignment (template instantiation)

| Field | Value |
|---|---|
| **ID** | M4-002 |
| **Goal** | Apply template to employee; create snapshot of tasks with calculated due dates |
| **Dependencies** | M4-001, M1-010, M1-013 |
| **Files Affected** | `src/modules/onboarding/services/onboarding-service.ts` |
| **Acceptance Criteria** | Instantiation is a snapshot (BR-ONB-001); due dates relative to join date (BR-ONB-002); single active onboarding per employee (BR-ONB-006); notifications sent to all assignees |
| **Priority** | P1 |

### M4-003: Task completion and reopening

| Field | Value |
|---|---|
| **ID** | M4-003 |
| **Goal** | Assignees complete tasks; only HR can reopen; detect onboarding completion |
| **Dependencies** | M4-002 |
| **Files Affected** | `src/modules/onboarding/services/task-service.ts`, task list UI |
| **Acceptance Criteria** | Only assigned owner completes (BR-ONB-003); completed tasks only reopened by HR (BR-ONB-004); all tasks done → onboarding complete; notifications appropriate |
| **Priority** | P1 |

### M4-004: Overdue task tracking

| Field | Value |
|---|---|
| **ID** | M4-004 |
| **Goal** | Dashboard widget and list view for overdue onboarding tasks |
| **Dependencies** | M4-003 |
| **Files Affected** | Overdue tasks page, dashboard widget |
| **Acceptance Criteria** | Tasks past due date flagged; HR can view all overdue; manager sees team's overdue; filterable by employee/assignee |
| **Priority** | P1 |

### M4-005: Onboarding cancellation on deactivation

| Field | Value |
|---|---|
| **ID** | M4-005 |
| **Goal** | Employee deactivation cascades to cancel active onboarding (BR-ONB-005) |
| **Dependencies** | M4-002, M1-014 |
| **Files Affected** | `src/modules/onboarding/`, `src/modules/employee/` |
| **Acceptance Criteria** | Deactivation cancels all incomplete tasks; cancellation reason recorded; audit event created; integration test covers cascade |
| **Priority** | P1 |

---

## M5: Documents

**Goal:** Document categories, upload/download with storage adapter, expiry tracking, visibility permissions.

---



### M5-001: Storage adapter interface and local implementation

| Field | Value |
|---|---|
| **ID** | M5-001 |
| **Goal** | Define StorageAdapter interface; implement local filesystem adapter; support S3 via env toggle |
| **Dependencies** | M0-002 |
| **Files Affected** | `src/shared/storage/` |
| **Acceptance Criteria** | Interface defines upload, download, delete, generateUrl; local adapter stores to Docker volume; paths include org_id (BR-DOC-003); contract tests pass for both implementations |
| **Priority** | P1 |

### M5-002: Document categories

| Field | Value |
|---|---|
| **ID** | M5-002 |
| **Goal** | Create document categories with visibility/sensitivity settings (e.g., General, Medical, Financial) |
| **Dependencies** | M1-005, M1-008 |
| **Files Affected** | `src/modules/documents/`, category management UI |
| **Acceptance Criteria** | Categories org-scoped; define visibility rules (HR-only, employee+manager, all); seed defaults on org creation |
| **Priority** | P1 |

### M5-003: Document upload

| Field | Value |
|---|---|
| **ID** | M5-003 |
| **Goal** | Upload employee documents with file type validation (magic bytes), size limit, and metadata |
| **Dependencies** | M5-001, M5-002, M1-010 |
| **Files Affected** | `src/modules/documents/services/document-service.ts`, upload form |
| **Acceptance Criteria** | File type validated via magic bytes (BR-DOC-001); 10MB limit (BR-DOC-002); compensating cleanup on DB failure (BR-DOC-007); audit event; notification if uploaded by HR |
| **Priority** | P1 |

### M5-004: Document download and visibility

| Field | Value |
|---|---|
| **ID** | M5-004 |
| **Goal** | Serve documents with permission checks based on category visibility settings |
| **Dependencies** | M5-003 |
| **Files Affected** | `src/modules/documents/services/visibility-service.ts`, download handler |
| **Acceptance Criteria** | Access controlled by category setting (BR-DOC-004); signed URLs with 5-min expiry; tenant validation on every access; audit for sensitive docs |
| **Priority** | P1 |

### M5-005: Document expiry tracking

| Field | Value |
|---|---|
| **ID** | M5-005 |
| **Goal** | Set expiry dates; background job notifies at 30 and 7 days (BR-DOC-005) |
| **Dependencies** | M5-003, M1-017 |
| **Files Affected** | `src/infrastructure/jobs/document-expiry.ts`, expiry notification handler |
| **Acceptance Criteria** | Daily job checks expiry dates; 30-day warning notification; 7-day critical notification; expired flag set; dashboard widget shows expiring docs |
| **Priority** | P1 |

### M5-006: Document soft-delete and retention

| Field | Value |
|---|---|
| **ID** | M5-006 |
| **Goal** | Soft-delete documents with 90-day retention before permanent removal (BR-DOC-006) |
| **Dependencies** | M5-003 |
| **Files Affected** | `src/modules/documents/`, `src/infrastructure/jobs/document-cleanup.ts` |
| **Acceptance Criteria** | Delete sets deleted_at flag; document hidden from UI; background job removes after 90 days; audit event on delete |
| **Priority** | P1 |

---

## M6: Payroll

**Goal:** Payroll periods, records, line items, approval workflow, payslip publication.

---

### M6-001: Payroll period lifecycle

| Field | Value |
|---|---|
| **ID** | M6-001 |
| **Goal** | Create payroll periods with strict lifecycle (Draft→Under Review→Approved→Published→Paid) |
| **Dependencies** | M1-005, M1-008, M1-009 |
| **Files Affected** | `src/modules/payroll/`, `prisma/schema.prisma` (PayrollPeriod, PayrollRecord, PayrollLineItem) |
| **Acceptance Criteria** | Only valid transitions (BR-PAY-004); restricted to Owner + HR (BR-PAY-003); elevated audit events |
| **Priority** | P2 |

### M6-002: Payroll record generation

| Field | Value |
|---|---|
| **ID** | M6-002 |
| **Goal** | Generate payroll records for all active employees in a period |
| **Dependencies** | M6-001, M1-010 |
| **Files Affected** | `src/modules/payroll/services/record-service.ts` |
| **Acceptance Criteria** | Only active employees included (BR-PAY-006); batch creation in single transaction; uses integer cents (BR-PAY-001) |
| **Priority** | P2 |

### M6-003: Line item management

| Field | Value |
|---|---|
| **ID** | M6-003 |
| **Goal** | Add/remove earnings, allowances, deductions per employee per period |
| **Dependencies** | M6-002 |
| **Files Affected** | `src/modules/payroll/services/`, record editor UI |
| **Acceptance Criteria** | All values in integer cents; gross calculated from earnings + allowances; net = gross - deductions (BR-PAY-005); no floating point operations on money |
| **Priority** | P2 |

### M6-004: Payroll approval and publication

| Field | Value |
|---|---|
| **ID** | M6-004 |
| **Goal** | Approve payroll (validate net pay equation); publish payslips to employees |
| **Dependencies** | M6-003, M1-017 |
| **Files Affected** | `src/modules/payroll/services/`, payslip view |
| **Acceptance Criteria** | Validation ensures net = gross - deductions for all records (BR-PAY-005); publication generates payslips; employees notified; published payslips immutable (BR-PAY-002); elevated audit |
| **Priority** | P2 |

### M6-005: Payroll reopening

| Field | Value |
|---|---|
| **ID** | M6-005 |
| **Goal** | Allow Owner to reopen published payroll with mandatory reason and high-severity audit (BR-PAY-007) |
| **Dependencies** | M6-004 |
| **Files Affected** | `src/modules/payroll/services/` |
| **Acceptance Criteria** | Reason required; high-severity audit event; payslips retracted; state returns to Draft |
| **Priority** | P2 |

### M6-006: Employee payslip view

| Field | Value |
|---|---|
| **ID** | M6-006 |
| **Goal** | Employees can view their own published payslips with line item breakdown |
| **Dependencies** | M6-004 |
| **Files Affected** | Payslip page (employee view) |
| **Acceptance Criteria** | Employees see only own payslips (BR-PERM-005); shows earnings, deductions, net; access restricted to published status only |
| **Priority** | P2 |

---

## M7: Polish + Deploy

**Goal:** Dashboard refinement, responsive design, accessibility, security review, seed data, deployment.

---



### M7-001: Admin dashboard with real metrics

| Field | Value |
|---|---|
| **ID** | M7-001 |
| **Goal** | Build admin/HR dashboard with active employees, present today, on leave, pending requests, overdue tasks, expiring docs |
| **Dependencies** | M1-010, M2-004, M3-002, M4-004, M5-005 |
| **Files Affected** | Admin dashboard page, metric query services |
| **Acceptance Criteria** | All metrics are real data (not mocked); permission-appropriate; handles empty state; no query waterfalls (optimised aggregations) |
| **Priority** | P1 |

### M7-002: Employee self-service dashboard

| Field | Value |
|---|---|
| **ID** | M7-002 |
| **Goal** | Employee dashboard with quick clock-in, leave balance, pending requests, onboarding progress, recent notifications |
| **Dependencies** | M1-010, M2-002, M3-002, M4-003 |
| **Files Affected** | Employee dashboard page |
| **Acceptance Criteria** | Shows only own data; clock-in widget functional; leave balance accurate; onboarding progress shown; responsive |
| **Priority** | P1 |

### M7-003: Responsive design verification

| Field | Value |
|---|---|
| **ID** | M7-003 |
| **Goal** | Verify and fix all pages at desktop (1280px+), tablet (768px), and mobile (375px) widths |
| **Dependencies** | All UI tasks |
| **Files Affected** | All page components |
| **Acceptance Criteria** | No horizontal overflow; touch targets ≥44px on mobile; navigation collapses properly; tables scroll or stack; screenshots captured at all widths |
| **Priority** | P1 |

### M7-004: Accessibility audit

| Field | Value |
|---|---|
| **ID** | M7-004 |
| **Goal** | Ensure WCAG 2.1 AA compliance: proper labels, keyboard navigation, ARIA attributes, colour contrast |
| **Dependencies** | All UI tasks |
| **Files Affected** | All page components, form components |
| **Acceptance Criteria** | All forms have associated labels; focus order logical; no keyboard traps; colour contrast ≥4.5:1; screen reader tested on critical flows |
| **Priority** | P1 |

### M7-005: Seed data (Northstar Studios)

| Field | Value |
|---|---|
| **ID** | M7-005 |
| **Goal** | Create realistic demo organisation with Owner, HR admin, 2 managers, 8+ employees, departments, history |
| **Dependencies** | All domain modules |
| **Files Affected** | `prisma/seed.ts`, `README.md` |
| **Acceptance Criteria** | Seed creates complete org with attendance history, pending/approved leave, onboarding tasks, documents, payroll records, notifications, audit history; development credentials documented |
| **Priority** | P1 |

### M7-006: Security review

| Field | Value |
|---|---|
| **ID** | M7-006 |
| **Goal** | Review all endpoints for: auth bypass, tenant leakage, permission escalation, injection, CSRF |
| **Dependencies** | All domain modules |
| **Files Affected** | All server actions, middleware, repositories |
| **Acceptance Criteria** | No endpoint accessible without auth (except public routes); no cross-tenant data accessible; all mutations CSRF-protected; no SQL injection vectors; sensitive data not logged |
| **Priority** | P0 |

### M7-007: Production deployment configuration

| Field | Value |
|---|---|
| **ID** | M7-007 |
| **Goal** | Docker Compose production config with Caddy TLS, env file, health checks, migration on startup |
| **Dependencies** | M0-006 |
| **Files Affected** | `docker-compose.prod.yml`, `Caddyfile`, deployment docs |
| **Acceptance Criteria** | `docker compose -f docker-compose.prod.yml up` starts full stack; TLS enabled via Caddy; migrations run before traffic; health check endpoint works; `.env.production.example` documented |
| **Priority** | P1 |

### M7-008: CI pipeline

| Field | Value |
|---|---|
| **ID** | M7-008 |
| **Goal** | GitHub Actions pipeline: type check → lint → unit tests → integration tests → E2E → build |
| **Dependencies** | M0-005, M7-006 |
| **Files Affected** | `.github/workflows/ci.yml` |
| **Acceptance Criteria** | Pipeline fails fast on type errors; all test levels run; E2E uses test DB; production build succeeds; badge in README |
| **Priority** | P1 |

### M7-009: README and documentation

| Field | Value |
|---|---|
| **ID** | M7-009 |
| **Goal** | Complete README with setup instructions, architecture overview, demo credentials, development workflow |
| **Dependencies** | M7-005, M7-007 |
| **Files Affected** | `README.md` |
| **Acceptance Criteria** | A new developer can clone, run, and use the app by following README alone; demo credentials listed; common issues documented |
| **Priority** | P1 |

### M7-010: Audit log UI

| Field | Value |
|---|---|
| **ID** | M7-010 |
| **Goal** | Build audit log viewer with filtering by action, actor, target, date range |
| **Dependencies** | M1-009 |
| **Files Affected** | Audit log page |
| **Acceptance Criteria** | Paginated; filterable; restricted to Owner + HR (BR-AUDIT-006); shows before/after diff for updates; no edit/delete actions available |
| **Priority** | P1 |

---

## Task Summary

| Milestone | Task Count | Priority | Dependencies |
|---|---|---|---|
| M0: Foundation | 8 | P0 | None |
| M1: Auth + Org + Employee | 18 | P0 | M0 |
| M2: Leave Management | 8 | P1 | M1 |
| M3: Attendance | 7 | P1 | M1, partial M2 |
| M4: Onboarding | 5 | P1 | M1 |
| M5: Documents | 6 | P1 | M1 |
| M6: Payroll | 6 | P2 | M1 |
| M7: Polish + Deploy | 10 | P0/P1 | All |
| **Total** | **68** | | |

---

## Milestone Completion Gates

| Milestone | Gate Criteria |
|---|---|
| M0 | Build passes; tests run; DB migrates; Docker Compose works |
| M1 | User can register, login, create org, add employee, view directory; cross-tenant tests pass |
| M2 | Employee submits leave; manager approves; balance updates; calendar shows leave |
| M3 | Employee clocks in/out; history displays; HR corrects; missing clock-out detected |
| M4 | HR assigns onboarding; tasks appear; assignees complete; completion detected |
| M5 | HR uploads document; employee views (permitted); expiry notification fires |
| M6 | HR creates payroll period; adds records; approves; publishes payslips; employee views own |
| M7 | Production build works; dashboards show real data; responsive; accessible; seed data works; CI green |
