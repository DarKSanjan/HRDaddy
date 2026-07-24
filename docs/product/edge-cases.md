# Edge Cases Catalogue

This document catalogues edge cases across all HR Daddy modules with expected system behaviour for each. Edge cases are grouped by the primary module affected, though many span multiple modules.

---

## Organisation & Membership

### EC-ORG-001: Owner is also an Employee

- **Scenario:** The Organisation Owner has an associated Employee record in the same organisation.
- **Expected behaviour:** The Owner has full Owner permissions via their Membership role. Their Employee record is treated identically to any other employee for leave, attendance, payroll, and onboarding. The system does not conflate role-based authority with employment data. If the Owner submits a leave request, it routes to HR for approval (since no one "manages" the Owner).
- **Risks:** UI may confuse "manage self" permissions with Owner permissions.

### EC-ORG-002: Invitation accepted twice (replay attack)

- **Scenario:** A user attempts to use an invitation link that has already been accepted.
- **Expected behaviour:** The system returns an error "Invitation already accepted" (BR-AUTH-008). The token is permanently invalidated after first use. No duplicate Membership or Employee record is created. The existing Membership remains unaffected.
- **Risks:** Race condition if two requests arrive simultaneously — atomic token consumption required.


### EC-ORG-003: User belongs to multiple Organisations

- **Scenario:** A single User has active Memberships in two or more Organisations with different roles (e.g., Owner in Org A, Employee in Org B).
- **Expected behaviour:** Permissions are resolved per-Membership for the current organisation context (BR-PERM-002). Switching org context invalidates the previous context (BR-AUTH-006). Notifications, leave, attendance, and all data are strictly scoped to the active organisation. No data leaks between org contexts.
- **Risks:** Session state pollution if org context switch is not atomic.

### EC-ORG-004: Organisation archived / deleted

- **Scenario:** An Organisation is decommissioned (future feature), but users still have sessions or bookmarks.
- **Expected behaviour:** V1 does not support Organisation deletion. If implemented in future: all Memberships should be revoked, active sessions invalidated, and users redirected to an "Organisation no longer available" message. Employee data is retained for compliance per BR-ORG-006.
- **Risks:** Orphaned background jobs (expiry checks, payroll reminders) continuing to fire for a defunct org.

### EC-ORG-005: Sole Owner attempts to leave Organisation

- **Scenario:** The only Owner tries to remove their own Membership or downgrade their role.
- **Expected behaviour:** The system rejects the operation with "Organisation must have exactly one Owner" (BR-ORG-003). The Owner must first transfer ownership via the atomic transfer process before they can be downgraded or removed.
- **Risks:** None if enforced correctly; deadlock if Owner account is compromised and no transfer mechanism exists.


---

## Employee Lifecycle

### EC-EMP-001: Employee has no login (no User account)

- **Scenario:** An Employee record exists but the employee_id has no linked User account (user_id is NULL).
- **Expected behaviour:** The Employee appears in the directory, can be assigned leave balances, included in payroll, and have documents uploaded for them by HR. They cannot log in, clock in/out, submit leave themselves, or receive notifications (BR-NOTIF-001). HR manages all their records on their behalf.
- **Risks:** UI must gracefully handle missing self-service features without errors.

### EC-EMP-002: Employee has no manager assigned

- **Scenario:** An Employee has no ReportingRelationship (manager_id is NULL).
- **Expected behaviour:** Leave requests route to HR Administrator for approval (BR-LEAVE-010). Onboarding tasks assigned to "manager" role are flagged for HR reassignment. Team views for this employee are empty. The employee can still clock in/out and access self-service features.
- **Risks:** Approval workflows must always have a fallback path; never block on missing manager.

### EC-EMP-003: Manager is deactivated while having direct reports

- **Scenario:** A manager with active direct reports and pending leave approvals is deactivated.
- **Expected behaviour:** Per BR-CROSS-002: pending leave approvals from their reports reroute to HR. Direct reports are flagged as "manager-less" (no active reporting relationship). The manager's own pending leave is cancelled. Their attendance session is closed. Their onboarding (if any) is cancelled. HR receives a notification about orphaned reports.
- **Risks:** If deactivation is not transactional, some reports may lose their approval path silently.


### EC-EMP-004: Deactivation during active onboarding

- **Scenario:** An employee is deactivated while their onboarding is in progress with incomplete tasks.
- **Expected behaviour:** Per BR-EMP-004 and BR-ONB-005: the onboarding instance is cancelled, all pending/in-progress tasks are marked as cancelled, and the cancellation_reason is set to "employee_deactivated". Completed tasks retain their completed status for historical record. No further task reminders are sent.
- **Risks:** Task assignees (HR, manager) may not be notified that their assigned tasks are now moot.

### EC-EMP-005: Department change during pending leave request

- **Scenario:** An employee moves to a new department (and potentially a new manager) while they have a pending leave request assigned to their old manager.
- **Expected behaviour:** The pending leave request remains assigned to the original approver (the old manager) since it was submitted under that relationship. Future leave requests will route to the new manager. The system does NOT retroactively reassign pending approvals on department change.
- **Risks:** If the old manager is also moving/deactivating simultaneously, the pending request may need HR escalation.

### EC-EMP-006: Employee reactivation after deactivation

- **Scenario:** A previously deactivated employee is reactivated (e.g., rehire).
- **Expected behaviour:** Per BR-CROSS-004: reactivation creates a fresh active state. Previously cancelled leave, closed attendance, and cancelled onboarding are NOT restored. Leave balances start fresh for the new employment period. The employee's start_date and reactivated_at are updated. A new onboarding can be assigned.
- **Risks:** HR may expect historical data to "come back" — UI should clearly communicate that reactivation is a fresh start.


---

## Leave Management

### EC-LEAVE-001: Leave request overlaps a public holiday

- **Scenario:** An employee submits a leave request for Monday–Friday, but Wednesday is a configured public holiday.
- **Expected behaviour:** The working days calculation excludes the holiday (BR-LEAVE-005). The request shows 4 working days deducted, not 5. If the holiday is added to the calendar AFTER the leave was submitted (but before approval), the pending request's working_days should be recalculated (BR-CROSS-005).
- **Risks:** Stale working_days value if holiday calendar changes are not propagated to pending requests.

### EC-LEAVE-002: Leave approved after balance has changed

- **Scenario:** An employee submits a leave request when balance is sufficient. Before approval, another request is approved that reduces their balance below what this request needs.
- **Expected behaviour:** The pending request reserves balance at submission time (BR-LEAVE-009). If the reservation system is working correctly, this scenario cannot occur because the second request would have failed the balance check. If a race condition bypasses the reservation, the approval should fail with "Insufficient balance" and the request should remain pending for the employee to cancel or HR to override.
- **Risks:** Requires optimistic locking on LeaveBalance or serialised balance checks.

### EC-LEAVE-003: Half-day leave on a half-working-day

- **Scenario:** Organisation has a half-day Friday (working hours 09:00–13:00). Employee requests half-day leave on Friday.
- **Expected behaviour:** V1 does not support variable working hours per day. Working hours are configured uniformly. A half-day leave request on any working day deducts 0.5 days (BR-LEAVE-011) regardless of the actual hours configured. Future versions may support per-day working hours.
- **Risks:** Employee expectation mismatch if they believe Friday is already "half day."


### EC-LEAVE-004: Leave request spans year boundary

- **Scenario:** An employee requests leave from 28 Dec 2024 to 3 Jan 2025 (crosses the leave year boundary).
- **Expected behaviour:** The working days are split across the two leave years based on the organisation's leave_year_start_month. Days falling in the current year deduct from the current year's balance; days in the next year deduct from next year's balance. If next year's balance is not yet allocated, the system should either reject the request or allow it if the leave type permits negative balance.
- **Risks:** Complex balance calculation; must handle the case where next year's policy hasn't been configured yet.

### EC-LEAVE-005: Working days configuration changes after leave submission

- **Scenario:** Organisation changes working days from Mon–Fri to Mon–Sat while leave requests are pending.
- **Expected behaviour:** Pending leave requests should be recalculated to reflect the new working days configuration (BR-CROSS-005). Already-approved leave retains its original working_days calculation (balance already deducted). Notifications are sent to affected employees about the recalculation.
- **Risks:** Mass recalculation could be expensive. UI must surface the change clearly.

### EC-LEAVE-006: Concurrent approval and cancellation

- **Scenario:** A manager clicks "Approve" at the same moment the employee clicks "Withdraw."
- **Expected behaviour:** Optimistic locking on LeaveRequest (version field) ensures only one operation succeeds. The first transaction to commit wins. The second receives a conflict error ("Request has been modified. Please refresh."). Balance adjustments correspond only to the winning operation.
- **Risks:** Without optimistic locking, both could succeed leading to inconsistent balance state.

### EC-LEAVE-007: Leave request for a deactivated employee's approver

- **Scenario:** The designated approver (manager) is deactivated after the leave request was submitted but before they approve it.
- **Expected behaviour:** Per BR-CROSS-002, the pending request reroutes to HR. The employee is notified that their request has been escalated. HR can approve or reject. The original approver_id field may be updated or an escalation_reason recorded.
- **Risks:** If the escalation is not automated, the request could be stuck in "pending" indefinitely.


---

## Attendance & Clocking

### EC-ATT-001: Overnight clock (shift spanning midnight)

- **Scenario:** An employee clocks in at 22:00 on January 5 and clocks out at 06:00 on January 6.
- **Expected behaviour:** Per BR-ATT-007, the session belongs to the clock-in date (January 5). The session_date is set to January 5. Duration is calculated as 8 hours. The attendance record appears under January 5 in history views. This does not create a duplicate entry for January 6.
- **Risks:** Timezone conversion may cause date boundary confusion if org timezone differs significantly from UTC.

### EC-ATT-002: Open session (forgot to clock out)

- **Scenario:** An employee clocks in at 09:00 but never clocks out. End of working hours + 2h buffer passes.
- **Expected behaviour:** Per BR-ATT-005, a background job detects the open session past the threshold and flags it as "missing_clock_out". HR is notified. The session remains open (no auto-close with fabricated time). HR must manually correct the record with a clock-out time and mandatory reason (BR-ATT-003).
- **Risks:** If the background job fails or is delayed, the session remains perpetually open until next clock-in attempt (which will fail per BR-ATT-001).

### EC-ATT-003: Clock-in attempt on full-day approved leave

- **Scenario:** An employee has approved full-day leave today and attempts to clock in.
- **Expected behaviour:** Per BR-ATT-008, the clock-in is rejected with "Cannot clock in — you have approved full-day leave today." Half-day leave does not block clock-in (employee works the other half).
- **Risks:** If leave is approved AFTER the employee already clocked in, the conflict is flagged for HR review per BR-CROSS-003 (not auto-resolved).

### EC-ATT-004: Employee deactivation with open attendance session

- **Scenario:** An employee is deactivated while they have an open attendance session (clocked in, not yet out).
- **Expected behaviour:** Per BR-EMP-004, the deactivation cascade closes the open session. The clock_out timestamp is set to the deactivation timestamp. The session source is marked as "system". Duration is calculated. A correction note is added: "Auto-closed due to employee deactivation."
- **Risks:** Duration may be abnormally long if deactivation happens hours after the normal work period.


### EC-ATT-005: Timezone change after attendance recorded

- **Scenario:** Organisation changes timezone from UTC+8 to UTC+5 mid-day, after employees have already clocked in.
- **Expected behaviour:** All timestamps are stored in UTC (BR-ATT-002), so the raw data is unaffected. The display layer applies the new timezone going forward. Existing records display correctly under the new timezone (their UTC timestamps simply render differently). Open sessions are unaffected — clock-out will be stored in UTC and displayed in the new timezone.
- **Risks:** Employees may perceive their clock-in time as "wrong" because the display changed. Clear communication needed.

---

## Onboarding

### EC-ONB-001: Template modified after assignment to employee

- **Scenario:** HR edits an onboarding template (adds/removes tasks) after it has been assigned to an employee.
- **Expected behaviour:** Per BR-ONB-001, template changes do NOT affect existing employee onboarding instances. The employee's tasks are a snapshot taken at assignment time. Only newly assigned onboardings will use the updated template.
- **Risks:** HR may expect edits to propagate. UI should clearly label templates as "blueprints" and show the snapshot date on employee instances.

### EC-ONB-002: Onboarding task assigned to manager but employee has no manager

- **Scenario:** A template has tasks with assignee_role = "manager" but the employee being onboarded has no manager assigned.
- **Expected behaviour:** During instantiation, tasks that cannot resolve a specific assignee are flagged and assigned to HR as fallback. HR receives a notification: "Task [X] could not be assigned to manager — no manager found for [Employee]. Assigned to HR." The task's assignee_role remains "manager" for context, but assignee_id points to an HR user.
- **Risks:** If no HR admin exists in the org (only Owner), tasks may need to fall back to Owner.

### EC-ONB-003: All onboarding tasks completed except one cancelled task

- **Scenario:** An onboarding instance has 10 tasks. 9 are completed, 1 was cancelled by HR (e.g., no longer applicable).
- **Expected behaviour:** The onboarding is marked as "completed" because all non-cancelled tasks are done. Cancelled tasks are excluded from the completion check. The completion timestamp is set to when the last non-cancelled task was completed.
- **Risks:** Edge case where ALL tasks are cancelled — onboarding should be marked as "cancelled" not "completed."


---

## Documents

### EC-DOC-001: Document expires after employee leaves

- **Scenario:** An employee is deactivated (left the company). 30 days later, one of their documents reaches its expiry date.
- **Expected behaviour:** The document expiry notification is NOT sent to the former employee (they have no active User/Membership). HR still receives the expiry alert for compliance tracking. The document status transitions to "expired" as normal. Documents are retained regardless of employee status (BR-ORG-006).
- **Risks:** Notification routing must check employee active status and User account existence before delivery.

### EC-DOC-002: File upload succeeds in storage but DB write fails

- **Scenario:** A document file is successfully uploaded to object storage, but the subsequent database metadata insert fails (e.g., unique constraint violation, connection timeout).
- **Expected behaviour:** Per BR-DOC-007, the compensating transaction deletes the orphaned storage object. The user receives an error "Document upload failed. Please try again." No partial record exists in either storage or database.
- **Risks:** If the compensating delete also fails (network issue), a background cleanup job must handle orphaned files.

### EC-DOC-003: Document category visibility change after upload

- **Scenario:** HR changes a document category from "employee_visible" to "hr_only" after documents have been uploaded in that category.
- **Expected behaviour:** The visibility change applies immediately to all existing documents in that category. Employees who previously could see these documents can no longer access them. The change is audited. No notification is sent to affected employees (they simply lose access).
- **Risks:** Employee may have bookmarked/downloaded the document already — the system cannot revoke downloaded copies.

---

## Payroll

### EC-PAY-001: Payroll generated for employee who is deactivated mid-period

- **Scenario:** A payroll period covers March 1–31. An employee is deactivated on March 15.
- **Expected behaviour:** Per BR-PAY-006, only active employees can have payroll records. If the employee was active when records were generated (e.g., on March 1) but deactivated before approval, the payroll record remains. HR must manually adjust line items to reflect the partial month. The system does NOT auto-calculate pro-rata for deactivation.
- **Risks:** If payroll generation happens after deactivation, the employee is excluded entirely — HR must add a manual record if final pay is owed.


### EC-PAY-002: Concurrent payroll approvals by two HR admins

- **Scenario:** Two HR admins simultaneously click "Approve" on the same payroll period.
- **Expected behaviour:** Optimistic locking on PayrollPeriod (version field) ensures only one approval succeeds. The first transaction commits the status transition to "approved." The second receives a conflict error ("Payroll period has been modified. Please refresh."). Only one audit record and one set of notifications are created.
- **Risks:** Without optimistic locking, double-approval could trigger duplicate payslip generation.

### EC-PAY-003: Reopening published payroll

- **Scenario:** Owner discovers an error in a published payroll period and needs to make corrections.
- **Expected behaviour:** Per BR-PAY-007, reopening requires a mandatory justification reason. A high-severity audit event is created. Published payslips are retracted (employees can no longer view them). The period status reverts to "draft." All corrections follow the normal edit → review → approve → publish flow. New payslips replace the old ones.
- **Risks:** Employees may have already seen/downloaded their payslips. The system cannot revoke viewed information.

---

## Notifications & System

### EC-NOTIF-001: Notification for employee without User account

- **Scenario:** A system event should generate a notification (e.g., document expiry) but the target Employee has no linked User account.
- **Expected behaviour:** Per BR-NOTIF-001, no notification is created. The system silently skips notification delivery for employees without User accounts. The triggering event (document expiry) still occurs and is audited — only the notification is suppressed.
- **Risks:** Important events may go unnoticed if the intended recipient has no login. HR notifications should cover the gap.

### EC-NOTIF-002: Duplicate notification prevention (rapid retries)

- **Scenario:** A network glitch causes the same domain event to be processed twice within seconds.
- **Expected behaviour:** Per BR-NOTIF-002, the deduplication check (event_type + recipient + target + 5-minute window) prevents the second notification from being created. Only one notification appears in the recipient's inbox.
- **Risks:** If the dedup window is too short, legitimate rapid events (e.g., two different leave approvals seconds apart) might be incorrectly deduplicated.


### EC-NOTIF-003: DB success but notification delivery failure

- **Scenario:** A leave request is approved (DB transaction commits successfully), but the notification system fails to deliver the approval notification to the employee.
- **Expected behaviour:** Per the domain model design, notification creation is fire-and-forget. The business operation (leave approval) succeeds regardless of notification failure. The notification may be retried by a background job, or the employee discovers the approval via the UI. The notification failure is logged but does not roll back the approval.
- **Risks:** Employee may not know their leave was approved until they check the app. Critical for time-sensitive approvals.

---

## Cross-Module & Infrastructure

### EC-CROSS-001: File upload succeeds but DB notification insert fails

- **Scenario:** A document is uploaded and saved to DB, but the notification about the upload fails to persist.
- **Expected behaviour:** The document upload is considered successful. The notification failure does not affect the core operation. The notification service logs the failure. The document appears in the employee's document list. The upload audit event is still recorded (audit is part of the main transaction).
- **Risks:** Notification table constraints (e.g., dedup check failure) should never cascade to the triggering operation.

### EC-CROSS-002: Leave approved for a day with existing attendance

- **Scenario:** An employee clocked in on Monday. Later, a backdated leave request covering Monday is approved by HR.
- **Expected behaviour:** Per BR-CROSS-003, the system flags a conflict for HR review rather than auto-resolving. HR is shown the conflict: "Employee has attendance recorded on [date] which overlaps with approved leave." HR can choose to: (a) correct the attendance record, (b) cancel the leave for that day, or (c) dismiss the conflict with a reason.
- **Risks:** If the conflict detection runs asynchronously, there may be a window where both records coexist without a flag.

### EC-CROSS-003: Circular reporting chain attempt

- **Scenario:** Employee A reports to B, B reports to C. An admin tries to set C's manager as A.
- **Expected behaviour:** Per BR-EMP-006, the cycle detection algorithm prevents the assignment. The system returns: "Cannot assign [A] as manager for [C] — this would create a circular reporting chain." The existing relationships remain unchanged.
- **Risks:** Detection must traverse the full chain, not just direct parent. Performance concern for deeply nested hierarchies.


### EC-CROSS-004: Holiday added to calendar recalculates pending leave

- **Scenario:** HR adds a new holiday to the calendar. Three employees have pending leave requests covering that date.
- **Expected behaviour:** Per BR-CROSS-005, all pending leave requests overlapping the new holiday are recalculated. Working days are reduced by 1 for each affected request. Reserved balance (pending) is adjusted. Affected employees and their approvers are notified of the recalculation.
- **Risks:** If a request now has 0 working days (e.g., it was a single-day request on the new holiday), it should be auto-cancelled with reason "Covered by public holiday."

### EC-CROSS-005: Payroll period includes both active and just-deactivated employees

- **Scenario:** Payroll is generated on March 1 for the March period. On March 10, an employee is deactivated. On March 20, HR submits payroll for review.
- **Expected behaviour:** The employee's payroll record (created on March 1 when they were active) remains in the period. HR is expected to review and adjust line items for the partial month. The record is not auto-removed on deactivation. A warning indicator shows "Employee deactivated during this period" on their payroll record.
- **Risks:** If payroll generation is re-run after deactivation, the employee would be excluded — the original record should be preserved, not regenerated.

### EC-CROSS-006: Organisation timezone change affects dashboard "today" metrics

- **Scenario:** Organisation timezone is changed from UTC+8 to UTC-5 at 10:00 UTC. Dashboard queries for "present today" and "on leave today" must recalculate.
- **Expected behaviour:** "Today" is always calculated relative to the organisation's configured timezone. After the change, "today" shifts from the SGT date to the EST date. Attendance records for "today" are re-evaluated against the new date. The dashboard immediately reflects the new timezone's "today." Historical data display changes but underlying UTC data is unaffected.
- **Risks:** Cached dashboard queries may show stale data until the cache invalidates.

### EC-CROSS-007: Working days change from 5 to 6 days

- **Scenario:** Organisation changes working days from [Mon–Fri] to [Mon–Sat] effective immediately.
- **Expected behaviour:** Future attendance expectations now include Saturday. Pending leave requests are recalculated (a Mon–Sat request now counts 6 days instead of 5). Already-approved leave is NOT recalculated (balance already locked). Leave balance calculations for future submissions use the new working days. A bulk notification informs employees of the policy change.
- **Risks:** Historical attendance queries should use the working days configuration that was active at the time, not the current configuration.


### EC-CROSS-008: Concurrent leave approvals exhaust shared balance

- **Scenario:** Employee has 3 days balance. Two pending requests (2 days each, different dates) exist. Manager approves both simultaneously from two browser tabs.
- **Expected behaviour:** The pending reservation system (BR-LEAVE-009) should have prevented both requests from being submitted (2 + 2 > 3). If both were submitted before reservation was implemented or a race occurred at submission: optimistic locking on LeaveBalance ensures only one approval deducts successfully. The second approval fails with a balance conflict error.
- **Risks:** Reservation at submission time is the primary defence. Approval-time validation is the secondary safety net.

### EC-CROSS-009: Employee invited to org they were previously removed from

- **Scenario:** A user was previously a member of an Organisation (membership revoked), and is now re-invited.
- **Expected behaviour:** A new Invitation is created. Upon acceptance, a new active Membership is created. The old revoked Membership record remains for audit history. The user may or may not have an existing Employee record from before (per BR-ORG-006, employee data is retained). If the Employee record exists, the invitation can be linked to it via employee_id; otherwise a new Employee record is created.
- **Risks:** Duplicate Employee records if the system doesn't detect the existing (deactivated) record. HR should be prompted to link or create new.

### EC-CROSS-010: Bulk employee import with partial failures

- **Scenario:** HR imports 50 employees via CSV. 47 succeed, 3 fail (duplicate email, invalid data).
- **Expected behaviour:** V1 does not include bulk import. If implemented: each row should be processed independently (not all-or-nothing). A results summary shows: 47 created, 3 failed with specific error per row. Failed rows are returned for correction. Successfully created employees are immediately usable.
- **Risks:** Partial success states can confuse users. Clear success/failure breakdown is essential.

---

## Summary Table

| ID | Module | Edge Case | Severity |
|----|--------|-----------|----------|
| EC-ORG-001 | Organisation | Owner is also employee | Medium |
| EC-ORG-002 | Organisation | Invitation accepted twice | High |
| EC-ORG-003 | Organisation | User in multiple orgs | High |
| EC-ORG-004 | Organisation | Org archived/deleted | Low (future) |
| EC-ORG-005 | Organisation | Sole owner self-removal | High |
| EC-EMP-001 | Employee | Employee without login | Medium |
| EC-EMP-002 | Employee | No manager assigned | Medium |
| EC-EMP-003 | Employee | Manager deactivated with reports | High |
| EC-EMP-004 | Employee | Deactivation during onboarding | Medium |
| EC-EMP-005 | Employee | Dept change during pending leave | Medium |
| EC-EMP-006 | Employee | Reactivation after deactivation | Medium |
| EC-LEAVE-001 | Leave | Leave overlaps holiday | Medium |
| EC-LEAVE-002 | Leave | Approved after balance change | High |
| EC-LEAVE-003 | Leave | Half-day on half-working-day | Low |
| EC-LEAVE-004 | Leave | Leave spans year boundary | High |
| EC-LEAVE-005 | Leave | Working days config change | Medium |
| EC-LEAVE-006 | Leave | Concurrent approval & cancel | High |
| EC-LEAVE-007 | Leave | Approver deactivated post-submit | Medium |
| EC-ATT-001 | Attendance | Overnight clock | Medium |
| EC-ATT-002 | Attendance | Open session / forgot clock-out | Medium |
| EC-ATT-003 | Attendance | Clock-in on leave day | Medium |
| EC-ATT-004 | Attendance | Deactivation with open session | Medium |
| EC-ATT-005 | Attendance | Timezone change after clocking | Low |
| EC-ONB-001 | Onboarding | Template modified after assign | Low |
| EC-ONB-002 | Onboarding | Task for manager but no manager | Medium |
| EC-ONB-003 | Onboarding | Completion with cancelled tasks | Low |
| EC-DOC-001 | Documents | Expiry after employee leaves | Low |
| EC-DOC-002 | Documents | Upload storage OK but DB fail | High |
| EC-DOC-003 | Documents | Category visibility change | Medium |
| EC-PAY-001 | Payroll | Deactivated employee mid-period | Medium |
| EC-PAY-002 | Payroll | Concurrent payroll approvals | High |
| EC-PAY-003 | Payroll | Reopening published payroll | High |
| EC-NOTIF-001 | Notifications | No User account for employee | Low |
| EC-NOTIF-002 | Notifications | Duplicate notification | Medium |
| EC-NOTIF-003 | Notifications | DB OK but notification fails | Low |
| EC-CROSS-001 | Cross-module | DB OK but notification insert fails | Low |
| EC-CROSS-002 | Cross-module | Leave approved on attendance day | High |
| EC-CROSS-003 | Cross-module | Circular reporting chain | Medium |
| EC-CROSS-004 | Cross-module | Holiday recalculates pending leave | Medium |
| EC-CROSS-005 | Cross-module | Payroll with deactivated employee | Medium |
| EC-CROSS-006 | Cross-module | Timezone change affects dashboard | Low |
| EC-CROSS-007 | Cross-module | Working days change 5→6 | Medium |
| EC-CROSS-008 | Cross-module | Concurrent approvals exhaust balance | High |
| EC-CROSS-009 | Cross-module | Re-invitation of removed member | Medium |
| EC-CROSS-010 | Cross-module | Bulk import partial failure | Low (future) |
