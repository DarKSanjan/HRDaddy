# Domain Model

This document describes the main aggregates and ownership boundaries for HR Daddy V1. Each aggregate defines its root entity, children, invariants, commands, domain events, and transaction boundaries.

---

## 1. Organisation Aggregate

### Aggregate Root
**Organisation**

### Child Entities
- OrganisationSettings (1:1)
- OrganisationMembership (1:N)
- Invitation (1:N)

### Invariants
- An organisation must have exactly one Owner at all times (BR-ORG-003)
- Ownership transfer is atomic — zero or two owners must never exist (BR-ORG-004)
- Organisation settings apply organisation-wide immediately (BR-ORG-005)
- Every tenant-owned record must reference the organisation ID (BR-ORG-001)
- Organisation ID must come from authenticated session context, never browser input (BR-ORG-002)


### Commands
- CreateOrganisation(name, ownerId)
- UpdateOrganisationDetails(name, industry, address)
- ConfigureSettings(timezone, currency, workingDays, workingHours, dateFormat, leaveYearStart)
- ConfigureBranding(logo, primaryColour, displayName)
- InviteMember(email, role)
- RevokeInvitation(invitationId)
- ChangeMemberRole(membershipId, newRole)
- RemoveMember(membershipId)
- TransferOwnership(newOwnerId)

### Domain Events
- OrganisationCreated { orgId, ownerId, name }
- OrganisationSettingsUpdated { orgId, changedFields }
- MemberInvited { orgId, email, role, inviterId }
- InvitationAccepted { orgId, userId, role }
- InvitationExpired { orgId, invitationId }
- MemberRoleChanged { orgId, membershipId, oldRole, newRole }
- MemberRemoved { orgId, membershipId, previousRole }
- OwnershipTransferred { orgId, previousOwnerId, newOwnerId }

### Repository Boundary
- Organisation + Settings loaded together (consistency boundary)
- Memberships loaded separately (can be paginated)
- Invitations are a separate query concern

### Transaction Boundary
- Organisation creation: Organisation + Settings + Owner Membership in one transaction
- Ownership transfer: two membership updates in one transaction (BR-ORG-004)
- Member removal: membership revocation + session invalidation in one transaction
- Settings update: single record update, no cross-aggregate dependencies

### Cross-Aggregate Interactions
- Employee aggregate references Organisation for tenant scoping
- Leave aggregate reads OrganisationSettings for working days, holidays, timezone
- Attendance aggregate reads OrganisationSettings for timezone and working hours
- Payroll aggregate reads OrganisationSettings for currency

---

## 2. Membership Aggregate

### Aggregate Root
**OrganisationMembership**

### Child Entities
- None (Membership is a relationship entity linking User to Organisation)

### Invariants
- A user's role is determined per-membership, not per-user (BR-PERM-002)
- A user must have at least one active membership to access org resources (BR-AUTH-001)
- Removing a membership does not delete associated Employee data (BR-ORG-006)
- Deactivated employees' memberships are revoked immediately (BR-AUTH-005)


### Commands
- CreateMembership(userId, orgId, role)
- ActivateMembership(membershipId)
- RevokeMembership(membershipId, reason)
- ChangeRole(membershipId, newRole)
- SwitchOrganisationContext(userId, targetOrgId)

### Domain Events
- MembershipCreated { membershipId, userId, orgId, role }
- MembershipRevoked { membershipId, reason }
- MembershipRoleChanged { membershipId, oldRole, newRole }

### Repository Boundary
- Memberships are queried by userId (for user's org list) and by orgId (for org's member list)
- Membership validation occurs in middleware on every authenticated request

### Transaction Boundary
- Membership creation is part of invitation acceptance or org creation transaction
- Role changes are single-record updates
- Revocation includes session invalidation within same transaction

### Cross-Aggregate Interactions
- Permission service resolves role from Membership for current org context
- Organisation aggregate enforces single-owner constraint via Membership
- Employee aggregate links to User via Membership indirectly

---

## 3. Employee Aggregate

### Aggregate Root
**Employee**

### Child Entities
- ReportingRelationship (1:1 as report, 1:N as manager)
- EmploymentHistory (1:N — department and title change records)

### Invariants
- Employee work email must be unique within an organisation (BR-EMP-002)
- Employee may exist without a linked User account (BR-EMP-001)
- Employment status transitions follow a strict state machine (BR-EMP-003)
- Reporting chains must not contain circular references (BR-EMP-006)
- Department assignment is optional (BR-EMP-007)
- Archived employees are excluded from active queries (BR-EMP-008)
- Deactivation cascades: cancels pending leave, closes attendance, cancels onboarding (BR-EMP-004)


### Commands
- CreateEmployee(personalDetails, employmentDetails, orgId)
- InviteEmployee(employeeId, email)
- UpdatePersonalDetails(employeeId, fields)
- UpdateEmploymentDetails(employeeId, fields)
- AssignDepartment(employeeId, departmentId, effectiveDate)
- AssignJobTitle(employeeId, jobTitleId, effectiveDate)
- AssignManager(employeeId, managerId)
- RemoveManager(employeeId)
- ChangeEmploymentStatus(employeeId, newStatus, reason)
- DeactivateEmployee(employeeId, reason, effectiveDate)
- ReactivateEmployee(employeeId, newStartDate)
- ArchiveEmployee(employeeId)
- UnarchiveEmployee(employeeId)

### Domain Events
- EmployeeCreated { employeeId, orgId, name, status }
- EmployeeInvited { employeeId, email }
- EmployeeActivated { employeeId }
- EmployeeDeactivated { employeeId, reason, cascadedActions }
- EmployeeReactivated { employeeId, newStartDate }
- EmployeeArchived { employeeId }
- ManagerAssigned { employeeId, managerId }
- ManagerRemoved { employeeId, previousManagerId }
- DepartmentChanged { employeeId, fromDeptId, toDeptId, effectiveDate }
- JobTitleChanged { employeeId, fromTitleId, toTitleId, effectiveDate }
- EmploymentStatusChanged { employeeId, fromStatus, toStatus, reason }

### Repository Boundary
- Employee + current ReportingRelationship loaded together
- Employment history loaded on demand (profile detail view)
- Directory queries return lightweight projections (not full aggregate)

### Transaction Boundary
- Employee creation: Employee record + optional invitation in one transaction
- Deactivation: status change + leave cancellation + attendance close + onboarding cancel (single transaction)
- Department/title change: Employee update + history record in one transaction
- Manager assignment: ReportingRelationship create/update (single transaction with cycle detection)

### Cross-Aggregate Interactions
- Leave aggregate checks employee status before allowing requests
- Attendance aggregate checks employee status and leave status before clock-in
- Onboarding aggregate is cancelled on employee deactivation
- Payroll aggregate checks employee active status for inclusion
- Notification aggregate resolves User from Employee for delivery

---

## 4. Leave Aggregate

### Aggregate Root
**LeaveRequest**

### Child Entities
- LeaveApproval (1:1 per request)
- LeaveRequestDocument (1:N attachments)

### Related Configuration Entities (read-only references)
- LeaveType (organisation-level configuration)
- LeavePolicy (entitlement rules)
- LeaveBalance (per-employee per-type running balance)
- HolidayCalendar / Holiday (non-working days)


### Invariants
- Leave requests cannot overlap with existing approved/pending requests (BR-LEAVE-001)
- Insufficient balance prevents submission for balance-tracked types (BR-LEAVE-002)
- Approval reduces balance; cancellation restores it (BR-LEAVE-003, BR-LEAVE-006)
- Manager can only approve direct reports' leave (BR-LEAVE-004)
- Working days exclude weekends and holidays (BR-LEAVE-005)
- Cannot cancel past leave (employee); HR can override (BR-LEAVE-007, BR-LEAVE-008)
- Pending leave reserves balance (BR-LEAVE-009)
- Employee without manager routes to HR (BR-LEAVE-010)
- Half-day leave deducts 0.5 from balance (BR-LEAVE-011)

### Commands
- CreateLeaveType(orgId, name, configuration)
- ConfigureLeavePolicy(leaveTypeId, entitlement, accrualMethod, carryOverLimit)
- AllocateLeaveBalance(employeeId, leaveTypeId, amount, year)
- SubmitLeaveRequest(employeeId, leaveTypeId, startDate, endDate, halfDay, notes)
- AttachDocument(requestId, file)
- ApproveLeaveRequest(requestId, approverId)
- RejectLeaveRequest(requestId, approverId, reason)
- CancelLeaveRequest(requestId, actorId, reason)
- WithdrawLeaveRequest(requestId, employeeId)
- OverrideLeaveDecision(requestId, hrId, action, reason)
- RecalculateBalance(employeeId, leaveTypeId, trigger)

### Domain Events
- LeaveTypeCreated { orgId, leaveTypeId, name }
- LeavePolicyConfigured { orgId, leaveTypeId, entitlement }
- LeaveBalanceAllocated { employeeId, leaveTypeId, amount }
- LeaveRequested { requestId, employeeId, leaveTypeId, days, approverId }
- LeaveApproved { requestId, approverId, balanceDeducted }
- LeaveRejected { requestId, approverId, reason }
- LeaveCancelled { requestId, actorId, balanceRestored }
- LeaveWithdrawn { requestId, employeeId }
- LeaveOverridden { requestId, hrId, action, reason }
- LeaveBalanceRecalculated { employeeId, leaveTypeId, newBalance, trigger }

### Repository Boundary
- LeaveRequest + Approval loaded together
- LeaveBalance is a separate query (calculated from allocations, used, pending)
- LeaveType and Policy are configuration data, loaded on demand
- Holiday calendar loaded during working-day calculations

### Transaction Boundary
- Leave submission: create request + reserve balance in one transaction
- Approval: update status + confirm balance deduction in one transaction
- Cancellation: update status + restore balance in one transaction
- Balance recalculation: bulk update within transaction

### Cross-Aggregate Interactions
- Reads Employee status (must be Active to submit)
- Reads ReportingRelationship to determine approver
- Reads OrganisationSettings for working days and holidays
- Attendance aggregate prevents clock-in on full-day leave
- Employee deactivation cancels all pending leave requests

---

## 5. Attendance Aggregate

### Aggregate Root
**AttendanceRecord**

### Child Entities
- AttendanceCorrection (1:N — linked correction history)

### Invariants
- No duplicate clock-in while session is open (BR-ATT-001)
- All timestamps stored in UTC, displayed in org timezone (BR-ATT-002)
- Corrections require a mandatory reason (BR-ATT-003)
- Only HR can correct attendance (BR-ATT-004)
- Missing clock-out flagged after working hours + 2h buffer (BR-ATT-005)
- Clock-out requires an open session (BR-ATT-006)
- Overnight sessions belong to clock-in date (BR-ATT-007)
- Cannot clock in on full-day leave or holiday (BR-ATT-008)
- Duration is auto-calculated, never user-supplied (BR-ATT-009)


### Commands
- ClockIn(employeeId, locationType)
- ClockOut(employeeId)
- CorrectAttendance(recordId, hrId, newClockIn, newClockOut, reason)
- AddManualAttendance(employeeId, date, clockIn, clockOut, reason, hrId)
- FlagMissingClockOut(recordId)

### Domain Events
- AttendanceClockedIn { recordId, employeeId, timestamp, locationType }
- AttendanceClockedOut { recordId, employeeId, timestamp, duration }
- AttendanceCorrected { recordId, hrId, originalValues, newValues, reason }
- AttendanceManuallyAdded { recordId, employeeId, hrId, date, reason }
- MissingClockOutDetected { recordId, employeeId }

### Repository Boundary
- Current open session is a hot-path query (dashboard state)
- History loaded with date-range pagination
- Corrections linked to original record

### Transaction Boundary
- Clock-in: check no open session + create record (single transaction)
- Clock-out: update existing record with timestamp + duration calculation
- Correction: preserve original + create correction record (single transaction)
- Missing clock-out detection: batch status update

### Cross-Aggregate Interactions
- Reads LeaveRequest (approved full-day leave blocks clock-in)
- Reads HolidayCalendar (holidays block clock-in)
- Reads OrganisationSettings for timezone and working hours
- Employee deactivation closes open sessions
- Conflict detection when leave is approved for a day with attendance

---

## 6. Onboarding Aggregate

### Aggregate Root
**EmployeeOnboarding** (instance of a template applied to an employee)

### Child Entities
- EmployeeOnboardingTask (1:N — concrete tasks with due dates and assignees)

### Related Configuration Entities (read-only references)
- OnboardingTemplate (blueprint)
- OnboardingTemplateTask (blueprint tasks)

### Invariants
- Template instantiation is a snapshot; template changes don't affect instances (BR-ONB-001)
- Due dates are relative to employee joining date (BR-ONB-002)
- Only assigned owner can complete a task (BR-ONB-003)
- Completed tasks can only be reopened by HR (BR-ONB-004)
- Cancellation cascades to all incomplete tasks (BR-ONB-005)
- Single active onboarding per employee (BR-ONB-006)

### Commands
- CreateOnboardingTemplate(orgId, name, description)
- AddTemplateTask(templateId, title, description, assigneeRole, relativeDueDay)
- EditTemplate(templateId, changes)
- ArchiveTemplate(templateId)
- AssignOnboarding(employeeId, templateId)
- CompleteTask(taskId, actorId)
- ReopenTask(taskId, hrId)
- AddTaskNotes(taskId, notes)
- CancelOnboarding(onboardingId, reason)


### Domain Events
- OnboardingTemplateCreated { templateId, orgId, name }
- OnboardingAssigned { onboardingId, employeeId, templateId, taskCount }
- OnboardingTaskCompleted { taskId, onboardingId, actorId }
- OnboardingTaskReopened { taskId, onboardingId, hrId }
- OnboardingCompleted { onboardingId, employeeId, duration }
- OnboardingCancelled { onboardingId, employeeId, reason, tasksCancelledCount }

### Repository Boundary
- EmployeeOnboarding + Tasks loaded together (small bounded set)
- Templates loaded separately (configuration)
- Overdue task queries are cross-employee aggregations

### Transaction Boundary
- Template assignment: create onboarding instance + copy all tasks + calculate due dates (single transaction)
- Task completion: update task + check if all complete + potentially mark onboarding complete
- Cancellation: update all incomplete tasks + update instance status (single transaction)

### Cross-Aggregate Interactions
- Employee deactivation triggers onboarding cancellation
- Notification aggregate delivers task assignment and reminder notifications
- Reads Employee joining date for due-date calculation
- Reads ReportingRelationship to resolve manager-assigned tasks

---

## 7. Document Aggregate

### Aggregate Root
**EmployeeDocument**

### Child Entities
- None (document is a leaf entity with metadata)

### Related Configuration Entities
- DocumentCategory (visibility and sensitivity rules)

### Invariants
- File type validated via magic bytes, not just extension (BR-DOC-001)
- Maximum file size 10MB (BR-DOC-002)
- Storage paths must include organisation_id for tenant isolation (BR-DOC-003)
- Visibility determined by category sensitivity setting (BR-DOC-004)
- Expiry triggers notification at 30 and 7 days (BR-DOC-005)
- Deletion is soft-delete with 90-day retention (BR-DOC-006)
- Upload failure cleanup removes orphaned storage objects (BR-DOC-007)

### Commands
- CreateDocumentCategory(orgId, name, sensitivityLevel, visibility)
- UploadDocument(employeeId, categoryId, file, description, expiryDate)
- ReplaceDocument(documentId, newFile)
- ArchiveDocument(documentId)
- DeleteDocument(documentId, reason)
- SetExpiryDate(documentId, date)


### Domain Events
- DocumentUploaded { documentId, employeeId, categoryId, filename }
- DocumentReplaced { documentId, oldFilename, newFilename }
- DocumentArchived { documentId }
- DocumentDeleted { documentId, permanentDeletionDate }
- DocumentExpiring { documentId, employeeId, expiryDate, daysRemaining }
- DocumentExpired { documentId, employeeId }

### Repository Boundary
- Documents queried per employee (profile view) or across org (expiry report)
- Category configuration loaded on access check
- File storage is a separate infrastructure concern (storage adapter)

### Transaction Boundary
- Upload: validate file + store in object storage + create metadata record (compensating: delete storage on DB failure)
- Replace: upload new file + update metadata (compensating: delete new file on failure)
- Soft-delete: set deleted_at flag (background job handles permanent removal after 90 days)

### Cross-Aggregate Interactions
- Reads DocumentCategory for visibility/sensitivity rules
- Notification aggregate delivers expiry warnings
- Audit aggregate records sensitive document access
- Employee deactivation does NOT cascade to documents (retained for compliance)

---

## 8. Payroll Aggregate

### Aggregate Root
**PayrollPeriod**

### Child Entities
- PayrollRecord (1:N — one per employee per period)
- PayrollLineItem (N per record — earnings, allowances, deductions)

### Invariants
- All monetary values use decimal-safe arithmetic (integer cents) (BR-PAY-001)
- Published payslips are immutable without formal reopening (BR-PAY-002)
- Payroll access restricted to Owner and HR Admin (BR-PAY-003)
- Period lifecycle: Draft → Under Review → Approved → Published → Paid (BR-PAY-004)
- Net pay must equal gross minus deductions (validated before approval) (BR-PAY-005)
- Only active employees can have payroll records (BR-PAY-006)
- Reopening published payroll requires justification and creates high-severity audit (BR-PAY-007)

### Commands
- CreatePayrollPeriod(orgId, startDate, endDate, label)
- GeneratePayrollRecords(periodId)
- AddEarningLine(recordId, type, description, amount)
- AddDeductionLine(recordId, type, description, amount)
- RemoveLineItem(lineItemId)
- SubmitForReview(periodId)
- ApprovePayroll(periodId, approverId)
- RejectToD raft(periodId, reason)
- PublishPayslips(periodId)
- MarkPaid(periodId)
- ReopenPayroll(periodId, ownerId, reason)


### Domain Events
- PayrollPeriodCreated { periodId, orgId, startDate, endDate }
- PayrollRecordsGenerated { periodId, employeeCount }
- PayrollSubmittedForReview { periodId, submitterId }
- PayrollApproved { periodId, approverId }
- PayrollPublished { periodId, payslipCount }
- PayrollMarkedPaid { periodId }
- PayrollReopened { periodId, ownerId, reason }
- PayslipPublished { payslipId, employeeId, periodId, netPay }

### Repository Boundary
- PayrollPeriod + Records + LineItems loaded together (bounded by period)
- Payslips are read-only views generated on publish
- Period list is a summary query (no line items)

### Transaction Boundary
- Record generation: create all employee records in batch transaction
- Line item changes: single record update + recalculate totals
- Approval: validate all records + transition status (single transaction)
- Publication: generate payslips + transition status + trigger notifications (single transaction)
- Reopen: retract payslips + transition status (single transaction)

### Cross-Aggregate Interactions
- Reads Employee compensation data for record generation
- Reads Employee active status to determine inclusion (BR-PAY-006)
- Notification aggregate delivers payslip publication alerts
- Audit aggregate records approvals and reopenings at high severity
- Reads OrganisationSettings for currency

---

## 9. Notification Aggregate

### Aggregate Root
**Notification**

### Child Entities
- None (notifications are standalone records)

### Invariants
- Notifications target Users, not Employees (BR-NOTIF-001)
- No duplicate notifications within 5-minute window (BR-NOTIF-002)
- Notifications are tenant-scoped to organisation (BR-NOTIF-003)
- Read status is per-notification, independent (BR-NOTIF-004)

### Commands
- CreateNotification(recipientUserId, orgId, type, title, body, link)
- MarkRead(notificationId, userId)
- MarkAllRead(userId, orgId)

### Domain Events
- NotificationCreated { notificationId, recipientId, type }
- NotificationRead { notificationId, userId }

### Repository Boundary
- Notifications queried per user per organisation (with unread count)
- Deduplication check is a time-windowed query
- Bulk mark-read is a single update operation

### Transaction Boundary
- Creation: single record insert (after deduplication check)
- Mark read: single record update
- Mark all read: bulk update within org scope

### Cross-Aggregate Interactions
- Triggered by events from all other aggregates (leave approval, task assignment, payslip publication, document expiry, etc.)
- Reads User accounts to resolve recipients
- Does not modify other aggregates (fire-and-forget delivery)

---

## 10. Audit Aggregate

### Aggregate Root
**AuditLog**

### Child Entities
- None (audit entries are immutable, standalone records)

### Invariants
- Audit records are append-only; cannot be edited or deleted (BR-AUDIT-001)
- Sensitive operations must always create audit records (BR-AUDIT-002)
- Update operations capture before/after state (BR-AUDIT-003)
- Every audit record includes actor identity, org context, IP, timestamp (BR-AUDIT-004)
- Retention is indefinite (BR-AUDIT-005)
- Access restricted to Owner and HR Admin (BR-AUDIT-006)


### Commands
- RecordAuditEvent(actorId, orgId, action, targetType, targetId, before, after, metadata)

### Domain Events
- AuditEventRecorded { auditId, action, actorId, orgId } (informational only — audit itself is the record)

### Repository Boundary
- Append-only insert (no UPDATE or DELETE operations)
- Queried with pagination, filtering by action, actor, target, date range
- No write endpoints exposed through application API

### Transaction Boundary
- Audit record creation is typically part of the originating command's transaction (ensures consistency)
- For non-critical audit events, can be async (but must not be lost)

### Cross-Aggregate Interactions
- Receives events from ALL other aggregates
- Reads nothing from other aggregates (receives all context at creation time)
- Never modifies other aggregates
- Independent of all other aggregate lifecycles

---

## Aggregate Interaction Map

```
Organisation ─────────────── settings/config ──────────────┐
     │                                                      │
     │ tenant scope                                         │ reads config
     ▼                                                      ▼
Membership ◄── role ──► Permission Service ◄── checks ── All Aggregates
     │
     │ links
     ▼
Employee ─────── reporting ────► Manager Resolution
     │                                    │
     ├── deactivation ──────────────────► Leave (cancel pending)
     │                                    │
     ├── deactivation ──────────────────► Attendance (close session)
     │                                    │
     ├── deactivation ──────────────────► Onboarding (cancel)
     │                                    │
     ├── active status ─────────────────► Payroll (inclusion check)
     │                                    │
     └── User link ─────────────────────► Notification (delivery)
                                          │
                                          ▼
                                        Audit (append-only log)
```

---

## Aggregate Ownership Summary

| Aggregate | Tenant-Owned | Global | Append-Only | Immutable After State |
|-----------|:---:|:---:|:---:|:---:|
| Organisation | - | ✓ (is the tenant) | - | - |
| Membership | ✓ | - | - | - |
| Employee | ✓ | - | - | Archived |
| Leave | ✓ | - | - | Approved (balance locked) |
| Attendance | ✓ | - | - | Corrected (original preserved) |
| Onboarding | ✓ | - | - | Completed |
| Document | ✓ | - | - | - |
| Payroll | ✓ | - | - | Published (payslips immutable) |
| Notification | ✓ | - | - | - |
| Audit | ✓ | - | ✓ | All (immutable from creation) |

---

## Design Decisions

1. **Aggregates are aligned with transaction boundaries** — each aggregate's invariants can be enforced within a single database transaction without locking other aggregates.

2. **Cross-aggregate communication via domain events** — aggregates do not directly mutate each other. Side effects (e.g., employee deactivation cancelling leave) are orchestrated at the application service layer within a transaction.

3. **Configuration entities are not separate aggregates** — LeaveType, LeavePolicy, DocumentCategory, OnboardingTemplate are configuration/reference data owned by the Organisation. They don't have complex lifecycle rules warranting full aggregate treatment.

4. **Audit is append-only by design** — the Audit aggregate has no update or delete commands. This is enforced at both the application layer (no mutation endpoints) and the database layer (restricted permissions on the audit table).

5. **Notification is fire-and-forget** — notification creation should not fail the originating command. If notification delivery fails, the originating business operation still succeeds.

6. **Employee is the richest aggregate** — it serves as the primary subject for Leave, Attendance, Onboarding, Document, and Payroll aggregates. However, these modules maintain their own aggregate roots to avoid an overly large Employee aggregate.
