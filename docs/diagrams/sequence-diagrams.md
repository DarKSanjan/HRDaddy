# Sequence Diagrams — HR Daddy V1

This document contains Mermaid sequence diagrams for all major HR Daddy workflows. Each diagram shows the happy path and one alternative failure path. Diagrams are focused (10–15 interactions max) for readability.

---

## Table of Contents

1. [Registration](#1-registration)
2. [Sign In](#2-sign-in)
3. [Password Reset](#3-password-reset)
4. [Invitation Acceptance](#4-invitation-acceptance)
5. [Organisation Setup](#5-organisation-setup)
6. [Employee Creation (with Login)](#6-employee-creation-with-login)
7. [Employee Creation (without Login)](#7-employee-creation-without-login)
8. [Leave Request](#8-leave-request)
9. [Leave Approval](#9-leave-approval)
10. [Clock In](#10-clock-in)
11. [Clock Out](#11-clock-out)
12. [Attendance Correction](#12-attendance-correction)
13. [Onboarding Assignment](#13-onboarding-assignment)
14. [Document Upload](#14-document-upload)
15. [Document Download](#15-document-download)
16. [Payroll Publication](#16-payroll-publication)
17. [Dashboard Loading](#17-dashboard-loading)

---


## 1. Registration

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Validation
    participant AuthService
    participant DB
    participant EmailService

    User->>Browser: Fill registration form (name, email, password)
    Browser->>Browser: Client-side validation (password strength)
    Browser->>Server: POST /auth/register
    Server->>Validation: Validate input schema (Zod)
    Validation-->>Server: Valid
    Server->>AuthService: Check email uniqueness
    AuthService->>DB: SELECT user WHERE email = ?
    DB-->>AuthService: No existing user
    AuthService->>AuthService: Hash password (bcrypt)
    AuthService->>DB: INSERT user (status: unverified)
    DB-->>AuthService: User created
    AuthService->>AuthService: Generate verification token (24h expiry)
    AuthService->>DB: INSERT verification_token
    AuthService->>EmailService: Send verification email
    EmailService-->>AuthService: Queued
    Server-->>Browser: 201 Created — "Check your email"
    Browser-->>User: Display success message

    alt Email already registered
        AuthService->>DB: SELECT user WHERE email = ?
        DB-->>AuthService: User exists
        Server-->>Browser: 200 OK — "Check your email" (no enumeration)
        Browser-->>User: Same success message (prevents email discovery)
    end
```

---


## 2. Sign In

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant AuthService
    participant DB
    participant SessionStore

    User->>Browser: Enter email and password
    Browser->>Server: POST /auth/sign-in
    Server->>AuthService: Authenticate credentials
    AuthService->>DB: SELECT user WHERE email = ?
    DB-->>AuthService: User record (hashed password, status)
    AuthService->>AuthService: Verify password hash (bcrypt compare)
    AuthService->>AuthService: Check account status (verified, not locked)
    AuthService->>DB: Reset failed_attempts counter
    AuthService->>SessionStore: Create session (HttpOnly, Secure, SameSite)
    SessionStore-->>AuthService: Session ID
    AuthService->>DB: SELECT memberships WHERE user_id = ?
    DB-->>AuthService: Active memberships list
    AuthService-->>Server: Auth success + org context
    Server-->>Browser: 200 OK + Set-Cookie (session) + redirect URL
    Browser-->>User: Redirect to dashboard (or org setup if no org)

    alt Account locked (5+ failed attempts)
        AuthService->>DB: SELECT user WHERE email = ?
        DB-->>AuthService: User record (locked_until > now)
        AuthService-->>Server: Account locked error
        Server-->>Browser: 403 — "Account temporarily locked"
        Browser-->>User: Display lockout message with retry time
    end
```

---


## 3. Password Reset

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant AuthService
    participant DB
    participant EmailService
    participant SessionStore

    User->>Browser: Click "Forgot Password", enter email
    Browser->>Server: POST /auth/password-reset/request
    Server->>AuthService: Initiate password reset
    AuthService->>DB: SELECT user WHERE email = ?
    DB-->>AuthService: User exists (or not)
    AuthService->>AuthService: Generate reset token (1h expiry)
    AuthService->>DB: INSERT password_reset_token
    AuthService->>EmailService: Send reset email with link
    EmailService-->>AuthService: Queued
    Server-->>Browser: 200 OK — "If account exists, check email"
    Browser-->>User: Generic success (no email enumeration)

    User->>Browser: Click reset link, enter new password
    Browser->>Server: POST /auth/password-reset/confirm
    Server->>AuthService: Validate token + update password
    AuthService->>DB: SELECT token (valid, not expired, not used)
    DB-->>AuthService: Token valid
    AuthService->>AuthService: Hash new password
    AuthService->>DB: UPDATE user SET password_hash = ?
    AuthService->>DB: Invalidate token (mark used)
    AuthService->>SessionStore: Invalidate ALL existing sessions (BR-AUTH-002)
    Server-->>Browser: 200 OK — "Password updated, please sign in"
    Browser-->>User: Redirect to sign-in

    alt Token expired
        AuthService->>DB: SELECT token WHERE token = ?
        DB-->>AuthService: Token found but expires_at < now
        Server-->>Browser: 400 — "Reset link has expired"
        Browser-->>User: Display error + "Request new link" option
    end
```

---


## 4. Invitation Acceptance

```mermaid
sequenceDiagram
    participant Invitee
    participant Browser
    participant Server
    participant AuthService
    participant MembershipService
    participant DB
    participant NotificationService

    Invitee->>Browser: Click invitation link from email
    Browser->>Server: GET /invite/accept?token=xyz
    Server->>AuthService: Validate invitation token
    AuthService->>DB: SELECT invitation WHERE token = ? AND status = 'pending'
    DB-->>AuthService: Invitation (role, org_id, email, expires_at)
    AuthService->>AuthService: Check not expired (< 7 days, BR-AUTH-003)
    AuthService-->>Server: Token valid — show registration form
    Server-->>Browser: Registration form (email pre-filled, read-only)

    Invitee->>Browser: Enter name and password
    Browser->>Server: POST /invite/accept
    Server->>AuthService: Create account + accept invitation
    AuthService->>DB: INSERT user (status: verified — invitation proves email)
    DB-->>AuthService: User created
    AuthService->>MembershipService: Create membership
    MembershipService->>DB: INSERT membership (user_id, org_id, role)
    MembershipService->>DB: UPDATE invitation SET status = 'accepted'
    MembershipService->>DB: UPDATE employee SET status = 'active' WHERE email = ?
    DB-->>MembershipService: All committed (single transaction)
    MembershipService->>NotificationService: Notify inviter (accepted)
    NotificationService-->>MembershipService: Queued
    Server-->>Browser: 200 OK — redirect to org dashboard
    Browser-->>Invitee: Signed in to organisation

    alt Invitation expired (> 7 days)
        AuthService->>DB: SELECT invitation WHERE token = ?
        DB-->>AuthService: Invitation found but expires_at < now
        Server-->>Browser: 410 Gone — "Invitation has expired"
        Browser-->>Invitee: Display error + "Contact HR for a new invitation"
    end
```

---


## 5. Organisation Setup

```mermaid
sequenceDiagram
    participant Owner
    participant Browser
    participant Server
    participant OrgService
    participant DB
    participant AuditService

    Owner->>Browser: Enter organisation name ("Northstar Studios")
    Browser->>Server: POST /organisations
    Server->>OrgService: Create organisation
    OrgService->>DB: BEGIN TRANSACTION
    OrgService->>DB: INSERT organisation (name, status: active)
    OrgService->>DB: INSERT organisation_settings (defaults: UTC, USD, Mon-Fri)
    OrgService->>DB: INSERT membership (user_id, org_id, role: owner)
    OrgService->>DB: INSERT default leave_types (Annual, Sick, Unpaid)
    OrgService->>DB: INSERT default document_categories (Identity, Contracts, Certs)
    OrgService->>DB: COMMIT
    DB-->>OrgService: Transaction committed
    OrgService->>AuditService: Record OrganisationCreated event
    AuditService-->>OrgService: Logged
    Server-->>Browser: 201 Created — org_id + redirect to setup wizard
    Browser-->>Owner: Display setup wizard (timezone, schedule, leave year)

    Owner->>Browser: Configure settings (timezone, currency, working days)
    Browser->>Server: PUT /organisations/:id/settings
    Server->>OrgService: Update settings
    OrgService->>DB: UPDATE organisation_settings
    OrgService->>AuditService: Record SettingsUpdated event
    Server-->>Browser: 200 OK
    Browser-->>Owner: Wizard advances to next step

    alt Organisation name already taken (same user)
        OrgService->>DB: INSERT organisation
        DB-->>OrgService: Unique constraint violation
        Server-->>Browser: 409 Conflict — "Organisation name unavailable"
        Browser-->>Owner: Display error with suggestion to edit name
    end
```

---


## 6. Employee Creation (with Login)

```mermaid
sequenceDiagram
    participant HR
    participant Browser
    participant Server
    participant PermissionService
    participant EmployeeService
    participant DB
    participant NotificationService
    participant EmailService
    participant AuditService

    HR->>Browser: Fill employee form + check "Send login invitation"
    Browser->>Server: POST /employees (with invite: true)
    Server->>PermissionService: Check employee.write permission
    PermissionService-->>Server: Granted (HR Admin role)
    Server->>EmployeeService: Create employee + invitation
    EmployeeService->>DB: Validate work_email unique in org (BR-EMP-002)
    DB-->>EmployeeService: No conflict
    EmployeeService->>DB: BEGIN TRANSACTION
    EmployeeService->>DB: INSERT employee (status: invited, org_id)
    EmployeeService->>DB: INSERT invitation (email, role: employee, 7-day expiry)
    EmployeeService->>DB: COMMIT
    DB-->>EmployeeService: Committed
    EmployeeService->>EmailService: Send invitation email to employee
    EmployeeService->>NotificationService: Notify HR — "Employee created"
    EmployeeService->>AuditService: Record EmployeeCreated + InvitationSent
    Server-->>Browser: 201 Created — employee record
    Browser-->>HR: Show success + "Invitation sent to employee"

    alt Duplicate work email in organisation
        EmployeeService->>DB: Validate work_email unique
        DB-->>EmployeeService: Constraint violation
        Server-->>Browser: 409 Conflict — "Employee with this email already exists"
        Browser-->>HR: Display error with link to existing employee
    end
```

---


## 7. Employee Creation (without Login)

```mermaid
sequenceDiagram
    participant HR
    participant Browser
    participant Server
    participant PermissionService
    participant EmployeeService
    participant DB
    participant AuditService

    HR->>Browser: Fill employee form (no login invitation)
    Browser->>Server: POST /employees (with invite: false)
    Server->>PermissionService: Check employee.write permission
    PermissionService-->>Server: Granted (HR Admin role)
    Server->>EmployeeService: Create employee record only
    EmployeeService->>DB: Validate work_email unique in org (BR-EMP-002)
    DB-->>EmployeeService: No conflict
    EmployeeService->>DB: INSERT employee (status: draft, org_id, user_id: NULL)
    DB-->>EmployeeService: Employee created
    EmployeeService->>AuditService: Record EmployeeCreated (no login)
    AuditService-->>EmployeeService: Logged
    Server-->>Browser: 201 Created — employee record
    Browser-->>HR: Show success — "Employee added (no platform access)"

    alt Validation failure (missing required fields)
        Server->>EmployeeService: Validate input schema
        EmployeeService-->>Server: Validation error (missing first_name)
        Server-->>Browser: 422 Unprocessable — field errors
        Browser-->>HR: Display inline validation errors
    end
```

---


## 8. Leave Request

```mermaid
sequenceDiagram
    participant Employee
    participant Browser
    participant Server
    participant PermissionService
    participant LeaveService
    participant BalanceService
    participant CalendarService
    participant DB
    participant NotificationService
    participant AuditService

    Employee->>Browser: Fill leave form (type, dates, reason)
    Browser->>Server: POST /leave-requests
    Server->>PermissionService: Check leave.request.create (own)
    PermissionService-->>Server: Granted
    Server->>LeaveService: Submit leave request
    LeaveService->>CalendarService: Calculate working days (exclude weekends + holidays)
    CalendarService-->>LeaveService: 3 working days
    LeaveService->>DB: Check overlapping requests (BR-LEAVE-001)
    DB-->>LeaveService: No overlap
    LeaveService->>BalanceService: Check sufficient balance (BR-LEAVE-002)
    BalanceService->>DB: SELECT balance WHERE employee + leave_type
    DB-->>BalanceService: Available: 15 days
    BalanceService-->>LeaveService: Sufficient (15 >= 3)
    LeaveService->>DB: INSERT leave_request (status: pending)
    LeaveService->>BalanceService: Reserve balance (15 → 12 available, BR-LEAVE-009)
    LeaveService->>NotificationService: Notify approver (manager or HR)
    LeaveService->>AuditService: Record LeaveRequestSubmitted
    Server-->>Browser: 201 Created — request pending
    Browser-->>Employee: Show success — "Leave submitted, awaiting approval"

    alt Insufficient balance
        BalanceService->>DB: SELECT balance
        DB-->>BalanceService: Available: 2 days
        BalanceService-->>LeaveService: Insufficient (2 < 3)
        Server-->>Browser: 422 — "Insufficient leave balance (2 days available)"
        Browser-->>Employee: Display balance error with current availability
    end
```

---


## 9. Leave Approval

```mermaid
sequenceDiagram
    participant Manager
    participant Browser
    participant Server
    participant PermissionService
    participant LeaveService
    participant BalanceService
    participant DB
    participant NotificationService
    participant AuditService

    Manager->>Browser: Click "Approve" on pending leave request
    Browser->>Server: POST /leave-requests/:id/approve
    Server->>PermissionService: Check leave.request.approve (scoped)
    PermissionService->>DB: Verify reporting relationship (BR-LEAVE-004)
    DB-->>PermissionService: Manager is direct supervisor — granted
    Server->>LeaveService: Approve leave request
    LeaveService->>DB: SELECT leave_request WHERE id = ? AND status = 'pending'
    DB-->>LeaveService: Request found (pending)
    LeaveService->>LeaveService: Verify not self-approval
    LeaveService->>DB: UPDATE leave_request SET status = 'approved' (optimistic lock)
    LeaveService->>BalanceService: Confirm balance deduction (BR-LEAVE-003)
    BalanceService->>DB: UPDATE leave_balance (deduct working days)
    LeaveService->>DB: INSERT leave_approval (approver, decision, timestamp)
    LeaveService->>NotificationService: Notify employee — "Leave approved"
    LeaveService->>AuditService: Record LeaveApproved event
    Server-->>Browser: 200 OK — "Leave approved"
    Browser-->>Manager: Show success confirmation

    alt Concurrent approval (optimistic lock conflict)
        LeaveService->>DB: UPDATE leave_request WHERE version = ?
        DB-->>LeaveService: 0 rows affected (version mismatch)
        Server-->>Browser: 409 Conflict — "Request already decided"
        Browser-->>Manager: Display "This request was already processed"
    end
```

---


## 10. Clock In

```mermaid
sequenceDiagram
    participant Employee
    participant Browser
    participant Server
    participant PermissionService
    participant AttendanceService
    participant LeaveService
    participant DB
    participant AuditService

    Employee->>Browser: Click "Clock In" button (select Office/Remote)
    Browser->>Server: POST /attendance/clock-in
    Server->>PermissionService: Check attendance.clock (own)
    PermissionService-->>Server: Granted
    Server->>AttendanceService: Process clock-in
    AttendanceService->>DB: SELECT open session WHERE employee_id AND clock_out IS NULL
    DB-->>AttendanceService: No open session (BR-ATT-001 satisfied)
    AttendanceService->>LeaveService: Check approved full-day leave today (BR-ATT-008)
    LeaveService->>DB: SELECT approved leave covering today
    DB-->>LeaveService: No leave today
    LeaveService-->>AttendanceService: No conflict
    AttendanceService->>AttendanceService: Generate timestamp (UTC, server-side)
    AttendanceService->>DB: INSERT attendance_record (clock_in, org_timezone, type)
    DB-->>AttendanceService: Record created
    AttendanceService->>AuditService: Record ClockedIn event
    Server-->>Browser: 200 OK — clock-in time + session ID
    Browser-->>Employee: Show "Clocked in at 09:05" + duration timer starts

    alt Already clocked in (duplicate, BR-ATT-001)
        AttendanceService->>DB: SELECT open session
        DB-->>AttendanceService: Open session exists (clock_in: 08:30)
        Server-->>Browser: 422 — "Already clocked in since 08:30"
        Browser-->>Employee: Display current session info
    end
```

---


## 11. Clock Out

```mermaid
sequenceDiagram
    participant Employee
    participant Browser
    participant Server
    participant PermissionService
    participant AttendanceService
    participant DB
    participant AuditService

    Employee->>Browser: Click "Clock Out" button
    Browser->>Server: POST /attendance/clock-out
    Server->>PermissionService: Check attendance.clock (own)
    PermissionService-->>Server: Granted
    Server->>AttendanceService: Process clock-out
    AttendanceService->>DB: SELECT open session WHERE employee_id AND clock_out IS NULL
    DB-->>AttendanceService: Open session found (clock_in: 09:05 UTC)
    AttendanceService->>AttendanceService: Generate clock-out timestamp (UTC)
    AttendanceService->>AttendanceService: Calculate duration (clock_out - clock_in = 8h25m)
    AttendanceService->>DB: UPDATE attendance_record SET clock_out, duration, status='closed'
    DB-->>AttendanceService: Record updated
    AttendanceService->>AuditService: Record ClockedOut event
    Server-->>Browser: 200 OK — duration summary
    Browser-->>Employee: Show "Clocked out at 17:30. Total: 8h 25m"

    alt No open session (BR-ATT-006)
        AttendanceService->>DB: SELECT open session
        DB-->>AttendanceService: No open session found
        Server-->>Browser: 422 — "Not currently clocked in"
        Browser-->>Employee: Display "You are not clocked in" with Clock In option
    end
```

---


## 12. Attendance Correction

```mermaid
sequenceDiagram
    participant HR
    participant Browser
    participant Server
    participant PermissionService
    participant AttendanceService
    participant DB
    participant NotificationService
    participant AuditService

    HR->>Browser: Select record, enter corrected time + reason
    Browser->>Server: POST /attendance/:id/correct
    Server->>PermissionService: Check attendance.correct permission
    PermissionService-->>Server: Granted (HR Admin, BR-ATT-004)
    Server->>AttendanceService: Apply correction
    AttendanceService->>DB: SELECT original record
    DB-->>AttendanceService: Original (clock_in: 09:05, clock_out: NULL)
    AttendanceService->>AttendanceService: Validate corrected time is logical
    AttendanceService->>AttendanceService: Validate reason is non-empty (BR-ATT-003)
    AttendanceService->>DB: BEGIN TRANSACTION
    AttendanceService->>DB: UPDATE original record (mark as corrected, preserve original values)
    AttendanceService->>DB: INSERT correction record (new times, reason, corrected_by)
    AttendanceService->>DB: Recalculate duration (BR-ATT-009)
    AttendanceService->>DB: COMMIT
    DB-->>AttendanceService: Committed
    AttendanceService->>NotificationService: Notify employee — "Attendance corrected"
    AttendanceService->>AuditService: Record AttendanceCorrected (before/after, BR-AUDIT-003)
    Server-->>Browser: 200 OK — correction applied
    Browser-->>HR: Show success + updated record

    alt Missing reason (BR-ATT-003)
        AttendanceService->>AttendanceService: Validate reason
        Server-->>Browser: 422 — "Correction reason is required"
        Browser-->>HR: Display validation error on reason field
    end
```

---


## 13. Onboarding Assignment

```mermaid
sequenceDiagram
    participant HR
    participant Browser
    participant Server
    participant PermissionService
    participant OnboardingService
    participant DB
    participant NotificationService
    participant AuditService

    HR->>Browser: Select template + target employee
    Browser->>Server: POST /onboarding/assign
    Server->>PermissionService: Check onboarding.assign permission
    PermissionService-->>Server: Granted (HR Admin)
    Server->>OnboardingService: Assign template to employee
    OnboardingService->>DB: Check employee status (must be active/invited)
    DB-->>OnboardingService: Employee active
    OnboardingService->>DB: Check no active onboarding exists (BR-ONB-006)
    DB-->>OnboardingService: No active onboarding
    OnboardingService->>DB: SELECT template + tasks (snapshot, BR-ONB-001)
    DB-->>OnboardingService: Template with 7 tasks
    OnboardingService->>OnboardingService: Calculate due dates from joining date (BR-ONB-002)
    OnboardingService->>DB: BEGIN TRANSACTION
    OnboardingService->>DB: INSERT employee_onboarding (status: in_progress)
    OnboardingService->>DB: INSERT 7 employee_onboarding_tasks (with due dates + assignees)
    OnboardingService->>DB: COMMIT
    DB-->>OnboardingService: Committed
    OnboardingService->>NotificationService: Notify all task assignees
    OnboardingService->>AuditService: Record OnboardingAssigned event
    Server-->>Browser: 201 Created — onboarding instance
    Browser-->>HR: Show success — "7 tasks assigned"

    alt Employee already has active onboarding (BR-ONB-006)
        OnboardingService->>DB: Check existing active onboarding
        DB-->>OnboardingService: Active onboarding exists
        Server-->>Browser: 422 — "Employee already has active onboarding"
        Browser-->>HR: Display error with link to existing onboarding
    end
```

---


## 14. Document Upload

```mermaid
sequenceDiagram
    participant HR
    participant Browser
    participant Server
    participant PermissionService
    participant ValidationService
    participant StorageAdapter
    participant DB
    participant AuditService

    HR->>Browser: Select file + category + employee + expiry date
    Browser->>Browser: Client-side pre-check (file size < 10MB)
    Browser->>Server: POST /documents/upload (multipart)
    Server->>PermissionService: Check document.upload permission
    PermissionService-->>Server: Granted (HR Admin)
    Server->>ValidationService: Validate file
    ValidationService->>ValidationService: Check file size <= 10MB (BR-DOC-002)
    ValidationService->>ValidationService: Check magic bytes match extension (BR-DOC-001)
    ValidationService-->>Server: File valid (PDF, 2.4MB)
    Server->>StorageAdapter: Upload to tenant-scoped path (BR-DOC-003)
    StorageAdapter->>StorageAdapter: Path: /{org_id}/documents/{employee_id}/{uuid}.pdf
    StorageAdapter-->>Server: Storage URL/key returned
    Server->>DB: INSERT employee_document (metadata, storage_key, expiry_date)
    DB-->>Server: Document record created
    Server->>AuditService: Record DocumentUploaded event
    Server-->>Browser: 201 Created — document metadata
    Browser-->>HR: Show success — "Document uploaded"

    alt Storage succeeds but DB write fails (BR-DOC-007)
        Server->>StorageAdapter: Upload file
        StorageAdapter-->>Server: Storage URL returned
        Server->>DB: INSERT employee_document
        DB-->>Server: Transaction failed (DB error)
        Server->>StorageAdapter: DELETE orphaned file (compensating action)
        StorageAdapter-->>Server: Cleaned up
        Server-->>Browser: 500 — "Upload failed, please retry"
        Browser-->>HR: Display error with retry option
    end
```

---


## 15. Document Download

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant PermissionService
    participant DocumentService
    participant StorageAdapter
    participant AuditService

    User->>Browser: Click "Download" on document
    Browser->>Server: GET /documents/:id/download
    Server->>PermissionService: Check document.download (role + scope)
    PermissionService->>PermissionService: Validate org membership (tenant isolation)
    PermissionService->>PermissionService: Check role scope (own/team/org)
    PermissionService-->>Server: Granted
    Server->>DocumentService: Generate download access
    DocumentService->>DocumentService: Check document visibility (category rules, BR-DOC-004)
    DocumentService->>DocumentService: Validate document not archived/deleted
    DocumentService->>StorageAdapter: Generate signed URL (5-min expiry)
    StorageAdapter->>StorageAdapter: Verify tenant-scoped path (BR-DOC-003)
    StorageAdapter-->>DocumentService: Signed URL (time-limited)
    DocumentService->>AuditService: Record document access (who, what, when)
    Server-->>Browser: 200 OK — signed download URL
    Browser->>StorageAdapter: GET signed URL (direct download)
    StorageAdapter-->>Browser: File content streamed
    Browser-->>User: File downloaded

    alt Insufficient visibility permission (BR-DOC-004)
        PermissionService->>PermissionService: Check category sensitivity
        PermissionService-->>Server: Denied (sensitive category, user is Employee)
        Server-->>Browser: 403 — "Insufficient permissions"
        Browser-->>User: Display "You do not have access to this document"
    end
```

---


## 16. Payroll Publication

```mermaid
sequenceDiagram
    participant HR
    participant Browser
    participant Server
    participant PermissionService
    participant PayrollService
    participant DB
    participant NotificationService
    participant AuditService

    HR->>Browser: Click "Publish Payslips" on approved period
    Browser->>Browser: Show confirmation dialog (irreversible action)
    HR->>Browser: Confirm publication
    Browser->>Server: POST /payroll-periods/:id/publish
    Server->>PermissionService: Check payroll.publish permission
    PermissionService-->>Server: Granted (HR Admin)
    Server->>PayrollService: Publish payslips
    PayrollService->>DB: SELECT payroll_period WHERE status = 'approved'
    DB-->>PayrollService: Period found (approved)
    PayrollService->>DB: SELECT all payroll_records for period
    DB-->>PayrollService: 78 employee records
    PayrollService->>DB: BEGIN TRANSACTION
    PayrollService->>DB: INSERT payslip per employee (immutable snapshot, BR-PAY-002)
    PayrollService->>DB: UPDATE payroll_period SET status = 'published'
    PayrollService->>DB: COMMIT (all-or-nothing atomic)
    DB-->>PayrollService: 78 payslips created
    PayrollService->>NotificationService: Bulk notify all employees — "Payslip available"
    PayrollService->>AuditService: Record PayslipsPublished (period, count, total)
    Server-->>Browser: 200 OK — "78 payslips published"
    Browser-->>HR: Show success — employees notified

    alt Period not in approved state (BR-PAY-004)
        PayrollService->>DB: SELECT payroll_period
        DB-->>PayrollService: Status = 'draft' (not approved)
        Server-->>Browser: 422 — "Period must be approved before publishing"
        Browser-->>HR: Display state error with current status
    end
```

---


## 17. Dashboard Loading

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant AuthMiddleware
    participant PermissionService
    participant DashboardService
    participant DB
    participant Cache

    User->>Browser: Navigate to dashboard
    Browser->>Server: GET /dashboard
    Server->>AuthMiddleware: Validate session + org context
    AuthMiddleware->>AuthMiddleware: Extract user_id + org_id from session
    AuthMiddleware-->>Server: Authenticated (user, org, role)
    Server->>PermissionService: Determine dashboard level (admin/manager/employee)
    PermissionService-->>Server: dashboard.admin (HR Admin role)

    Server->>DashboardService: Load admin dashboard widgets
    DashboardService->>Cache: Check cached aggregations (short TTL)
    Cache-->>DashboardService: Cache miss (or expired)
    DashboardService->>DB: SELECT COUNT employees WHERE org_id AND status='active'
    DashboardService->>DB: SELECT COUNT leave_requests WHERE status='pending'
    DashboardService->>DB: SELECT COUNT attendance WHERE clock_out IS NULL AND flagged
    DashboardService->>DB: SELECT COUNT onboarding_tasks WHERE overdue
    DashboardService->>DB: SELECT COUNT documents WHERE expiry < now + 30 days
    DashboardService->>DB: SELECT recent audit_events (last 10)
    DB-->>DashboardService: Aggregation results
    DashboardService->>Cache: Store results (TTL: 60s)
    DashboardService-->>Server: Widget data assembled
    Server-->>Browser: 200 OK — dashboard payload (JSON)
    Browser-->>User: Render dashboard with metrics + action items

    alt Session expired or invalid
        AuthMiddleware->>AuthMiddleware: Session token invalid/expired
        Server-->>Browser: 401 — "Session expired"
        Browser-->>User: Redirect to sign-in page
    end
```

---

## Cross-Cutting Patterns

All sequence diagrams above share these patterns:

1. **Tenant Isolation**: Organisation ID always derived from authenticated session, never from request parameters (BR-ORG-002)
2. **Permission-First**: Every mutation checks permissions before executing business logic (BR-PERM-001)
3. **Audit Trail**: All state-changing operations record audit events within the same transaction (BR-AUDIT-002)
4. **Optimistic Locking**: Shared resources use version checks to prevent lost updates (BR-DATA-004)
5. **UTC Storage**: All timestamps stored in UTC; presentation layer converts to org timezone (BR-DATA-002)
6. **Graceful Failure**: Errors return consistent shapes with actionable messages (BR-PERM-003)
7. **Idempotency**: Critical operations (approval, publication) guard against duplicate execution
