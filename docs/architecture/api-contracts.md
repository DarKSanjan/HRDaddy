# API Contracts

This document defines the major operations (commands and queries) for HR Daddy V1. Each operation specifies its actor, permission, input/output schemas, validation rules, errors, side effects, notifications, and audit requirements.

---

## Error Model

### Error Categories

| Category | HTTP Status | Code | Description |
|----------|-------------|------|-------------|
| Authentication Required | 401 | `AUTHENTICATION_REQUIRED` | No valid session |
| Permission Denied | 403 | `PERMISSION_DENIED` | Insufficient role or scope |
| Resource Not Found | 404 | `NOT_FOUND` | Resource does not exist or cross-tenant |
| Invalid State Transition | 422 | `INVALID_STATE_TRANSITION` | Action not allowed in current state |
| Validation Error | 422 | `VALIDATION_ERROR` | Input fails schema or business rules |
| Organisation Mismatch | 404 | `NOT_FOUND` | Cross-tenant access (masked as 404) |
| Conflict | 409 | `CONFLICT` | Duplicate or concurrent modification |
| Rate Limited | 429 | `RATE_LIMITED` | Too many requests |
| Storage Failure | 502 | `STORAGE_FAILURE` | File storage unavailable |
| Internal Error | 500 | `INTERNAL_ERROR` | Unexpected server error |

### Error Response Shape

```typescript
interface ErrorResponse {
  error: {
    code: string;             // e.g. "VALIDATION_ERROR"
    status: number;           // HTTP status code
    message: string;          // Human-readable description
    details?: ValidationDetail[];  // Field-level errors (validation only)
    retryable?: boolean;      // Whether client should retry
    requestId: string;        // Correlation ID for support
  };
}


interface ValidationDetail {
  field: string;              // JSON path to field
  rule: string;              // Validation rule that failed
  message: string;           // Human-readable field error
  received?: unknown;        // Value that was received (non-sensitive only)
}
```

---

## Operations

---

### 1. createOrganisation

**Actor:** Authenticated User (any)
**Permission:** None required (any authenticated user can create an organisation)

#### Input Schema

```typescript
interface CreateOrganisationInput {
  name: string;              // 2-100 chars, trimmed
  industry?: string;         // Optional, max 100 chars
  timezone: string;          // IANA timezone (e.g. "Asia/Singapore")
  currency: string;          // ISO 4217 (e.g. "SGD", "USD")
  workingDays: number[];     // 0=Sun..6=Sat, e.g. [1,2,3,4,5]
}
```

#### Output Schema

```typescript
interface CreateOrganisationOutput {
  organisation: {
    id: string;              // UUID
    name: string;
    timezone: string;
    currency: string;
    createdAt: string;       // ISO 8601
  };
  membership: {
    id: string;
    role: "owner";
    userId: string;
  };
}
```


#### Validation Rules

- `name` must be 2-100 characters after trimming
- `timezone` must be a valid IANA timezone identifier
- `currency` must be a valid ISO 4217 code
- `workingDays` must contain 1-7 unique values in range 0-6

#### Errors

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` | Invalid name, timezone, currency, or workingDays |
| `CONFLICT` | User already owns an organisation with the same name |

#### Side Effects

- Creates Organisation record with default settings
- Creates OrganisationSettings with provided values
- Creates Owner Membership for the authenticated user
- Seeds default leave types (Annual, Sick, Unpaid)

#### Notifications

- None (creator is the actor)

#### Audit

- Event: `organisation.created`
- Payload: `{ orgId, ownerId, name, timezone, currency }`
- Severity: standard

---

### 2. inviteMember

**Actor:** Owner, HR Administrator
**Permission:** `org.members.invite`

#### Input Schema

```typescript
interface InviteMemberInput {
  email: string;             // Valid email, max 255 chars
  role: "hr_admin" | "manager" | "employee";
  message?: string;          // Optional personalised message, max 500 chars
}
```


#### Output Schema

```typescript
interface InviteMemberOutput {
  invitation: {
    id: string;
    email: string;
    role: string;
    expiresAt: string;       // ISO 8601, 7 days from now
    status: "sent";
  };
}
```

#### Validation Rules

- `email` must be valid format
- `role` must be one of the allowed enum values
- HR Admin cannot invite another HR Admin (only Owner can)
- Cannot invite someone who already has an active membership in this org
- Cannot invite an email with an existing pending invitation to this org

#### Errors

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` | Invalid email or role |
| `PERMISSION_DENIED` | HR Admin attempting to invite hr_admin role |
| `CONFLICT` | Email already has active membership or pending invitation |

#### Side Effects

- Creates Invitation record with 7-day expiry (BR-AUTH-003)
- Sends invitation email with secure token link

#### Notifications

- Email sent to invitee with acceptance link
- In-app notification to Owner if HR Admin performed the invite

#### Audit

- Event: `member.invited`
- Payload: `{ orgId, email, role, inviterId }`
- Severity: standard

---

### 3. createEmployee

**Actor:** Owner, HR Administrator
**Permission:** `employee.write`

#### Input Schema

```typescript
interface CreateEmployeeInput {
  firstName: string;         // 1-100 chars
  lastName: string;          // 1-100 chars
  workEmail: string;         // Unique within org
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: string;      // ISO date
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  departmentId?: string;     // UUID, must exist in org
  jobTitleId?: string;       // UUID, must exist in org
  locationId?: string;       // UUID, must exist in org
  employmentType: string;    // e.g. "full_time", "part_time", "contract"
  startDate: string;         // ISO date
  managerId?: string;        // UUID of manager Employee record
  sendInvitation?: boolean;  // Whether to create User + send invite
}
```


#### Output Schema

```typescript
interface CreateEmployeeOutput {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    workEmail: string;
    status: "draft" | "invited";
    departmentId: string | null;
    jobTitleId: string | null;
    startDate: string;
    createdAt: string;
  };
  invitation?: {
    id: string;
    email: string;
    expiresAt: string;
  };
}
```

#### Validation Rules

- `workEmail` must be unique within the organisation (BR-EMP-002)
- `departmentId`, `jobTitleId`, `locationId` must reference existing org records
- `managerId` must be an active employee in the same org; no circular chain (BR-EMP-006)
- `startDate` cannot be more than 1 year in the past
- `employmentType` must match organisation-configured types

#### Errors

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` | Invalid fields or missing required values |
| `CONFLICT` | workEmail already exists in this organisation |
| `NOT_FOUND` | Referenced department/jobTitle/location/manager not found |

#### Side Effects

- Creates Employee record (status: draft or invited)
- Creates ReportingRelationship if managerId provided
- Optionally creates Invitation for platform access
- Allocates default leave balances based on org policies

#### Notifications

- Invitation email if `sendInvitation: true`
- In-app notification to assigned manager (if any)

#### Audit

- Event: `employee.created`
- Payload: `{ employeeId, orgId, name, workEmail, status, createdBy }`
- Severity: standard

---

### 4. updateEmployee

**Actor:** Owner, HR Administrator, Employee (own limited fields)
**Permission:** `employee.write` (admin) or `employee.personal.write` (self)


#### Input Schema

```typescript
interface UpdateEmployeeInput {
  employeeId: string;        // UUID
  // Personal fields (employee can update own)
  firstName?: string;
  lastName?: string;
  personalEmail?: string;
  phone?: string;
  address?: string;
  emergencyContact?: { name: string; phone: string; relationship: string };
  // Employment fields (admin only)
  departmentId?: string | null;
  jobTitleId?: string | null;
  locationId?: string | null;
  employmentType?: string;
}
```

#### Output Schema

```typescript
interface UpdateEmployeeOutput {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    workEmail: string;
    status: string;
    departmentId: string | null;
    jobTitleId: string | null;
    updatedAt: string;
  };
  changedFields: string[];   // List of fields that were modified
}
```

#### Validation Rules

- Employee must exist and not be archived (BR-EMP-008)
- Employee self-update limited to: firstName, lastName, personalEmail, phone, address, emergencyContact
- Employment fields (department, jobTitle, location, employmentType) require admin permission
- Referenced IDs must exist within the same organisation

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Employee does not exist or cross-tenant |
| `VALIDATION_ERROR` | Invalid field values |
| `PERMISSION_DENIED` | Employee attempting to update employment fields |
| `INVALID_STATE_TRANSITION` | Attempting to update archived employee |

#### Side Effects

- Updates Employee record
- If department or jobTitle changed, creates EmploymentHistory record with effective date
- Optimistic concurrency check (BR-DATA-004)

#### Notifications

- None for admin updates
- Notification to HR if employee updates own personal details

#### Audit

- Event: `employee.updated`
- Payload: `{ employeeId, changedFields, before, after, actorId }`
- Severity: standard (elevated if compensation-related)

---


### 5. assignManager

**Actor:** Owner, HR Administrator
**Permission:** `reporting.write`

#### Input Schema

```typescript
interface AssignManagerInput {
  employeeId: string;        // UUID of the report
  managerId: string;         // UUID of the new manager (Employee record)
}
```

#### Output Schema

```typescript
interface AssignManagerOutput {
  reportingRelationship: {
    employeeId: string;
    managerId: string;
    previousManagerId: string | null;
    effectiveDate: string;
  };
}
```

#### Validation Rules

- Both employeeId and managerId must be active employees in the same org
- managerId cannot equal employeeId (cannot be own manager)
- Must not create a circular reporting chain (BR-EMP-006)
- Manager must hold at least the Manager role in the org

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Employee or manager not found in this org |
| `VALIDATION_ERROR` | Self-assignment or circular chain detected |
| `INVALID_STATE_TRANSITION` | Employee or manager is deactivated/archived |

#### Side Effects

- Creates or updates ReportingRelationship record
- Does NOT reassign pending leave approvals (remain with original approver)

#### Notifications

- In-app notification to new manager: "X has been assigned as your direct report"
- In-app notification to employee: "Y is now your manager"
- If previous manager exists, notification: "X has been reassigned"

#### Audit

- Event: `manager.assigned`
- Payload: `{ employeeId, managerId, previousManagerId, actorId }`
- Severity: standard

---

### 6. submitLeaveRequest

**Actor:** Owner, HR Administrator, Manager, Employee
**Permission:** `leave.request.create`


#### Input Schema

```typescript
interface SubmitLeaveRequestInput {
  leaveTypeId: string;       // UUID
  startDate: string;         // ISO date
  endDate: string;           // ISO date (>= startDate)
  halfDay?: "first_half" | "second_half";  // Only if startDate === endDate
  notes?: string;            // Max 1000 chars
  attachmentIds?: string[];  // Previously uploaded file IDs
}
```

#### Output Schema

```typescript
interface SubmitLeaveRequestOutput {
  leaveRequest: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    halfDay: string | null;
    workingDays: number;     // Calculated excluding weekends/holidays
    status: "pending";
    approverId: string;      // Resolved manager or HR fallback
    createdAt: string;
  };
  balanceAfterRequest: {
    available: number;
    pending: number;
    used: number;
  };
}
```

#### Validation Rules

- Employee must be active (BR-EMP-003)
- `startDate` <= `endDate`
- `halfDay` only allowed when startDate === endDate
- No overlap with existing approved or pending requests (BR-LEAVE-001)
- Sufficient balance if leave type tracks balance (BR-LEAVE-002)
- Working days calculated excluding org weekends and holidays (BR-LEAVE-005)
- Cannot submit leave for dates entirely in the past (unless HR override)

#### Errors

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` | Invalid dates, half-day on multi-day, past dates |
| `CONFLICT` | Overlapping leave request exists |
| `VALIDATION_ERROR` | Insufficient leave balance |
| `NOT_FOUND` | Leave type not found in this org |

#### Side Effects

- Creates LeaveRequest in "pending" status
- Reserves balance (pending deduction) (BR-LEAVE-009)
- Resolves approver: direct manager or HR fallback (BR-LEAVE-010)

#### Notifications

- In-app notification to approver: "X has requested Y leave (dates)"
- Email to approver (if email notifications enabled)

#### Audit

- Event: `leave.requested`
- Payload: `{ requestId, employeeId, leaveTypeId, days, approverId }`
- Severity: standard

---

### 7. approveLeaveRequest

**Actor:** Owner, HR Administrator, Manager (scoped)
**Permission:** `leave.request.approve`


#### Input Schema

```typescript
interface ApproveLeaveRequestInput {
  requestId: string;         // UUID
  comment?: string;          // Optional approval comment, max 500 chars
}
```

#### Output Schema

```typescript
interface ApproveLeaveRequestOutput {
  leaveRequest: {
    id: string;
    status: "approved";
    approverId: string;
    approvedAt: string;
    comment: string | null;
  };
  balanceUpdate: {
    leaveTypeId: string;
    previousBalance: number;
    newBalance: number;
    deducted: number;
  };
}
```

#### Validation Rules

- Request must be in "pending" status
- Approver must be the assigned approver (manager) or Owner/HR Admin
- Manager can only approve direct reports' requests (BR-LEAVE-004)
- Cannot approve own leave request (self-approval prevention)
- Optimistic concurrency check (BR-DATA-004)

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Request not found in this org |
| `INVALID_STATE_TRANSITION` | Request not in pending status |
| `PERMISSION_DENIED` | Not the assigned approver or insufficient scope |
| `VALIDATION_ERROR` | Attempting self-approval |
| `CONFLICT` | Concurrent modification (already approved/rejected) |

#### Side Effects

- Transitions request to "approved"
- Confirms balance deduction (moves from pending to used) (BR-LEAVE-003)
- Creates LeaveApproval record

#### Notifications

- In-app notification to employee: "Your leave request has been approved"
- Email to employee (if enabled)

#### Audit

- Event: `leave.approved`
- Payload: `{ requestId, approverId, employeeId, days, balanceDeducted }`
- Severity: standard

---

### 8. rejectLeaveRequest

**Actor:** Owner, HR Administrator, Manager (scoped)
**Permission:** `leave.request.reject`

#### Input Schema

```typescript
interface RejectLeaveRequestInput {
  requestId: string;         // UUID
  reason: string;            // Required, 1-1000 chars
}
```


#### Output Schema

```typescript
interface RejectLeaveRequestOutput {
  leaveRequest: {
    id: string;
    status: "rejected";
    approverId: string;
    rejectedAt: string;
    reason: string;
  };
  balanceUpdate: {
    leaveTypeId: string;
    previousBalance: number;
    restoredBalance: number;  // Pending reservation released
  };
}
```

#### Validation Rules

- Request must be in "pending" status
- `reason` is mandatory and non-empty
- Approver must be the assigned approver or Owner/HR Admin
- Manager can only reject direct reports' requests (BR-LEAVE-004)
- Cannot reject own leave request

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Request not found in this org |
| `INVALID_STATE_TRANSITION` | Request not in pending status |
| `PERMISSION_DENIED` | Not the assigned approver or insufficient scope |
| `VALIDATION_ERROR` | Missing reason |
| `CONFLICT` | Concurrent modification |

#### Side Effects

- Transitions request to "rejected"
- Releases pending balance reservation (BR-LEAVE-009 reversal)
- Creates LeaveApproval record with rejection reason

#### Notifications

- In-app notification to employee: "Your leave request has been rejected" with reason
- Email to employee (if enabled)

#### Audit

- Event: `leave.rejected`
- Payload: `{ requestId, approverId, employeeId, reason }`
- Severity: standard

---

### 9. clockIn

**Actor:** Owner, HR Administrator, Manager, Employee
**Permission:** `attendance.clock`

#### Input Schema

```typescript
interface ClockInInput {
  locationType?: "office" | "remote";  // Default: "office"
  notes?: string;            // Optional, max 200 chars
}
```

#### Output Schema

```typescript
interface ClockInOutput {
  attendanceRecord: {
    id: string;
    employeeId: string;
    clockInAt: string;       // ISO 8601 with timezone
    locationType: string;
    status: "clocked_in";
    date: string;            // Attendance date (org timezone)
  };
}
```


#### Validation Rules

- Employee must be active
- No open attendance session exists for this employee (BR-ATT-001)
- Employee must not have approved full-day leave for today (BR-ATT-008)
- Today must not be a configured holiday for the org (BR-ATT-008)
- Timestamp stored in UTC, date derived from org timezone (BR-ATT-002)

#### Errors

| Code | Condition |
|------|-----------|
| `CONFLICT` | Already clocked in (open session exists) |
| `VALIDATION_ERROR` | On approved full-day leave or holiday |
| `INVALID_STATE_TRANSITION` | Employee not active |

#### Side Effects

- Creates AttendanceRecord with clockInAt timestamp
- Session marked as open (clockOutAt is null)
- Overnight sessions assigned to clock-in date (BR-ATT-007)

#### Notifications

- None

#### Audit

- Event: `attendance.clocked_in`
- Payload: `{ recordId, employeeId, clockInAt, locationType }`
- Severity: low

---

### 10. clockOut

**Actor:** Owner, HR Administrator, Manager, Employee
**Permission:** `attendance.clock`

#### Input Schema

```typescript
interface ClockOutInput {
  notes?: string;            // Optional, max 200 chars
}
```

#### Output Schema

```typescript
interface ClockOutOutput {
  attendanceRecord: {
    id: string;
    employeeId: string;
    clockInAt: string;
    clockOutAt: string;
    durationMinutes: number; // Auto-calculated (BR-ATT-009)
    status: "clocked_out";
    date: string;
  };
}
```

#### Validation Rules

- Employee must have an open session (clocked in, not yet out) (BR-ATT-006)
- Duration auto-calculated from clock-in to clock-out (BR-ATT-009)

#### Errors

| Code | Condition |
|------|-----------|
| `INVALID_STATE_TRANSITION` | No open session (not clocked in) |

#### Side Effects

- Updates AttendanceRecord with clockOutAt timestamp
- Calculates and stores duration
- Session marked as closed

#### Notifications

- None

#### Audit

- Event: `attendance.clocked_out`
- Payload: `{ recordId, employeeId, clockOutAt, durationMinutes }`
- Severity: low

---


### 11. correctAttendance

**Actor:** Owner, HR Administrator
**Permission:** `attendance.correct`

#### Input Schema

```typescript
interface CorrectAttendanceInput {
  recordId: string;          // UUID of the attendance record to correct
  clockInAt?: string;        // New clock-in time (ISO 8601)
  clockOutAt?: string;       // New clock-out time (ISO 8601)
  reason: string;            // Mandatory explanation, 5-500 chars
}
```

#### Output Schema

```typescript
interface CorrectAttendanceOutput {
  correction: {
    id: string;
    recordId: string;
    originalClockIn: string;
    originalClockOut: string | null;
    correctedClockIn: string;
    correctedClockOut: string | null;
    durationMinutes: number | null;
    reason: string;
    correctedBy: string;     // User ID of HR
    correctedAt: string;
  };
}
```

#### Validation Rules

- Record must exist in this organisation
- `reason` is mandatory and min 5 characters (BR-ATT-003)
- Corrected clockOutAt must be after corrected clockInAt
- Record must be within configurable correction window (default 30 days)
- Only Owner or HR Administrator may correct (BR-ATT-004)
- Duration is recalculated automatically (BR-ATT-009)

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Record does not exist in this org |
| `VALIDATION_ERROR` | Missing or too-short reason; invalid time range |
| `PERMISSION_DENIED` | Not Owner/HR Admin |
| `INVALID_STATE_TRANSITION` | Record outside correction window |

#### Side Effects

- Preserves original record values
- Creates linked AttendanceCorrection record
- Recalculates duration from corrected timestamps

#### Notifications

- In-app notification to affected employee: "Your attendance for [date] has been corrected"

#### Audit

- Event: `attendance.corrected`
- Payload: `{ recordId, originalValues, correctedValues, reason, hrId }`
- Severity: elevated

---

### 12. applyOnboardingTemplate

**Actor:** Owner, HR Administrator
**Permission:** `onboarding.assign`


#### Input Schema

```typescript
interface ApplyOnboardingTemplateInput {
  employeeId: string;        // UUID
  templateId: string;        // UUID
  startDate?: string;        // Override joining date for due-date calc (ISO date)
}
```

#### Output Schema

```typescript
interface ApplyOnboardingTemplateOutput {
  onboarding: {
    id: string;
    employeeId: string;
    templateId: string;
    templateName: string;
    status: "in_progress";
    taskCount: number;
    createdAt: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    assigneeType: "employee" | "manager" | "hr";
    assigneeId: string | null;
    dueDate: string;
    status: "pending";
  }>;
}
```

#### Validation Rules

- Employee must be in active or invited state
- Template must exist and not be archived in this org
- Employee must not have an existing active onboarding (BR-ONB-006)
- Due dates are calculated relative to employee startDate or override (BR-ONB-002)
- Template tasks are snapshot-copied (BR-ONB-001)

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Employee or template not found in org |
| `CONFLICT` | Employee already has active onboarding |
| `INVALID_STATE_TRANSITION` | Employee is deactivated/archived |

#### Side Effects

- Creates EmployeeOnboarding instance
- Copies template tasks as EmployeeOnboardingTask records
- Calculates due dates from start date + relative day offsets
- Resolves task assignees (employee, their manager, or org HR)

#### Notifications

- In-app notification to employee: "Onboarding checklist assigned"
- In-app notification to each unique task assignee
- Email to assignees (if enabled)

#### Audit

- Event: `onboarding.assigned`
- Payload: `{ onboardingId, employeeId, templateId, taskCount, assignedBy }`
- Severity: standard

---

### 13. completeOnboardingTask

**Actor:** Owner, HR Administrator, Manager (scoped), Employee (own tasks)
**Permission:** `onboarding.task.complete.own` or `onboarding.task.complete.assigned`


#### Input Schema

```typescript
interface CompleteOnboardingTaskInput {
  taskId: string;            // UUID
  notes?: string;            // Completion notes, max 500 chars
}
```

#### Output Schema

```typescript
interface CompleteOnboardingTaskOutput {
  task: {
    id: string;
    title: string;
    status: "completed";
    completedAt: string;
    completedBy: string;
    notes: string | null;
  };
  onboardingProgress: {
    totalTasks: number;
    completedTasks: number;
    isFullyComplete: boolean;
  };
}
```

#### Validation Rules

- Task must be in "pending" or "in_progress" state
- Actor must be the assigned task owner or HR/Owner (BR-ONB-003)
- Manager can complete tasks where onboarded employee is their direct report

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Task not found in this org |
| `INVALID_STATE_TRANSITION` | Task already completed or cancelled |
| `PERMISSION_DENIED` | Actor is not the task assignee or authorised |

#### Side Effects

- Marks task as "completed" with timestamp
- If all tasks now complete, marks onboarding as "completed"
- Triggers OnboardingCompleted event if fully done

#### Notifications

- If onboarding fully complete: notification to HR and employee
- If task completed by someone other than employee: notification to employee

#### Audit

- Event: `onboarding.task.completed`
- Payload: `{ taskId, onboardingId, completedBy, isFullyComplete }`
- Severity: standard

---

### 14. uploadDocument

**Actor:** Owner, HR Administrator, Employee (own, non-sensitive categories)
**Permission:** `document.upload`

#### Input Schema

```typescript
interface UploadDocumentInput {
  employeeId: string;        // UUID (self or any for admin)
  categoryId: string;        // UUID of DocumentCategory
  file: File;                // Multipart upload
  description?: string;      // Max 500 chars
  expiryDate?: string;       // ISO date (optional)
}
```


#### Output Schema

```typescript
interface UploadDocumentOutput {
  document: {
    id: string;
    employeeId: string;
    categoryId: string;
    categoryName: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    description: string | null;
    expiryDate: string | null;
    uploadedAt: string;
    uploadedBy: string;
  };
}
```

#### Validation Rules

- File type must be allowed: PDF, JPEG, PNG, DOCX, XLSX (validated by magic bytes, not extension) (BR-DOC-001)
- File size must not exceed 10MB (BR-DOC-002)
- Employee must exist in this org (not archived)
- Category must exist and not be archived
- Employee (self-upload) restricted to non-sensitive categories (BR-DOC-004)
- Storage path includes org ID for tenant isolation (BR-DOC-003)

#### Errors

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` | Invalid file type (magic byte mismatch) |
| `VALIDATION_ERROR` | File exceeds 10MB size limit |
| `NOT_FOUND` | Employee or category not found in this org |
| `PERMISSION_DENIED` | Employee uploading to sensitive category |
| `STORAGE_FAILURE` | Object storage unavailable |

#### Side Effects

- Uploads file to tenant-scoped object storage
- Creates EmployeeDocument metadata record
- If upload succeeds but DB write fails, compensating action removes storage object (BR-DOC-007)
- Schedules expiry notification if expiryDate provided (BR-DOC-005)

#### Notifications

- Notification to employee if uploaded by HR: "A new document has been added to your profile"

#### Audit

- Event: `document.uploaded`
- Payload: `{ documentId, employeeId, categoryId, filename, uploadedBy }`
- Severity: standard

---

### 15. publishPayroll

**Actor:** Owner, HR Administrator
**Permission:** `payroll.publish`

#### Input Schema

```typescript
interface PublishPayrollInput {
  periodId: string;          // UUID of PayrollPeriod
}
```

#### Output Schema

```typescript
interface PublishPayrollOutput {
  period: {
    id: string;
    label: string;
    status: "published";
    publishedAt: string;
    publishedBy: string;
  };
  payslips: {
    generated: number;       // Count of payslips created
    employees: string[];     // Employee IDs who received payslips
  };
}
```


#### Validation Rules

- Period must be in "approved" state (BR-PAY-004)
- All records must have valid net pay calculations (BR-PAY-005)
- Only active employees can have payslips generated (BR-PAY-006)
- Published payslips become immutable (BR-PAY-002)

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Period not found in this org |
| `INVALID_STATE_TRANSITION` | Period not in approved state |
| `VALIDATION_ERROR` | Records with invalid calculations exist |
| `PERMISSION_DENIED` | Insufficient role |

#### Side Effects

- Generates individual Payslip records for each employee with a PayrollRecord
- Transitions period status to "published"
- Payslips are now accessible to employees via self-service
- All values stored in integer cents (BR-PAY-001)

#### Notifications

- In-app notification to each employee with a payslip: "Your payslip for [period] is available"
- Email to each employee (if enabled)

#### Audit

- Event: `payroll.published`
- Payload: `{ periodId, publishedBy, payslipCount, totalGross, totalNet }`
- Severity: elevated

---

### 16. markNotificationRead

**Actor:** Owner, HR Administrator, Manager, Employee
**Permission:** `notification.mark_read`

#### Input Schema

```typescript
interface MarkNotificationReadInput {
  notificationId?: string;   // UUID — mark single. Omit for mark-all.
  markAll?: boolean;         // If true, marks all unread notifications as read
}
```

#### Output Schema

```typescript
interface MarkNotificationReadOutput {
  updated: number;           // Count of notifications marked as read
}
```

#### Validation Rules

- If `notificationId` provided, it must belong to the current user (BR-NOTIF-004)
- If `markAll: true`, operates on all unread notifications for current user in current org
- User can only mark their own notifications

#### Errors

| Code | Condition |
|------|-----------|
| `NOT_FOUND` | Notification not found or belongs to another user |
| `PERMISSION_DENIED` | Attempting to mark another user's notification |

#### Side Effects

- Sets `readAt` timestamp on notification(s)
- Updates unread count cache

#### Notifications

- None (meta-operation on notifications themselves)

#### Audit

- None (read-status changes are not audited)

---

## Common Patterns

### Transaction Boundaries

All operations that modify multiple records use database transactions. If any step fails, the entire operation rolls back:

- `createOrganisation`: org + settings + membership
- `createEmployee`: employee + reporting relationship + invitation
- `approveLeaveRequest`: request status + balance update
- `applyOnboardingTemplate`: onboarding + all tasks
- `publishPayroll`: period status + all payslips

### Idempotency

Operations that are naturally idempotent:
- `markNotificationRead` (re-marking already-read is a no-op)
- `clockIn` returns existing session if already clocked in (after 409 error)

Operations with idempotency keys (for retry safety):
- `submitLeaveRequest` — overlap check prevents duplicates
- `uploadDocument` — unique constraint on (employeeId, categoryId, filename, uploadedAt)

### Rate Limiting

| Endpoint Category | Limit |
|------------------|-------|
| Authentication | 5 attempts per 15 min per IP |
| Write operations | 60 per minute per user |
| Read operations | 120 per minute per user |
| File uploads | 10 per minute per user |
| Exports | 3 per hour per user |
