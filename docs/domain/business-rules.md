# Business Rules Catalogue

This document defines all enforceable business rules for HR Daddy V1. Each rule has a stable ID, description, rationale, enforcement location, related use cases, and test requirements.

---

## Authentication Rules (BR-AUTH)

### BR-AUTH-001: Active membership required
- **Description:** A user must have at least one active organisation membership to access any organisation-scoped resource
- **Reason:** Prevents access by users who have been removed from all organisations
- **Enforcement:** Middleware - organisation context resolver
- **Related use cases:** All authenticated operations
- **Test:** Attempt API call with valid session but no active memberships → 403

### BR-AUTH-002: Session invalidation on password change
- **Description:** All existing sessions must be invalidated when a user changes their password
- **Reason:** Prevents continued access via compromised sessions
- **Enforcement:** Auth service - password change handler
- **Related use cases:** AUTH-005
- **Test:** Change password → verify old session token returns 401


### BR-AUTH-003: Invitation expiry enforcement
- **Description:** Invitations expire after 7 days and cannot be accepted after expiry
- **Reason:** Limits exposure window for invitation links
- **Enforcement:** Server action - invitation acceptance handler
- **Related use cases:** AUTH-006, AUTH-008
- **Test:** Attempt to accept invitation with timestamp > 7 days old → error

### BR-AUTH-004: Account lockout after failed attempts
- **Description:** Account is temporarily locked after 5 consecutive failed login attempts for 15 minutes
- **Reason:** Prevents brute-force attacks
- **Enforcement:** Auth service - login handler
- **Related use cases:** AUTH-003
- **Test:** 5 failed attempts → 6th attempt returns locked error even with correct password

### BR-AUTH-005: Deactivated employees cannot sign in
- **Description:** If an Employee record is deactivated, the associated User cannot access that organisation
- **Reason:** Employment termination must immediately revoke access
- **Enforcement:** Middleware - membership validation
- **Related use cases:** AUTH-009, AUTH-010, EMP-013
- **Test:** Deactivate employee → attempt login → user can login but cannot access that org


### BR-AUTH-006: Single active session per organisation context
- **Description:** When a user switches organisation context, the previous organisation context is invalidated in the current session
- **Reason:** Prevents context confusion and potential data leakage between organisations
- **Enforcement:** Session service - organisation context switch handler
- **Related use cases:** AUTH-007
- **Test:** Switch org context → attempt action on previous org context → 403

### BR-AUTH-007: Password complexity requirements
- **Description:** Passwords must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number
- **Reason:** Minimum security standard for credential strength
- **Enforcement:** Auth service - registration and password change handlers, Client-side pre-validation
- **Related use cases:** AUTH-001, AUTH-005
- **Test:** Submit password "abc" → validation error. Submit "Abc12345" → succeeds.

### BR-AUTH-008: Invitation single-use enforcement
- **Description:** An invitation token can only be used once. After acceptance, the token is permanently invalidated.
- **Reason:** Prevents invitation link sharing or reuse
- **Enforcement:** Server action - invitation acceptance handler (atomic token consumption)
- **Related use cases:** AUTH-006
- **Test:** Accept invitation → attempt to reuse same link → error "invitation already accepted"

---

## Organisation Rules (BR-ORG)


### BR-ORG-001: Tenant-scoped data ownership
- **Description:** Every tenant-owned record must contain an organisation_id field and it must match the authenticated user's current organisation context
- **Reason:** Fundamental multi-tenant isolation requirement
- **Enforcement:** Database schema (NOT NULL), Repository layer (query scoping), Middleware (context injection)
- **Related use cases:** All organisation-scoped operations
- **Test:** Cross-tenant query attempt → returns empty set, not other tenant's data

### BR-ORG-002: Organisation context from session only
- **Description:** Organisation IDs must come from authenticated session context, never from browser-supplied request parameters for data mutation
- **Reason:** Prevents IDOR attacks against tenant boundary
- **Enforcement:** Server action layer - context resolver
- **Related use cases:** All mutations
- **Test:** Supply different org_id in request body → system uses session org_id instead

### BR-ORG-003: Single owner requirement
- **Description:** An organisation must have exactly one Owner at all times
- **Reason:** Prevents orphaned organisations and ensures accountability
- **Enforcement:** Server action - role change and member removal handlers
- **Related use cases:** ORG-011, ORG-012, ORG-013
- **Test:** Attempt to remove sole owner → error. Attempt to downgrade sole owner → error.

### BR-ORG-004: Owner transfer is atomic
- **Description:** Ownership transfer must atomically promote new owner and demote old owner in a single transaction
- **Reason:** Prevents state where zero or two owners exist
- **Enforcement:** Database transaction
- **Related use cases:** ORG-013
- **Test:** Simulate failure mid-transfer → verify original owner retained


### BR-ORG-005: Organisation settings apply org-wide
- **Description:** Configuration changes (timezone, working days, currency, date format) apply to all employees within the organisation immediately
- **Reason:** Consistent policy application across the workforce
- **Enforcement:** Server action - settings update handler, Domain services read from org config
- **Related use cases:** ORG-003, ORG-004, ORG-005, ORG-006
- **Test:** Change timezone → all subsequent attendance records display in new timezone

### BR-ORG-006: Member removal does not delete data
- **Description:** Removing a member's access does not delete their Employee record, attendance history, leave history, or documents. Data is retained for compliance.
- **Reason:** Employment records have legal retention requirements
- **Enforcement:** Server action - member removal handler (revokes membership, does not cascade delete)
- **Related use cases:** ORG-012
- **Test:** Remove member → employee record still queryable by HR → user cannot login to org

---

## Employee Rules (BR-EMP)

### BR-EMP-001: Employee may exist without login
- **Description:** An Employee record can exist without an associated User account. Login access is optional.
- **Reason:** Many SMBs have employees who don't need system access (warehouse workers, etc.)
- **Enforcement:** Schema design - Employee.userId is nullable
- **Related use cases:** EMP-001, EMP-002
- **Test:** Create employee without invitation → record exists, no login possible


### BR-EMP-002: Employee uniqueness per organisation
- **Description:** An employee's work email must be unique within an organisation
- **Reason:** Prevents duplicate employee records
- **Enforcement:** Database unique constraint (org_id + work_email)
- **Related use cases:** EMP-001
- **Test:** Attempt duplicate email in same org → error. Same email in different org → succeeds.

### BR-EMP-003: Employment status transition validation
- **Description:** Employee status can only transition through valid paths: Draft→Invited→Active, Active→Suspended, Active→Deactivated, Suspended→Active, Deactivated→Active (reactivation), Active→Archived, Deactivated→Archived
- **Reason:** Prevents invalid states and ensures proper lifecycle
- **Enforcement:** Domain service - state machine validator
- **Related use cases:** EMP-012, EMP-013, EMP-014, EMP-015
- **Test:** Attempt invalid transition (e.g., Archived→Active) → error

### BR-EMP-004: Cascading effects of deactivation
- **Description:** When an employee is deactivated: pending leave requests are cancelled, open attendance sessions are closed, onboarding is cancelled, the employee is removed as approver from pending requests
- **Reason:** Clean state management on employment end
- **Enforcement:** Domain service - deactivation handler (within transaction)
- **Related use cases:** EMP-013
- **Test:** Deactivate employee with pending leave → leave status = cancelled

### BR-EMP-005: Manager can only view own direct reports
- **Description:** A Manager can view employee details only for employees in their reporting chain
- **Reason:** Privacy and least-privilege access
- **Enforcement:** Permission service - scope check against reporting_relationships table
- **Related use cases:** EMP-006
- **Test:** Manager attempts to view non-report → 403


### BR-EMP-006: Reporting relationship prevents circular references
- **Description:** An employee cannot be assigned as their own manager, and reporting chains must not contain cycles
- **Reason:** Prevents infinite loops in approval chains and organisational structure
- **Enforcement:** Domain service - reporting relationship validator (graph cycle detection)
- **Related use cases:** EMP-011
- **Test:** Attempt to set A→B→C→A reporting chain → error on the closing link

### BR-EMP-007: Department assignment is optional
- **Description:** An employee may exist without a department assignment. Department is not required for employment.
- **Reason:** Small companies may not have formal department structures initially
- **Enforcement:** Schema design - Employee.departmentId is nullable
- **Related use cases:** EMP-008
- **Test:** Create employee without department → succeeds, appears in "Unassigned" filter

### BR-EMP-008: Archived employees are excluded from active queries
- **Description:** Archived employees do not appear in the employee directory, leave calendars, or attendance views by default. They are only visible in archive-specific queries.
- **Reason:** Clean operational views without terminated employee noise
- **Enforcement:** Repository layer - default query filter excludes archived status
- **Related use cases:** EMP-015
- **Test:** Archive employee → employee directory no longer shows them → archive view shows them

---

## Leave Rules (BR-LEAVE)


### BR-LEAVE-001: Leave request cannot overlap
- **Description:** A new leave request cannot overlap with an existing approved or pending leave request for the same employee
- **Reason:** Prevents double-booking of time off
- **Enforcement:** Server action - leave request creation, database query check
- **Related use cases:** LEAVE-005, LEAVE-008
- **Test:** Submit overlapping request → validation error with details of conflict

### BR-LEAVE-002: Insufficient balance prevents submission
- **Description:** A leave request cannot be submitted if the requested days exceed available balance (unless leave type allows negative balance)
- **Reason:** Prevents over-use of leave entitlement
- **Enforcement:** Server action - balance check before creation
- **Related use cases:** LEAVE-005, LEAVE-009
- **Test:** Request 5 days with 3 balance → error. Request with type allowing negative → succeeds.

### BR-LEAVE-003: Approval reduces balance
- **Description:** When a leave request is approved, the employee's leave balance is reduced by the number of working days in the request
- **Reason:** Balance must reflect committed leave
- **Enforcement:** Domain service - approval handler
- **Related use cases:** LEAVE-011
- **Test:** Approve 3-day leave → balance decreases by 3

### BR-LEAVE-004: Manager can only approve own reports
- **Description:** A manager can approve/reject leave only for employees who directly report to them
- **Reason:** Approval authority is tied to reporting relationship
- **Enforcement:** Permission service - reporting relationship check
- **Related use cases:** LEAVE-011, LEAVE-012
- **Test:** Manager attempts to approve non-report's leave → 403


### BR-LEAVE-005: Working days calculation excludes weekends and holidays
- **Description:** Leave duration is calculated using organisation working days, excluding configured weekends and public holidays
- **Reason:** Accurate balance deduction
- **Enforcement:** Domain service - working day calculator
- **Related use cases:** LEAVE-005, LEAVE-020
- **Test:** 5 calendar days spanning a weekend → 3 working days deducted

### BR-LEAVE-006: Cancellation restores balance
- **Description:** When an approved leave is cancelled (before the leave period starts), balance is restored
- **Reason:** Cancelled leave should not consume balance
- **Enforcement:** Domain service - cancellation handler
- **Related use cases:** LEAVE-013
- **Test:** Cancel approved leave → balance increases back

### BR-LEAVE-007: Cannot cancel past leave
- **Description:** Leave that has already started or passed cannot be cancelled by the employee (only HR override)
- **Reason:** Prevents retroactive leave manipulation
- **Enforcement:** Server action - date comparison
- **Related use cases:** LEAVE-013, LEAVE-015
- **Test:** Attempt to cancel leave with start_date < today → error

### BR-LEAVE-008: HR can override leave decisions
- **Description:** HR Administrator can approve, reject, or cancel any leave request regardless of reporting relationship
- **Reason:** Handles exceptional cases (manager absence, disputes, policy corrections)
- **Enforcement:** Permission service - leave.override permission check
- **Related use cases:** LEAVE-015
- **Test:** HR overrides rejected leave to approved → succeeds, balance adjusted


### BR-LEAVE-009: Pending leave reserves balance
- **Description:** When a leave request is in "Pending" status, the requested days are reserved (subtracted from available balance) to prevent overbooking
- **Reason:** Prevents multiple pending requests that would exceed total allowance
- **Enforcement:** Domain service - balance calculation includes pending requests
- **Related use cases:** LEAVE-005, LEAVE-004
- **Test:** Balance = 5 days. Submit 3-day request (pending). Available balance shows 2.

### BR-LEAVE-010: Employee without manager routes to HR
- **Description:** If an employee has no assigned manager, leave requests route to HR Administrator for approval
- **Reason:** All leave requests must have an approval path
- **Enforcement:** Domain service - approver resolution (fallback to HR role)
- **Related use cases:** LEAVE-018
- **Test:** Employee without manager submits leave → HR receives notification, can approve

### BR-LEAVE-011: Half-day leave deducts 0.5 from balance
- **Description:** Half-day leave requests deduct 0.5 working days from balance, not a full day
- **Reason:** Accurate partial-day leave tracking
- **Enforcement:** Domain service - leave duration calculator
- **Related use cases:** LEAVE-006
- **Test:** Submit half-day leave → balance reduces by 0.5

---

## Attendance Rules (BR-ATT)

### BR-ATT-001: No duplicate clock-in
- **Description:** An employee cannot clock in if they have an open attendance session (clocked in but not out)
- **Reason:** Prevents corrupted attendance data
- **Enforcement:** Server action - attendance state check
- **Related use cases:** ATT-001, ATT-010
- **Test:** Clock in twice without clocking out → error


### BR-ATT-002: Organisation timezone for records
- **Description:** All attendance records are stored in UTC but displayed in the organisation's configured timezone
- **Reason:** Consistent time handling across distributed teams
- **Enforcement:** Storage layer (UTC), Presentation layer (timezone conversion)
- **Related use cases:** ATT-001, ATT-002, ATT-012
- **Test:** Clock in at 9am SGT → stored as 01:00 UTC → displayed as 9am SGT

### BR-ATT-003: Corrections require reason
- **Description:** Any attendance correction must include a reason/justification
- **Reason:** Audit trail for attendance modifications
- **Enforcement:** Server action - validation, Schema (reason NOT NULL for corrections)
- **Related use cases:** ATT-006
- **Test:** Submit correction without reason → validation error

### BR-ATT-004: Only HR can correct attendance
- **Description:** Attendance records can only be corrected by HR administrators, not by employees or managers
- **Reason:** Prevents self-serving attendance manipulation
- **Enforcement:** Permission check - attendance.correct permission
- **Related use cases:** ATT-006
- **Test:** Employee attempts correction → 403. Manager attempts → 403. HR attempts → success.

### BR-ATT-005: Missing clock-out auto-handling
- **Description:** If an employee has not clocked out by end of configured working hours + 2 hours buffer, the session is flagged as "missing clock-out" and requires HR correction
- **Reason:** Prevents infinitely open sessions
- **Enforcement:** Background job or end-of-day check
- **Related use cases:** ATT-009
- **Test:** Open session past threshold → status changes to missing_clock_out


### BR-ATT-006: Clock-out must follow clock-in
- **Description:** An employee cannot clock out without an active (open) attendance session
- **Reason:** Clock-out without clock-in creates orphaned records
- **Enforcement:** Server action - attendance state check
- **Related use cases:** ATT-002
- **Test:** Attempt clock-out with no open session → error "No active session"

### BR-ATT-007: Overnight shift handling
- **Description:** Attendance sessions that span midnight are treated as a single session belonging to the date of clock-in
- **Reason:** Prevents date-boundary confusion for shift workers
- **Enforcement:** Domain service - session date assignment logic
- **Related use cases:** ATT-011
- **Test:** Clock in at 11pm Jan 1, clock out at 7am Jan 2 → session belongs to Jan 1

### BR-ATT-008: Attendance on leave days is prevented
- **Description:** An employee cannot clock in on a day they have approved leave for the full day
- **Reason:** Prevents conflicting attendance/leave records
- **Enforcement:** Server action - cross-reference with approved leave
- **Related use cases:** ATT-013
- **Test:** Employee has approved full-day leave → attempt clock-in → error

### BR-ATT-009: Duration calculated automatically
- **Description:** Attendance duration is automatically calculated as the difference between clock-out and clock-in timestamps. Manual duration entry is not allowed except via HR correction.
- **Reason:** Prevents falsified duration entries
- **Enforcement:** Domain service - duration derived from timestamps, not user-supplied
- **Related use cases:** ATT-001, ATT-002
- **Test:** Clock in at 9:00, clock out at 17:30 → duration = 8h30m (no manual override)

---

## Onboarding Rules (BR-ONB)


### BR-ONB-001: Template instantiation is a snapshot
- **Description:** When an onboarding template is applied to an employee, a copy of all tasks is created. Subsequent changes to the template do NOT affect existing employee onboarding instances.
- **Reason:** Prevents in-flight onboarding from being disrupted by template edits
- **Enforcement:** Server action - template application creates independent task copies
- **Related use cases:** ONB-005, ONB-006
- **Test:** Apply template → edit template → employee tasks remain unchanged

### BR-ONB-002: Due dates are relative to joining date
- **Description:** Onboarding task due dates are calculated relative to the employee's joining date (e.g., "Day 1", "Day 7", "Day 30")
- **Reason:** Consistent onboarding timeline regardless of when template is applied
- **Enforcement:** Domain service - due date calculation on instantiation
- **Related use cases:** ONB-005, ONB-006
- **Test:** Employee joins March 1 → "Day 7" task due = March 8

### BR-ONB-003: Only assigned owner can complete task
- **Description:** An onboarding task can only be marked complete by the assigned owner (employee, their manager, or HR) unless HR overrides
- **Reason:** Accountability for task completion
- **Enforcement:** Permission service - task ownership check
- **Related use cases:** ONB-009
- **Test:** Non-owner attempts to complete task → error. Owner completes → succeeds.

### BR-ONB-004: Completed tasks cannot be reopened by employee
- **Description:** Once a task is marked complete, only HR can reopen it
- **Reason:** Prevents task completion gaming
- **Enforcement:** Permission service - reopen requires HR role
- **Related use cases:** ONB-010
- **Test:** Employee attempts to reopen completed task → 403. HR reopens → succeeds.


### BR-ONB-005: Onboarding cancellation cascades to all tasks
- **Description:** When onboarding is cancelled (e.g., employee deactivation before completion), all incomplete tasks are marked as cancelled
- **Reason:** Clean state management; no orphaned pending tasks
- **Enforcement:** Domain service - onboarding cancellation handler
- **Related use cases:** ONB-013, EMP-013
- **Test:** Cancel onboarding → all pending/in-progress tasks → status = cancelled

### BR-ONB-006: Single active onboarding per employee
- **Description:** An employee can have at most one active (non-completed, non-cancelled) onboarding instance at a time
- **Reason:** Prevents confusion from multiple overlapping checklists
- **Enforcement:** Server action - check for existing active onboarding before assignment
- **Related use cases:** ONB-005
- **Test:** Assign template to employee with active onboarding → error

---

## Payroll Rules (BR-PAY)

### BR-PAY-001: Decimal-safe calculations
- **Description:** All payroll monetary values must use decimal-safe arithmetic (integer cents or Decimal library), never floating point
- **Reason:** Prevents rounding errors in compensation
- **Enforcement:** Schema (integer cents storage), Domain service (Decimal.js calculations)
- **Related use cases:** PAY-006, PAY-007, PAY-015
- **Test:** Sum of line items = gross. Gross - deductions = net. No floating point drift.

### BR-PAY-002: Published payslips are immutable
- **Description:** Once a payslip is published to an employee, it cannot be modified through normal workflows. Only formal reopening (requiring audit) allows changes.
- **Reason:** Legal/compliance requirement for pay records
- **Enforcement:** Server action - mutation blocked if status=published, Database trigger/check
- **Related use cases:** PAY-011, PAY-013
- **Test:** Attempt to edit published payslip → error


### BR-PAY-003: Payroll access is highly restricted
- **Description:** Only Owner and HR Administrator can view/manage payroll records. Employees can only view their own payslips.
- **Reason:** Compensation data is highly sensitive
- **Enforcement:** Permission service - payroll.manage and payroll.read checks
- **Related use cases:** PAY-014
- **Test:** Manager attempts to view team payroll → 403

### BR-PAY-004: Payroll period lifecycle enforcement
- **Description:** Payroll periods follow strict lifecycle: Draft→Under Review→Approved→Published→Paid. Only valid transitions are allowed.
- **Reason:** Prevents premature publication or modification of approved records
- **Enforcement:** Domain service - state machine validator
- **Related use cases:** PAY-009, PAY-010, PAY-011
- **Test:** Attempt to publish a Draft period (skipping Under Review) → error

### BR-PAY-005: Net pay calculation validation
- **Description:** Net pay must equal gross pay (sum of earnings + allowances) minus sum of deductions. The system validates this equation before allowing approval.
- **Reason:** Prevents calculation errors reaching employees
- **Enforcement:** Domain service - payroll validation before status transition to Approved
- **Related use cases:** PAY-007, PAY-009
- **Test:** Record with mismatched totals → cannot transition to Approved

### BR-PAY-006: Employee must be active for payroll inclusion
- **Description:** A payroll record can only be created for employees with Active status during the payroll period
- **Reason:** Prevents payroll for non-working employees
- **Enforcement:** Server action - employee status validation on record creation
- **Related use cases:** PAY-002
- **Test:** Attempt to add payroll record for deactivated employee → error

### BR-PAY-007: Reopening published payroll requires audit justification
- **Description:** Reopening a published payroll period requires a mandatory justification reason and creates a high-severity audit event
- **Reason:** Published payroll is a legal record; modifications must be tracked
- **Enforcement:** Server action - reopen handler requires reason, Audit service - elevated event
- **Related use cases:** PAY-013
- **Test:** Reopen without reason → error. Reopen with reason → succeeds + audit event created.

---

## Document Rules (BR-DOC)


### BR-DOC-001: File type validation
- **Description:** Only allowed file types can be uploaded (PDF, JPG, PNG, DOCX, XLSX). Validation must check file header bytes (magic numbers), not just extension.
- **Reason:** Prevents malicious file upload attacks
- **Enforcement:** Server action - file validation service (mime-type + magic byte check)
- **Related use cases:** DOC-002, DOC-011
- **Test:** Upload .exe renamed to .pdf → rejected based on magic byte mismatch

### BR-DOC-002: File size limit
- **Description:** Maximum file size is 10MB per document
- **Reason:** Prevents storage abuse and ensures reasonable handling
- **Enforcement:** Server action - size check, Client-side pre-check (advisory only)
- **Related use cases:** DOC-002, DOC-012
- **Test:** Upload 15MB file → error "File exceeds maximum size of 10MB"

### BR-DOC-003: Tenant-scoped storage
- **Description:** Document storage paths must include organisation_id to prevent cross-tenant file access
- **Reason:** Tenant isolation extends to file storage
- **Enforcement:** Storage adapter - path construction includes org_id prefix
- **Related use cases:** DOC-002, DOC-004
- **Test:** Attempt to access document path of another org → 404/403

### BR-DOC-004: Document visibility by category
- **Description:** Document visibility is determined by the document category's default visibility setting. Some categories (e.g., Medical) are restricted to HR only; others (e.g., Certifications) are visible to the employee and their manager.
- **Reason:** Sensitive documents require access control beyond basic ownership
- **Enforcement:** Permission service - visibility check against category configuration
- **Related use cases:** DOC-008
- **Test:** Employee views own medical document with HR-only category → 403. HR views → success.


### BR-DOC-005: Document expiry triggers notification
- **Description:** When a document's expiry date is within 30 days, a notification is sent to HR and the employee. Expired documents are flagged but not automatically deleted.
- **Reason:** Proactive compliance management for certifications, visas, etc.
- **Enforcement:** Background job - daily expiry check, Notification service
- **Related use cases:** DOC-009, DOC-010
- **Test:** Document with expiry in 25 days → notification generated. Expired → flag set.

### BR-DOC-006: Deletion is soft-delete with retention
- **Description:** Document deletion marks the record as deleted but retains the file in storage for 90 days before permanent removal
- **Reason:** Recovery capability and compliance retention
- **Enforcement:** Server action - soft-delete flag, Background job - permanent deletion after retention period
- **Related use cases:** DOC-007
- **Test:** Delete document → not visible in UI → still in storage → after 90 days → permanently removed

### BR-DOC-007: Upload failure cleanup
- **Description:** If a file is uploaded to storage but the database metadata write fails, the orphaned storage object must be cleaned up
- **Reason:** Prevents storage pollution and cost leakage
- **Enforcement:** Server action - upload handler with compensating transaction (delete storage on DB failure)
- **Related use cases:** DOC-002
- **Test:** Simulate DB failure after storage upload → storage object is removed

---

## Notification Rules (BR-NOTIF)

### BR-NOTIF-001: Notifications target Users not Employees
- **Description:** Notifications are delivered to User accounts (login identities), not Employee records. Employees without User accounts cannot receive notifications.
- **Reason:** Only users who can log in can view notifications
- **Enforcement:** Notification service - recipient resolution via User ID
- **Related use cases:** NOTIF-001
- **Test:** Create notification for employee without user account → no notification created


### BR-NOTIF-002: No duplicate notifications
- **Description:** The same notification event must not produce duplicate notifications for the same recipient within a short time window (5 minutes)
- **Reason:** Prevents notification spam from retries or race conditions
- **Enforcement:** Notification service - idempotency check (event_type + recipient + target + time window)
- **Related use cases:** NOTIF-010
- **Test:** Trigger same event twice within 1 minute → only one notification created

### BR-NOTIF-003: Notifications are tenant-scoped
- **Description:** Notifications are scoped to an organisation. A user only sees notifications for their current organisation context.
- **Reason:** Prevents information leakage between organisations for multi-org users
- **Enforcement:** Notification service - org_id attached to all notifications, query scoped to current org
- **Related use cases:** NOTIF-001
- **Test:** User in org A → notifications from org B are not visible

### BR-NOTIF-004: Read status is per-notification
- **Description:** Each notification has an independent read/unread status. "Mark all read" updates all unread notifications for the user in the current org context.
- **Reason:** Standard notification UX expectations
- **Enforcement:** Server action - mark read handler
- **Related use cases:** NOTIF-002, NOTIF-003
- **Test:** Mark single notification read → others remain unread. Mark all → all become read.

---

## Audit Rules (BR-AUDIT)

### BR-AUDIT-001: Audit records are append-only
- **Description:** Audit log entries cannot be edited, updated, or deleted through any application workflow
- **Reason:** Audit integrity for compliance
- **Enforcement:** Database - no UPDATE/DELETE permissions on audit table for app user, Application - no mutation endpoints for audit
- **Related use cases:** AUDIT-010
- **Test:** Attempt to call DELETE/UPDATE on audit records → not possible through any API


### BR-AUDIT-002: Sensitive operations must be audited
- **Description:** All operations involving: role changes, employee status changes, leave decisions, attendance corrections, payroll approvals, document deletions, permission modifications MUST create audit records
- **Reason:** Compliance and accountability
- **Enforcement:** Domain services - event emission after each operation
- **Related use cases:** All AUDIT use cases
- **Test:** Perform each sensitive operation → verify audit record created with correct payload

### BR-AUDIT-003: Audit records include before/after state
- **Description:** For update operations, audit records must capture both the previous and new values of modified fields
- **Reason:** Enables investigation of what changed and when
- **Enforcement:** Audit service - diff capture (snapshot before and after)
- **Related use cases:** AUDIT-003, AUDIT-004
- **Test:** Edit employee name → audit shows {before: 'Old Name', after: 'New Name'}

### BR-AUDIT-004: Audit records capture actor identity
- **Description:** Every audit record must include the User ID, organisation context, IP address (where available), and timestamp of the actor who performed the action
- **Reason:** Full attribution for security investigations
- **Enforcement:** Audit service - context extraction from request/session
- **Related use cases:** All AUDIT use cases
- **Test:** Perform action → audit record contains correct user_id, org_id, timestamp

### BR-AUDIT-005: Audit retention is indefinite
- **Description:** Audit records are never automatically deleted. They persist for the lifetime of the organisation.
- **Reason:** Compliance requirements may demand years of audit history
- **Enforcement:** No background jobs or TTL on audit table. Archive strategy may move to cold storage but never delete.
- **Related use cases:** AUDIT-010
- **Test:** Check for any scheduled deletion of audit records → none exists


### BR-AUDIT-006: Audit access is restricted to Owner and HR
- **Description:** Only Owner and HR Administrator roles can view audit logs. Employees and Managers cannot access audit records.
- **Reason:** Audit logs contain sensitive operational details
- **Enforcement:** Permission service - audit.read permission check
- **Related use cases:** AUDIT-008
- **Test:** Employee attempts to access audit log → 403. HR accesses → success.

---

## Permission Rules (BR-PERM)

### BR-PERM-001: Server-side enforcement is mandatory
- **Description:** All permission checks must be enforced server-side. Client-side checks are advisory only (for UX) and must not be relied upon for security.
- **Reason:** Client-side checks can be bypassed
- **Enforcement:** Server action / middleware - permission check before every mutation and sensitive read
- **Related use cases:** All authenticated operations
- **Test:** Bypass UI permission check via direct API call → server still returns 403

### BR-PERM-002: Role is per-membership not per-user
- **Description:** A user's role is determined by their membership in a specific organisation. The same user can have different roles in different organisations.
- **Reason:** Multi-organisation users may have different authority levels
- **Enforcement:** Permission service - resolves role from membership for current org context
- **Related use cases:** AUTH-007
- **Test:** User is Owner in org A, Employee in org B → in org B context, cannot access owner features

### BR-PERM-003: Permission denial returns consistent error
- **Description:** All permission denials return a 403 status with a generic "Insufficient permissions" message. The response must not reveal what permission was required or what resource exists.
- **Reason:** Prevents information leakage about system structure and other tenants' resources
- **Enforcement:** Error handler middleware - uniform 403 response format
- **Related use cases:** All permission-guarded operations
- **Test:** Request resource without permission → 403 with generic message, no resource details leaked


### BR-PERM-004: Sensitive fields require elevated permission
- **Description:** Certain employee fields (compensation, bank details, personal ID numbers) require specific elevated permissions (e.g., employee.compensation.read) beyond basic employee.read
- **Reason:** Granular access control for sensitive HR data
- **Enforcement:** Permission service - field-level permission check on read and write
- **Related use cases:** EMP-006, EMP-007
- **Test:** Manager reads employee profile → compensation fields are excluded from response

### BR-PERM-005: Self-service scope
- **Description:** Employees can view and edit only their own profile (limited fields), view their own leave balance, submit their own leave, view their own attendance, and view their own payslips
- **Reason:** Least-privilege access for self-service
- **Enforcement:** Permission service - self-scope check (actor.employeeId === target.employeeId)
- **Related use cases:** EMP-006, LEAVE-004, ATT-003, PAY-014
- **Test:** Employee attempts to view another employee's payslip → 403

---

## Data Integrity Rules (BR-DATA)

### BR-DATA-001: Soft-delete over hard-delete
- **Description:** Records are never permanently deleted through normal application workflows. All deletions are soft-deletes (status flag or deleted_at timestamp).
- **Reason:** Data recovery capability and referential integrity preservation
- **Enforcement:** Repository layer - all delete operations set soft-delete flag
- **Related use cases:** All delete operations
- **Test:** Delete employee → record still exists in database with deleted_at set

### BR-DATA-002: Timestamps are always UTC
- **Description:** All timestamps in the database are stored in UTC. Timezone conversion happens only at the presentation layer.
- **Reason:** Consistent time handling, prevents timezone-related bugs
- **Enforcement:** Schema (timestamp with time zone type), Application layer (UTC conversion)
- **Related use cases:** All time-sensitive operations
- **Test:** Create record in SGT timezone → database stores UTC → API returns UTC → UI converts to org timezone


### BR-DATA-003: Referential integrity prevents orphans
- **Description:** Foreign key constraints prevent deletion of parent records that have dependent children (e.g., cannot delete a department that has employees assigned)
- **Reason:** Prevents orphaned records and data corruption
- **Enforcement:** Database - foreign key constraints with RESTRICT delete behaviour
- **Related use cases:** ORG-010, EMP-008
- **Test:** Attempt to delete department with assigned employees → error

### BR-DATA-004: Optimistic concurrency for critical updates
- **Description:** Updates to shared resources (leave approval, payroll records, employee status) use optimistic locking (version field or updated_at check) to prevent lost updates from concurrent modifications
- **Reason:** Prevents race conditions in multi-user scenarios
- **Enforcement:** Repository layer - version check in WHERE clause of UPDATE statements
- **Related use cases:** LEAVE-011, PAY-009
- **Test:** Two managers approve same leave simultaneously → one succeeds, other gets conflict error

### BR-DATA-005: Audit timestamps cannot be future-dated
- **Description:** Audit event timestamps must always reflect actual server time. They cannot be backdated or future-dated.
- **Reason:** Audit timeline integrity
- **Enforcement:** Audit service - timestamp assigned server-side only (never from client input)
- **Related use cases:** AUDIT-001
- **Test:** Attempt to supply custom timestamp to audit creation → ignored, server time used

---

## Cross-Module Rules (BR-CROSS)

### BR-CROSS-001: Department deletion requires empty membership
- **Description:** A department cannot be archived or deleted while it has active employees assigned to it. Employees must be reassigned first.
- **Reason:** Prevents orphaned department assignments
- **Enforcement:** Server action - pre-deletion check for active employee count
- **Related use cases:** ORG-010, EMP-008
- **Test:** Archive department with 3 active employees → error. Reassign all → archive succeeds.


### BR-CROSS-002: Manager deactivation reassigns approval authority
- **Description:** When a manager is deactivated, their pending leave approvals and direct reports must be handled. Pending approvals route to HR. Direct reports are flagged as "manager-less" until reassignment.
- **Reason:** Prevents blocked approval workflows
- **Enforcement:** Domain service - manager deactivation handler
- **Related use cases:** EMP-013, LEAVE-018
- **Test:** Deactivate manager with pending leave approvals → approvals route to HR

### BR-CROSS-003: Leave on attendance day creates conflict flag
- **Description:** If an employee has attendance recorded on a day they later get leave approved for, the system flags the conflict for HR review rather than auto-resolving
- **Reason:** Ambiguous situations require human judgment
- **Enforcement:** Domain service - conflict detection on leave approval
- **Related use cases:** LEAVE-011, ATT-013
- **Test:** Employee clocked in Monday → leave approved including Monday → conflict flag created for HR

### BR-CROSS-004: Employee reactivation does not restore previous state
- **Description:** Reactivating a deactivated employee creates a fresh active state. Previously cancelled leave, closed attendance sessions, and cancelled onboarding are not restored.
- **Reason:** Reactivation is a new employment period, not an undo
- **Enforcement:** Domain service - reactivation handler creates clean state
- **Related use cases:** EMP-014
- **Test:** Reactivate employee → leave balance starts fresh, no pending items from before

### BR-CROSS-005: Holiday calendar affects leave and attendance
- **Description:** Organisation-configured holidays affect both leave calculations (excluded from working days) and attendance expectations (no attendance required). Changes to holiday calendar recalculate pending leave requests.
- **Reason:** Consistent treatment of non-working days across modules
- **Enforcement:** Domain service - working day calculator used by both leave and attendance modules
- **Related use cases:** LEAVE-020, ATT-014
- **Test:** Add holiday on a pending leave day → leave duration recalculated (reduced by 1)

---

## Summary

| Category | Count | ID Range |
|----------|-------|----------|
| Authentication (BR-AUTH) | 8 | BR-AUTH-001 to BR-AUTH-008 |
| Organisation (BR-ORG) | 6 | BR-ORG-001 to BR-ORG-006 |
| Employee (BR-EMP) | 8 | BR-EMP-001 to BR-EMP-008 |
| Leave (BR-LEAVE) | 11 | BR-LEAVE-001 to BR-LEAVE-011 |
| Attendance (BR-ATT) | 9 | BR-ATT-001 to BR-ATT-009 |
| Onboarding (BR-ONB) | 6 | BR-ONB-001 to BR-ONB-006 |
| Payroll (BR-PAY) | 7 | BR-PAY-001 to BR-PAY-007 |
| Document (BR-DOC) | 7 | BR-DOC-001 to BR-DOC-007 |
| Notification (BR-NOTIF) | 4 | BR-NOTIF-001 to BR-NOTIF-004 |
| Audit (BR-AUDIT) | 6 | BR-AUDIT-001 to BR-AUDIT-006 |
| Permission (BR-PERM) | 5 | BR-PERM-001 to BR-PERM-005 |
| Data Integrity (BR-DATA) | 5 | BR-DATA-001 to BR-DATA-005 |
| Cross-Module (BR-CROSS) | 5 | BR-CROSS-001 to BR-CROSS-005 |
| **Total** | **87** | |
