# Domain Events Catalogue

This document defines all domain events emitted by HR Daddy V1. Each event specifies its producer, trigger, payload shape, consumers, notification effects, audit effects, and whether it is processed synchronously or asynchronously.

---

## Event Delivery Model (V1)

In V1, HR Daddy uses a **synchronous in-process event bus**. Events are emitted within the same transaction as the producing command. Consumers execute sequentially within the application service layer. This simplifies deployment (no message broker) while preserving domain separation.

**Future (V2+):** Migrate critical events to an async queue (e.g., SQS, BullMQ) for resilience and horizontal scaling.

### Retry Behaviour (V1)

- Notification delivery failures do NOT fail the originating transaction
- Audit event failures DO fail the originating transaction (audit is critical)
- Failed email delivery is logged and retried 3 times with exponential backoff

### Idempotency

- All event handlers must be idempotent (safe to replay)
- Events carry a unique `eventId` (UUID) for deduplication
- Consumers track processed event IDs to prevent duplicate side effects

---

## Events

---

### 1. OrganisationCreated

| Field | Value |
|-------|-------|
| **Producer** | Organisation Service |
| **Trigger** | User completes createOrganisation command |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface OrganisationCreatedEvent {
  eventId: string;
  eventType: "OrganisationCreated";
  timestamp: string;           // ISO 8601 UTC
  payload: {
    organisationId: string;
    name: string;
    ownerId: string;
    timezone: string;
    currency: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `organisation.created` audit event |
| Leave Service | Seeds default leave types (Annual, Sick, Unpaid) |
| Settings Service | Creates default organisation settings |

#### Notification Effects

- None (creator is the actor; no one else to notify yet)

#### Audit Effects

- Creates audit record: action=`organisation.created`, actor=ownerId, target=organisationId

---


### 2. MemberInvited

| Field | Value |
|-------|-------|
| **Producer** | Organisation Service |
| **Trigger** | Owner or HR Admin executes inviteMember command |
| **V1 Processing** | Synchronous (event); Async (email delivery) |

#### Payload Shape

```typescript
interface MemberInvitedEvent {
  eventId: string;
  eventType: "MemberInvited";
  timestamp: string;
  payload: {
    organisationId: string;
    invitationId: string;
    email: string;
    role: string;
    inviterId: string;
    expiresAt: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `member.invited` audit event |
| Email Service | Sends invitation email with secure acceptance link |
| Notification Service | Notifies Owner if HR Admin performed invite |

#### Notification Effects

- Email: invitation link sent to invitee
- In-app: notification to Owner (if HR Admin was actor)

#### Audit Effects

- Creates audit record: action=`member.invited`, actor=inviterId, target=email, metadata={role, expiresAt}

---

### 3. InvitationAccepted

| Field | Value |
|-------|-------|
| **Producer** | Auth Service |
| **Trigger** | User clicks invitation link and completes acceptance |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface InvitationAcceptedEvent {
  eventId: string;
  eventType: "InvitationAccepted";
  timestamp: string;
  payload: {
    organisationId: string;
    invitationId: string;
    userId: string;
    email: string;
    role: string;
    membershipId: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `invitation.accepted` audit event |
| Membership Service | Activates membership record |
| Employee Service | Links User to Employee record (if exists) |
| Notification Service | Notifies the inviter |

#### Notification Effects

- In-app: notification to inviter: "[Name] has accepted your invitation"
- In-app: notification to Owner (if inviter is HR Admin)

#### Audit Effects

- Creates audit record: action=`invitation.accepted`, actor=userId, target=invitationId

---


### 4. EmployeeCreated

| Field | Value |
|-------|-------|
| **Producer** | Employee Service |
| **Trigger** | HR Admin or Owner creates a new employee record |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface EmployeeCreatedEvent {
  eventId: string;
  eventType: "EmployeeCreated";
  timestamp: string;
  payload: {
    organisationId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    workEmail: string;
    status: "draft" | "invited";
    departmentId: string | null;
    managerId: string | null;
    startDate: string;
    createdBy: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `employee.created` audit event |
| Leave Service | Allocates default leave balances for the employee |
| Notification Service | Notifies assigned manager (if any) |

#### Notification Effects

- In-app: notification to manager (if assigned): "New team member: [Name]"

#### Audit Effects

- Creates audit record: action=`employee.created`, actor=createdBy, target=employeeId

---

### 5. EmployeeActivated

| Field | Value |
|-------|-------|
| **Producer** | Employee Service |
| **Trigger** | Employee accepts invitation or HR manually activates |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface EmployeeActivatedEvent {
  eventId: string;
  eventType: "EmployeeActivated";
  timestamp: string;
  payload: {
    organisationId: string;
    employeeId: string;
    userId: string | null;
    activatedBy: string;
    previousStatus: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `employee.activated` audit event |
| Onboarding Service | May trigger auto-assignment of onboarding template |
| Dashboard Service | Increments active employee count |

#### Notification Effects

- In-app: notification to HR: "[Name] is now active"

#### Audit Effects

- Creates audit record: action=`employee.activated`, actor=activatedBy, target=employeeId, before={status: previousStatus}, after={status: "active"}

---

### 6. EmployeeDeactivated

| Field | Value |
|-------|-------|
| **Producer** | Employee Service |
| **Trigger** | HR Admin or Owner deactivates an employee |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface EmployeeDeactivatedEvent {
  eventId: string;
  eventType: "EmployeeDeactivated";
  timestamp: string;
  payload: {
    organisationId: string;
    employeeId: string;
    reason: string;
    deactivatedBy: string;
    cascadedActions: {
      leaveCancelled: number;
      attendanceClosed: boolean;
      onboardingCancelled: boolean;
    };
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `employee.deactivated` high-severity audit event |
| Leave Service | Cancels all pending leave requests (BR-EMP-004) |
| Attendance Service | Closes open session if any (BR-EMP-004) |
| Onboarding Service | Cancels active onboarding (BR-EMP-004) |
| Session Service | Invalidates all active sessions |
| Notification Service | Notifies manager of the deactivation |

#### Notification Effects

- In-app: notification to employee's manager: "[Name] has been deactivated"
- In-app: notification to HR team confirming cascaded actions

#### Audit Effects

- Creates audit record: action=`employee.deactivated`, actor=deactivatedBy, target=employeeId, metadata={reason, cascadedActions}, severity=elevated

---


### 7. ManagerAssigned

| Field | Value |
|-------|-------|
| **Producer** | Employee Service |
| **Trigger** | HR Admin or Owner assigns a manager via assignManager command |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface ManagerAssignedEvent {
  eventId: string;
  eventType: "ManagerAssigned";
  timestamp: string;
  payload: {
    organisationId: string;
    employeeId: string;
    managerId: string;
    previousManagerId: string | null;
    assignedBy: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `manager.assigned` audit event |
| Notification Service | Notifies new manager, employee, and previous manager |
| Leave Service | Future requests route to new manager (existing pending stay with original) |

#### Notification Effects

- In-app to new manager: "[Name] has been assigned as your direct report"
- In-app to employee: "[Manager Name] is now your manager"
- In-app to previous manager (if any): "[Name] has been reassigned to another manager"

#### Audit Effects

- Creates audit record: action=`manager.assigned`, actor=assignedBy, target=employeeId, metadata={managerId, previousManagerId}

---

### 8. LeaveRequested

| Field | Value |
|-------|-------|
| **Producer** | Leave Service |
| **Trigger** | Employee submits a leave request |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface LeaveRequestedEvent {
  eventId: string;
  eventType: "LeaveRequested";
  timestamp: string;
  payload: {
    organisationId: string;
    requestId: string;
    employeeId: string;
    leaveTypeId: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    workingDays: number;
    halfDay: string | null;
    approverId: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `leave.requested` audit event |
| Notification Service | Notifies approver (manager or HR) |
| Balance Service | Reserves balance (pending deduction) |

#### Notification Effects

- In-app to approver: "[Name] has requested [X] days of [LeaveType] ([dates])"
- Email to approver (if enabled)

#### Audit Effects

- Creates audit record: action=`leave.requested`, actor=employeeId, target=requestId, metadata={leaveType, days, approver}

---

### 9. LeaveApproved

| Field | Value |
|-------|-------|
| **Producer** | Leave Service |
| **Trigger** | Manager or HR Admin approves a pending leave request |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface LeaveApprovedEvent {
  eventId: string;
  eventType: "LeaveApproved";
  timestamp: string;
  payload: {
    organisationId: string;
    requestId: string;
    employeeId: string;
    approverId: string;
    leaveTypeId: string;
    workingDays: number;
    balanceDeducted: number;
    startDate: string;
    endDate: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `leave.approved` audit event |
| Notification Service | Notifies employee of approval |
| Balance Service | Confirms deduction (moves from pending to used) |
| Calendar Service | Updates team leave calendar |

#### Notification Effects

- In-app to employee: "Your [LeaveType] request has been approved"
- Email to employee (if enabled)

#### Audit Effects

- Creates audit record: action=`leave.approved`, actor=approverId, target=requestId, metadata={days, balance}

---


### 10. LeaveRejected

| Field | Value |
|-------|-------|
| **Producer** | Leave Service |
| **Trigger** | Manager or HR Admin rejects a pending leave request |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface LeaveRejectedEvent {
  eventId: string;
  eventType: "LeaveRejected";
  timestamp: string;
  payload: {
    organisationId: string;
    requestId: string;
    employeeId: string;
    approverId: string;
    reason: string;
    leaveTypeId: string;
    workingDays: number;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `leave.rejected` audit event |
| Notification Service | Notifies employee with rejection reason |
| Balance Service | Releases pending balance reservation |

#### Notification Effects

- In-app to employee: "Your [LeaveType] request has been rejected. Reason: [reason]"
- Email to employee (if enabled)

#### Audit Effects

- Creates audit record: action=`leave.rejected`, actor=approverId, target=requestId, metadata={reason}

---

### 11. LeaveCancelled

| Field | Value |
|-------|-------|
| **Producer** | Leave Service |
| **Trigger** | Employee withdraws pending request; HR cancels approved leave; or system cancels on employee deactivation |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface LeaveCancelledEvent {
  eventId: string;
  eventType: "LeaveCancelled";
  timestamp: string;
  payload: {
    organisationId: string;
    requestId: string;
    employeeId: string;
    cancelledBy: string;
    reason: string;
    previousStatus: "pending" | "approved";
    balanceRestored: number;
    cancellationType: "employee_withdrawal" | "hr_override" | "system_deactivation";
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `leave.cancelled` audit event |
| Notification Service | Notifies relevant parties based on cancellation type |
| Balance Service | Restores balance (BR-LEAVE-006) |
| Calendar Service | Removes from team leave calendar |

#### Notification Effects

- If employee withdrawal: notification to approver
- If HR override: notification to employee with reason
- If system deactivation: notification to HR confirming cancellation

#### Audit Effects

- Creates audit record: action=`leave.cancelled`, actor=cancelledBy, target=requestId, metadata={reason, balanceRestored, cancellationType}

---

### 12. AttendanceClockedIn

| Field | Value |
|-------|-------|
| **Producer** | Attendance Service |
| **Trigger** | Employee clocks in via clockIn command |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface AttendanceClockedInEvent {
  eventId: string;
  eventType: "AttendanceClockedIn";
  timestamp: string;
  payload: {
    organisationId: string;
    recordId: string;
    employeeId: string;
    clockInAt: string;
    locationType: "office" | "remote";
    date: string;              // Attendance date in org timezone
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `attendance.clocked_in` (low severity) |
| Dashboard Service | Updates "present today" count |

#### Notification Effects

- None (routine daily action; no notification noise)

#### Audit Effects

- Creates audit record: action=`attendance.clocked_in`, actor=employeeId, target=recordId, severity=low

---


### 13. AttendanceClockedOut

| Field | Value |
|-------|-------|
| **Producer** | Attendance Service |
| **Trigger** | Employee clocks out via clockOut command |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface AttendanceClockedOutEvent {
  eventId: string;
  eventType: "AttendanceClockedOut";
  timestamp: string;
  payload: {
    organisationId: string;
    recordId: string;
    employeeId: string;
    clockInAt: string;
    clockOutAt: string;
    durationMinutes: number;
    date: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `attendance.clocked_out` (low severity) |
| Dashboard Service | Updates attendance metrics |

#### Notification Effects

- None (routine action)

#### Audit Effects

- Creates audit record: action=`attendance.clocked_out`, actor=employeeId, target=recordId, severity=low

---

### 14. AttendanceCorrected

| Field | Value |
|-------|-------|
| **Producer** | Attendance Service |
| **Trigger** | HR Admin corrects an existing attendance record |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface AttendanceCorrectedEvent {
  eventId: string;
  eventType: "AttendanceCorrected";
  timestamp: string;
  payload: {
    organisationId: string;
    recordId: string;
    correctionId: string;
    employeeId: string;
    correctedBy: string;
    originalClockIn: string;
    originalClockOut: string | null;
    correctedClockIn: string;
    correctedClockOut: string | null;
    reason: string;
    newDurationMinutes: number | null;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `attendance.corrected` (elevated severity) |
| Notification Service | Notifies affected employee |

#### Notification Effects

- In-app to employee: "Your attendance record for [date] has been corrected by HR"

#### Audit Effects

- Creates audit record: action=`attendance.corrected`, actor=correctedBy, target=recordId, before={clockIn, clockOut}, after={clockIn, clockOut}, metadata={reason}, severity=elevated

---

### 15. OnboardingAssigned

| Field | Value |
|-------|-------|
| **Producer** | Onboarding Service |
| **Trigger** | HR Admin applies an onboarding template to an employee |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface OnboardingAssignedEvent {
  eventId: string;
  eventType: "OnboardingAssigned";
  timestamp: string;
  payload: {
    organisationId: string;
    onboardingId: string;
    employeeId: string;
    templateId: string;
    templateName: string;
    taskCount: number;
    assignedBy: string;
    taskAssignees: Array<{
      taskId: string;
      assigneeId: string;
      assigneeType: "employee" | "manager" | "hr";
      dueDate: string;
    }>;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `onboarding.assigned` audit event |
| Notification Service | Notifies employee and all unique task assignees |

#### Notification Effects

- In-app to employee: "An onboarding checklist has been assigned to you"
- In-app to each unique assignee: "You have [N] new onboarding tasks for [Employee Name]"
- Email to assignees (if enabled)

#### Audit Effects

- Creates audit record: action=`onboarding.assigned`, actor=assignedBy, target=employeeId, metadata={templateId, taskCount}

---


### 16. OnboardingTaskCompleted

| Field | Value |
|-------|-------|
| **Producer** | Onboarding Service |
| **Trigger** | Task assignee marks a task as complete |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface OnboardingTaskCompletedEvent {
  eventId: string;
  eventType: "OnboardingTaskCompleted";
  timestamp: string;
  payload: {
    organisationId: string;
    taskId: string;
    onboardingId: string;
    employeeId: string;
    completedBy: string;
    taskTitle: string;
    isOnboardingComplete: boolean;
    completedTasks: number;
    totalTasks: number;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `onboarding.task.completed` audit event |
| Notification Service | Notifies employee (if completed by others); notifies HR if all tasks done |
| Onboarding Service | Checks if all tasks complete → marks onboarding as completed |

#### Notification Effects

- If task completed by manager/HR (not employee): notify employee "Task '[title]' completed"
- If all tasks complete: notify HR and employee "Onboarding completed!"

#### Audit Effects

- Creates audit record: action=`onboarding.task.completed`, actor=completedBy, target=taskId, metadata={isOnboardingComplete}

---

### 17. DocumentUploaded

| Field | Value |
|-------|-------|
| **Producer** | Document Service |
| **Trigger** | HR Admin or Employee uploads a document |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface DocumentUploadedEvent {
  eventId: string;
  eventType: "DocumentUploaded";
  timestamp: string;
  payload: {
    organisationId: string;
    documentId: string;
    employeeId: string;
    categoryId: string;
    categoryName: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    expiryDate: string | null;
    uploadedBy: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `document.uploaded` audit event |
| Notification Service | Notifies employee if uploaded by HR |
| Expiry Scheduler | Schedules expiry notifications if expiryDate set |

#### Notification Effects

- If uploaded by HR for an employee: in-app to employee "A new document '[filename]' has been added to your profile"
- If self-upload: no notification

#### Audit Effects

- Creates audit record: action=`document.uploaded`, actor=uploadedBy, target=documentId, metadata={filename, category, employee}

---

### 18. DocumentExpiring

| Field | Value |
|-------|-------|
| **Producer** | Background Scheduler / Document Service |
| **Trigger** | Daily job detects documents within 30 or 7 days of expiry (BR-DOC-005) |
| **V1 Processing** | Asynchronous (background job) |

#### Payload Shape

```typescript
interface DocumentExpiringEvent {
  eventId: string;
  eventType: "DocumentExpiring";
  timestamp: string;
  payload: {
    organisationId: string;
    documentId: string;
    employeeId: string;
    filename: string;
    categoryName: string;
    expiryDate: string;
    daysRemaining: number;
    urgency: "warning" | "critical";  // 30d = warning, 7d = critical
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Notification Service | Notifies employee and HR |
| Dashboard Service | Updates "expiring documents" widget |

#### Notification Effects

- In-app to employee: "Your document '[filename]' expires in [N] days"
- In-app to HR: "Document '[filename]' for [Employee Name] expires in [N] days"
- Email to HR for critical (7-day) urgency

#### Audit Effects

- None (informational event; no data mutation)

---


### 19. PayrollApproved

| Field | Value |
|-------|-------|
| **Producer** | Payroll Service |
| **Trigger** | Owner or HR Admin approves a payroll period |
| **V1 Processing** | Synchronous |

#### Payload Shape

```typescript
interface PayrollApprovedEvent {
  eventId: string;
  eventType: "PayrollApproved";
  timestamp: string;
  payload: {
    organisationId: string;
    periodId: string;
    periodLabel: string;
    approvedBy: string;
    employeeCount: number;
    totalGrossCents: number;
    totalNetCents: number;
    currency: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `payroll.approved` (elevated severity) |
| Notification Service | Notifies Owner (if HR approved) for awareness |

#### Notification Effects

- If approved by HR Admin: in-app to Owner "Payroll for [period] has been approved"
- No employee notifications at this stage (happens on publish)

#### Audit Effects

- Creates audit record: action=`payroll.approved`, actor=approvedBy, target=periodId, metadata={employeeCount, totalGross, totalNet}, severity=elevated

---

### 20. PayslipPublished

| Field | Value |
|-------|-------|
| **Producer** | Payroll Service |
| **Trigger** | Owner or HR Admin publishes payroll, generating employee payslips |
| **V1 Processing** | Synchronous (event); Async (bulk email notifications) |

#### Payload Shape

```typescript
interface PayslipPublishedEvent {
  eventId: string;
  eventType: "PayslipPublished";
  timestamp: string;
  payload: {
    organisationId: string;
    periodId: string;
    periodLabel: string;
    publishedBy: string;
    payslips: Array<{
      payslipId: string;
      employeeId: string;
      netPayCents: number;
    }>;
    totalPayslips: number;
    currency: string;
  };
}
```

#### Consumers

| Consumer | Action |
|----------|--------|
| Audit Service | Records `payroll.published` (elevated severity) |
| Notification Service | Notifies each employee who received a payslip |
| Email Service | Sends payslip notification emails (bulk, async) |

#### Notification Effects

- In-app to each employee: "Your payslip for [period] is now available"
- Email to each employee (if enabled): payslip available notification (no amounts in email)

#### Audit Effects

- Creates audit record: action=`payroll.published`, actor=publishedBy, target=periodId, metadata={payslipCount, totalNet}, severity=elevated

---

## Event Summary Table

| # | Event | Producer | Sync/Async | Audit | Notification |
|---|-------|----------|-----------|-------|-------------|
| 1 | OrganisationCreated | Organisation Service | Sync | Yes | No |
| 2 | MemberInvited | Organisation Service | Sync + Async email | Yes | Email + In-app |
| 3 | InvitationAccepted | Auth Service | Sync | Yes | In-app |
| 4 | EmployeeCreated | Employee Service | Sync | Yes | In-app (manager) |
| 5 | EmployeeActivated | Employee Service | Sync | Yes | In-app (HR) |
| 6 | EmployeeDeactivated | Employee Service | Sync | Yes (elevated) | In-app (manager, HR) |
| 7 | ManagerAssigned | Employee Service | Sync | Yes | In-app (all parties) |
| 8 | LeaveRequested | Leave Service | Sync | Yes | In-app + Email (approver) |
| 9 | LeaveApproved | Leave Service | Sync | Yes | In-app + Email (employee) |
| 10 | LeaveRejected | Leave Service | Sync | Yes | In-app + Email (employee) |
| 11 | LeaveCancelled | Leave Service | Sync | Yes | In-app (context-dependent) |
| 12 | AttendanceClockedIn | Attendance Service | Sync | Yes (low) | No |
| 13 | AttendanceClockedOut | Attendance Service | Sync | Yes (low) | No |
| 14 | AttendanceCorrected | Attendance Service | Sync | Yes (elevated) | In-app (employee) |
| 15 | OnboardingAssigned | Onboarding Service | Sync | Yes | In-app + Email (assignees) |
| 16 | OnboardingTaskCompleted | Onboarding Service | Sync | Yes | In-app (context-dependent) |
| 17 | DocumentUploaded | Document Service | Sync | Yes | In-app (employee, if by HR) |
| 18 | DocumentExpiring | Background Scheduler | Async | No | In-app + Email (HR, employee) |
| 19 | PayrollApproved | Payroll Service | Sync | Yes (elevated) | In-app (Owner) |
| 20 | PayslipPublished | Payroll Service | Sync + Async email | Yes (elevated) | In-app + Email (all employees) |

---

## Design Notes

1. **Audit is non-negotiable:** All events except DocumentExpiring (informational) create audit records. Audit failures fail the transaction.

2. **Notification is best-effort:** Notification delivery failures are logged but do not roll back the originating business operation.

3. **Email is always async in V1:** Even for "sync" events, email sending is queued and retried independently. In-app notifications are created synchronously.

4. **Event payloads are self-contained:** Consumers receive all data they need without querying back. This enables future async migration without breaking consumers.

5. **Deduplication via eventId:** Every event carries a UUID. Consumers track processed IDs to handle at-least-once delivery safely.
