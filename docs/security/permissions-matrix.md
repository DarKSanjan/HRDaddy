# Permissions Matrix

## Overview

This document defines the complete role-based access control (RBAC) model for HR Daddy V1. Every permission is explicitly keyed, scoped, and enforceable server-side. No permission check relies solely on client-side logic.

## Roles

| Role | Description | Assignment |
|------|-------------|------------|
| **Owner** | Organisation creator or transferred owner. Full control. One per organisation. | Created on org creation or via `org.ownership.transfer` |
| **HR Administrator** | Manages employee lifecycle, policies, payroll, documents. No org-level ownership. | Assigned by Owner |
| **Manager** | Manages direct reports. Approves leave. Views team data. | Assigned by Owner or HR Admin |
| **Employee** | Self-service access to own data. Submits requests. | Default role on employee creation |
| **System Administrator** | *(Future)* Platform-level ops role. No org data access. | N/A for V1 |

## Scope Definitions

- **Organisation-wide**: Permission applies to all records within the organisation.
- **Scoped (team)**: Permission applies only to direct reports in the reporting chain.
- **Scoped (own)**: Permission applies only to the authenticated user's own records.
- **Conditional**: Permission requires additional runtime checks beyond role membership.

## Legend

- ✓ = Granted unconditionally
- S = Scoped (team/reporting chain only)
- O = Own records only
- ✗ = Denied
- C = Conditional (see conditions column)

---

## Summary Matrix


| Permission Key | Owner | HR Admin | Manager | Employee |
|---|---|---|---|---|
| **Organisation Management** | | | | |
| org.settings.read | ✓ | ✓ | ✗ | ✗ |
| org.settings.write | ✓ | ✗ | ✗ | ✗ |
| org.members.read | ✓ | ✓ | ✗ | ✗ |
| org.members.invite | ✓ | ✓ | ✗ | ✗ |
| org.members.role.change | ✓ | ✗ | ✗ | ✗ |
| org.members.remove | ✓ | C | ✗ | ✗ |
| org.ownership.transfer | ✓ | ✗ | ✗ | ✗ |
| org.branding.write | ✓ | ✓ | ✗ | ✗ |
| **Employee Management** | | | | |
| employee.read | ✓ | ✓ | S | ✓ |
| employee.read.full | ✓ | ✓ | S | O |
| employee.write | ✓ | ✓ | ✗ | ✗ |
| employee.personal.read | ✓ | ✓ | S | O |
| employee.personal.write | ✓ | ✓ | ✗ | O |
| employee.employment.read | ✓ | ✓ | S | O |
| employee.employment.write | ✓ | ✓ | ✗ | ✗ |
| employee.compensation.read | ✓ | ✓ | ✗ | O |
| employee.compensation.write | ✓ | ✓ | ✗ | ✗ |
| employee.status.change | ✓ | ✓ | ✗ | ✗ |
| employee.sensitive.read | ✓ | C | ✗ | O |
| employee.deactivate | ✓ | ✓ | ✗ | ✗ |
| employee.archive | ✓ | ✓ | ✗ | ✗ |
| **Department & Structure** | | | | |
| department.read | ✓ | ✓ | ✓ | ✓ |
| department.write | ✓ | ✓ | ✗ | ✗ |
| department.archive | ✓ | ✓ | ✗ | ✗ |
| job_title.read | ✓ | ✓ | ✓ | ✓ |
| job_title.write | ✓ | ✓ | ✗ | ✗ |
| location.read | ✓ | ✓ | ✓ | ✓ |
| location.write | ✓ | ✓ | ✗ | ✗ |
| reporting.read | ✓ | ✓ | S | O |
| reporting.write | ✓ | ✓ | ✗ | ✗ |

| **Leave Management** | | | | |
| leave.type.read | ✓ | ✓ | ✓ | ✓ |
| leave.type.write | ✓ | ✓ | ✗ | ✗ |
| leave.policy.read | ✓ | ✓ | ✓ | ✓ |
| leave.policy.write | ✓ | ✓ | ✗ | ✗ |
| leave.balance.read.own | ✓ | ✓ | ✓ | ✓ |
| leave.balance.read.team | ✓ | ✓ | S | ✗ |
| leave.balance.read.all | ✓ | ✓ | ✗ | ✗ |
| leave.request.create | ✓ | ✓ | ✓ | ✓ |
| leave.request.read.own | ✓ | ✓ | ✓ | ✓ |
| leave.request.read.team | ✓ | ✓ | S | ✗ |
| leave.request.read.all | ✓ | ✓ | ✗ | ✗ |
| leave.request.approve | ✓ | ✓ | S | ✗ |
| leave.request.reject | ✓ | ✓ | S | ✗ |
| leave.request.override | ✓ | ✓ | ✗ | ✗ |
| leave.calendar.read.team | ✓ | ✓ | S | ✗ |
| leave.calendar.read.all | ✓ | ✓ | ✗ | ✗ |
| **Attendance** | | | | |
| attendance.clock | ✓ | ✓ | ✓ | ✓ |
| attendance.read.own | ✓ | ✓ | ✓ | ✓ |
| attendance.read.team | ✓ | ✓ | S | ✗ |
| attendance.read.all | ✓ | ✓ | ✗ | ✗ |
| attendance.correct | ✓ | ✓ | ✗ | ✗ |
| attendance.manual.add | ✓ | ✓ | ✗ | ✗ |
| attendance.export | ✓ | ✓ | S | ✗ |
| **Onboarding** | | | | |
| onboarding.template.read | ✓ | ✓ | ✓ | ✗ |
| onboarding.template.write | ✓ | ✓ | ✗ | ✗ |
| onboarding.assign | ✓ | ✓ | ✗ | ✗ |
| onboarding.task.read.own | ✓ | ✓ | ✓ | ✓ |
| onboarding.task.read.all | ✓ | ✓ | ✗ | ✗ |
| onboarding.task.complete.own | ✓ | ✓ | ✓ | ✓ |
| onboarding.task.complete.assigned | ✓ | ✓ | S | ✗ |
| onboarding.cancel | ✓ | ✓ | ✗ | ✗ |

| **Documents** | | | | |
| document.category.read | ✓ | ✓ | ✓ | ✓ |
| document.category.write | ✓ | ✓ | ✗ | ✗ |
| document.upload | ✓ | ✓ | ✗ | O |
| document.read.own | ✓ | ✓ | ✓ | ✓ |
| document.read.all | ✓ | ✓ | ✗ | ✗ |
| document.read.sensitive | ✓ | C | ✗ | ✗ |
| document.download | ✓ | ✓ | S | O |
| document.replace | ✓ | ✓ | ✗ | ✗ |
| document.archive | ✓ | ✓ | ✗ | ✗ |
| document.delete | ✓ | C | ✗ | ✗ |
| **Payroll** | | | | |
| payroll.period.read | ✓ | ✓ | ✗ | ✗ |
| payroll.period.write | ✓ | ✓ | ✗ | ✗ |
| payroll.record.read | ✓ | ✓ | ✗ | ✗ |
| payroll.record.write | ✓ | ✓ | ✗ | ✗ |
| payroll.approve | ✓ | C | ✗ | ✗ |
| payroll.publish | ✓ | ✓ | ✗ | ✗ |
| payslip.read.own | ✓ | ✓ | ✓ | ✓ |
| **Notifications** | | | | |
| notification.read.own | ✓ | ✓ | ✓ | ✓ |
| notification.mark_read | ✓ | ✓ | ✓ | ✓ |
| **Audit** | | | | |
| audit.read | ✓ | ✓ | ✗ | ✗ |
| audit.export | ✓ | C | ✗ | ✗ |
| **Dashboard** | | | | |
| dashboard.admin | ✓ | ✓ | ✗ | ✗ |
| dashboard.manager | ✓ | ✓ | ✓ | ✗ |
| dashboard.employee | ✓ | ✓ | ✓ | ✓ |

---


## Detailed Permission Definitions

---

## Organisation Management

### org.settings.read
- **Description:** View organisation settings including timezone, currency, working days, working hours, date format, leave year configuration, and general preferences.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None. Any member with the role can read.
- **Sensitive fields:** None
- **Server-side enforcement:** Permission middleware validates role before loading settings from `OrganisationSetting` table. Tenant ID derived from session.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view organisation settings."

### org.settings.write
- **Description:** Modify organisation settings including timezone, currency, working days, working hours, date format, leave year start, and policy defaults.
- **Allowed roles:** Owner
- **Scope:** Organisation-wide
- **Conditions:** None. Only Owner can modify.
- **Sensitive fields:** None (but changes affect all employees)
- **Server-side enforcement:** Permission service checks `role === 'owner'` before executing mutation. All changes create an audit event.
- **Denial behaviour:** 403 Forbidden — "Only the organisation owner can modify settings."

### org.members.read
- **Description:** View list of organisation members (users with platform accounts linked to this org), their roles, and invitation status.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None
- **Sensitive fields:** Email addresses are visible only to Owner and HR Admin.
- **Server-side enforcement:** Query scoped to `organisation_id` from session. Role check in permission middleware.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view organisation members."


### org.members.invite
- **Description:** Send an invitation to a new user to join the organisation with a specified role.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** HR Admin can invite Managers and Employees only. Owner can invite any role including HR Admin.
- **Sensitive fields:** None
- **Server-side enforcement:** Permission service validates the inviter's role against the target role. HR Admin attempting to invite another HR Admin is denied. Creates audit event and sends invitation email.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to invite members with this role."

### org.members.role.change
- **Description:** Change the role of an existing organisation member (e.g., promote Employee to Manager, or Manager to HR Admin).
- **Allowed roles:** Owner
- **Scope:** Organisation-wide
- **Conditions:** Cannot change own role. Cannot demote self from Owner (use `org.ownership.transfer` instead).
- **Sensitive fields:** None
- **Server-side enforcement:** Validates `role === 'owner'` and `target_user_id !== current_user_id`. Creates audit event with old and new role.
- **Denial behaviour:** 403 Forbidden — "Only the organisation owner can change member roles."

### org.members.remove
- **Description:** Remove a member from the organisation, revoking their access immediately.
- **Allowed roles:** Owner, HR Administrator (conditional)
- **Scope:** Organisation-wide
- **Conditions:** HR Admin can only remove Employees and Managers. Owner can remove any non-Owner member. No one can remove the Owner. Removing a member does not delete their employee record (if one exists).
- **Sensitive fields:** None
- **Server-side enforcement:** Validates role hierarchy. Checks target is not the Owner. Invalidates target's session for this organisation. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to remove this member." / "The organisation owner cannot be removed."

### org.ownership.transfer
- **Description:** Transfer organisation ownership to another existing member. The current owner becomes HR Administrator after transfer.
- **Allowed roles:** Owner
- **Scope:** Organisation-wide
- **Conditions:** Target must be an active member of the organisation. Requires confirmation step (e.g., re-authentication or confirmation token). Irreversible without the new owner's cooperation.
- **Sensitive fields:** None
- **Server-side enforcement:** Validates current user is Owner. Validates target is active member. Executes in a transaction: update target role to Owner, update current user role to HR Admin. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "Only the current owner can transfer ownership."

### org.branding.write
- **Description:** Update organisation branding including logo, colour scheme, and display name shown in the application header.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None
- **Sensitive fields:** None
- **Server-side enforcement:** Role check for Owner or HR Admin. File upload validation (type, size). Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to modify organisation branding."

---

## Employee Management


### employee.read
- **Description:** View the employee directory listing — names, job titles, departments, and profile photos. This is a non-sensitive summary view.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped), Employee
- **Scope:** Organisation-wide for Owner/HR Admin/Employee. Manager sees all employees but full profile access is scoped.
- **Conditions:** Employee role sees limited directory fields (name, title, department, photo, work email, work phone). Deactivated/archived employees hidden from Employee role unless explicitly searching.
- **Sensitive fields:** None in directory view.
- **Server-side enforcement:** Query scoped to `organisation_id`. Response filtered based on role to exclude sensitive columns. Deactivated filter applied for Employee role.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view the employee directory."

### employee.read.full
- **Description:** View a complete employee profile including personal details, employment history, department, reporting chain, and status.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped to direct reports), Employee (own profile only)
- **Scope:** Organisation-wide for Owner/HR Admin. Manager: direct reports only. Employee: own record only.
- **Conditions:** Manager must have an active reporting relationship with the target employee. Employee can only access own record. Compensation and sensitive fields excluded (require separate permissions).
- **Sensitive fields:** Compensation fields excluded. National ID excluded. Bank details excluded. These require `employee.compensation.read` or `employee.sensitive.read`.
- **Server-side enforcement:** Permission service checks role + scope. For Manager, validates `reporting_relationship` table. For Employee, validates `employee_id` matches session user's linked employee.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view this employee's profile."

### employee.write
- **Description:** Create a new employee record or edit an existing employee's core fields (name, contact, department assignment, job title, location, employment type).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Creating an employee does not automatically create a login account. A separate invitation is required for platform access. Employee number must be unique within the organisation.
- **Sensitive fields:** National ID and bank details are NOT set via this permission — they require `employee.sensitive.read` + dedicated write endpoints.
- **Server-side enforcement:** Permission check for Owner/HR Admin. Input validation via schema. Uniqueness check on employee number. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to create or edit employees."

### employee.personal.read
- **Description:** Read an employee's personal details: date of birth, gender, personal email, personal phone, emergency contacts, address.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped), Employee (own)
- **Scope:** Organisation-wide for Owner/HR Admin. Manager: direct reports. Employee: own.
- **Conditions:** Manager access is limited to basic personal details (emergency contact, personal phone). Full personal details (address, DOB) available only to Owner/HR Admin and the employee themselves.
- **Sensitive fields:** Date of birth, full address, gender — accessible to Owner, HR Admin, and self only. Manager sees emergency contact and personal phone only.
- **Server-side enforcement:** Role + scope check. Field-level filtering based on role. Manager gets a reduced field set.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view this employee's personal details."


### employee.personal.write
- **Description:** Update an employee's personal details: date of birth, gender, personal email, personal phone, emergency contacts, address.
- **Allowed roles:** Owner, HR Administrator, Employee (own record only)
- **Scope:** Organisation-wide for Owner/HR Admin. Employee: own record only.
- **Conditions:** Employee can update their own personal phone, emergency contacts, and address. DOB and gender changes by employee require HR approval workflow (V2 — in V1, only HR/Owner can change these). All changes create audit events.
- **Sensitive fields:** All fields in this category are personal data. Changes logged.
- **Server-side enforcement:** Role check. For Employee, validates target is self. Validates schema. Creates audit event with changed fields (old → new values stored in audit).
- **Denial behaviour:** 403 Forbidden — "You do not have permission to modify this employee's personal details."

### employee.employment.read
- **Description:** View employment details: start date, employment type, probation status, contract details, department history, job title history, and current status.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped), Employee (own)
- **Scope:** Organisation-wide for Owner/HR Admin. Manager: direct reports. Employee: own.
- **Conditions:** None beyond scope.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role + scope check. Manager validated against reporting chain.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view this employee's employment details."

### employee.employment.write
- **Description:** Modify employment details: change employment type, update probation end date, reassign department, change job title, update work location.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Changing department or job title creates a history record (effective date tracking). Cannot modify employment details of archived employees.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check for Owner/HR Admin. Status check (not archived). Creates audit event. Updates history tables.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to modify employment details."

### employee.compensation.read
- **Description:** View compensation details: base salary, pay frequency, currency, allowances, and compensation history.
- **Allowed roles:** Owner, HR Administrator, Employee (own only)
- **Scope:** Organisation-wide for Owner/HR Admin. Employee: own record only.
- **Conditions:** Manager explicitly does NOT have access to compensation data. This is a deliberate design decision.
- **Sensitive fields:** All fields in this permission group are sensitive. Salary, allowances, and pay details.
- **Server-side enforcement:** Strict role check. No Manager access. Employee validated to be accessing own record only. Access logged to audit trail.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view compensation details."

### employee.compensation.write
- **Description:** Create or modify compensation records: set salary, update allowances, change pay frequency, record pay raises.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** All changes create a compensation history record with effective date. Previous compensation records are immutable (append-only pattern). Cannot modify for archived employees.
- **Sensitive fields:** All.
- **Server-side enforcement:** Owner/HR Admin role check. Append-only enforcement (previous records never updated). Creates audit event with details.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to modify compensation details."


### employee.status.change
- **Description:** Change an employee's employment status (e.g., from probation to confirmed, or active to suspended).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Valid state transitions only (defined in employee lifecycle state machine). Cannot transition archived employees. Suspension requires a reason.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. State machine validation — rejects invalid transitions. Reason required for suspension. Creates audit event. May trigger notifications.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to change employee status." / 422 Unprocessable — "Invalid status transition from {current} to {target}."

### employee.sensitive.read
- **Description:** View highly sensitive employee data: national ID / tax ID numbers, bank account details, passport numbers.
- **Allowed roles:** Owner, HR Administrator (conditional), Employee (own only)
- **Scope:** Organisation-wide for Owner. HR Admin: conditional. Employee: own.
- **Conditions:** HR Admin access may be restricted by Owner configuration (org setting `hr_admin_sensitive_access`). When disabled, only Owner can view. Employee can always see their own sensitive data. All access logged.
- **Sensitive fields:** National ID, tax ID, passport number, bank account number, bank sort code / routing number.
- **Server-side enforcement:** Role check + org setting check for HR Admin. Every access creates an audit event (not just modifications). Values encrypted at rest.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view sensitive employee data."

### employee.deactivate
- **Description:** Deactivate an employee, revoking their login access and marking them as inactive. Does not delete records.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Cannot deactivate the Owner's own employee record. Deactivation invalidates active sessions. Pending leave requests are automatically cancelled. Active onboarding is cancelled. Employee record remains for historical reference.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Prevents self-deactivation of Owner. Executes side effects in transaction (session invalidation, leave cancellation). Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to deactivate employees." / 422 — "Cannot deactivate the organisation owner."

### employee.archive
- **Description:** Archive an employee record. Archived employees are hidden from directory and reports by default but data is retained for compliance.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Employee must be in 'deactivated' state before archiving. Archived employees cannot be reactivated (must be un-archived first). Archiving is soft — no data deletion.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. State check (must be deactivated). Sets `archived_at` timestamp. Creates audit event. Excluded from default queries.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to archive employees." / 422 — "Employee must be deactivated before archiving."

---

## Department & Structure


### department.read
- **Description:** View the list of departments, their names, descriptions, managers, and employee counts.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Organisation-wide (all roles can see department structure)
- **Conditions:** None. Department structure is non-sensitive organisational information.
- **Sensitive fields:** None.
- **Server-side enforcement:** Scoped to `organisation_id` from session. No role restriction beyond authenticated membership.
- **Denial behaviour:** 401 Unauthorized — "Authentication required." (Only unauthenticated users are denied.)

### department.write
- **Description:** Create a new department or edit an existing department's name, description, parent department, or assigned manager.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Department names must be unique within the organisation. Assigning a manager validates the target is an active employee with Manager role.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Uniqueness validation. Manager validation. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to create or modify departments."

### department.archive
- **Description:** Archive a department, hiding it from active lists. Employees in the department must be reassigned first.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Cannot archive a department that still has active employees assigned. System validates employee count before allowing archive.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Employee count validation. Sets `archived_at`. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to archive departments." / 422 — "Cannot archive department with active employees. Reassign employees first."

### job_title.read
- **Description:** View the list of job titles available in the organisation.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Organisation-wide
- **Conditions:** None. Job titles are non-sensitive reference data.
- **Sensitive fields:** None.
- **Server-side enforcement:** Scoped to `organisation_id`. No role restriction beyond membership.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### job_title.write
- **Description:** Create a new job title or edit/archive an existing one.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Job title names must be unique within the organisation. Cannot delete a job title assigned to active employees (archive instead).
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Uniqueness validation. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage job titles."

### location.read
- **Description:** View the list of work locations (offices, remote designations, sites).
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Organisation-wide
- **Conditions:** None. Locations are non-sensitive reference data.
- **Sensitive fields:** None.
- **Server-side enforcement:** Scoped to `organisation_id`. No role restriction.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### location.write
- **Description:** Create, edit, or archive a work location.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Location names must be unique. Cannot delete locations with assigned employees.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Uniqueness validation. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage work locations."


### reporting.read
- **Description:** View reporting relationships (who reports to whom) within the organisation.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped), Employee (own)
- **Scope:** Organisation-wide for Owner/HR Admin. Manager: own direct reports. Employee: own manager only.
- **Conditions:** Manager sees their direct reports list. Employee sees only their own assigned manager.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role + scope check. Manager query filtered to `manager_id = current_employee_id`. Employee query filtered to `employee_id = current_employee_id`.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view reporting relationships."

### reporting.write
- **Description:** Create, modify, or remove reporting relationships (assign/change/remove an employee's manager).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Cannot create circular reporting chains (A reports to B who reports to A). Manager must be an active employee. Changing a manager does not affect pending leave approvals (they remain with the original approver).
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Circular reference detection. Active employee validation for manager. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to modify reporting relationships." / 422 — "Circular reporting relationship detected."

---

## Leave Management

### leave.type.read
- **Description:** View configured leave types (e.g., Annual Leave, Sick Leave, Parental Leave) and their basic properties.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Organisation-wide
- **Conditions:** None. Leave types are organisational reference data visible to all members.
- **Sensitive fields:** None.
- **Server-side enforcement:** Scoped to `organisation_id`. No role restriction.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### leave.type.write
- **Description:** Create, edit, or archive leave types. Configure properties like whether balance is tracked, carry-over rules, and colour coding.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Cannot delete a leave type with existing requests (archive instead). Changes to leave type properties do not retroactively affect approved requests.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Referential integrity check before deletion. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage leave types."

### leave.policy.read
- **Description:** View leave policies defining entitlement rules: days allowed per year, accrual method, carry-over limits, pro-rata rules.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Organisation-wide
- **Conditions:** None. Employees should understand their entitlement.
- **Sensitive fields:** None.
- **Server-side enforcement:** Scoped to `organisation_id`.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### leave.policy.write
- **Description:** Create or modify leave policies, set entitlement amounts, configure accrual schedules, carry-over rules, and applicability criteria.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Policy changes take effect from next period unless explicitly backdated. Cannot reduce entitlement below already-used balance without override.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Balance integrity validation. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage leave policies."


### leave.balance.read.own
- **Description:** View own leave balance across all leave types (available, used, pending, carry-over).
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record
- **Conditions:** All authenticated users can see their own balance. Balance reflects approved leave and pending deductions.
- **Sensitive fields:** None.
- **Server-side enforcement:** Query filtered to `employee_id = current_user_employee_id`. Always available to authenticated users.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### leave.balance.read.team
- **Description:** View leave balances for direct reports.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports only. Owner/HR Admin: organisation-wide (equivalent to `.read.all`).
- **Conditions:** Manager must have active reporting relationship with target employees.
- **Sensitive fields:** None.
- **Server-side enforcement:** For Manager: query joined with `reporting_relationship` table filtered on `manager_id`. For Owner/HR Admin: full org scope.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view team leave balances."

### leave.balance.read.all
- **Description:** View leave balances for all employees in the organisation.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check for Owner/HR Admin. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view all leave balances."

### leave.request.create
- **Description:** Submit a new leave request for oneself. Specifies leave type, date range, half-day option, and optional notes/attachments.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record only (all users submit their own leave)
- **Conditions:** Must have sufficient balance (if leave type tracks balance). Dates must not overlap with existing approved/pending requests. Must be within allowed advance-booking window if configured. Cannot submit leave for past dates unless HR override.
- **Sensitive fields:** None.
- **Server-side enforcement:** Validates `employee_id` is current user's employee. Balance check. Overlap check. Business day calculation (excludes weekends and holidays). Creates audit event. Triggers notification to approver.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to submit leave requests." / 422 — "Insufficient leave balance." / 422 — "Overlapping leave request exists."

### leave.request.read.own
- **Description:** View own leave request history with status, dates, and approval details.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record
- **Conditions:** None. All users can view their own request history.
- **Sensitive fields:** None.
- **Server-side enforcement:** Query filtered to `employee_id = current_user_employee_id`.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### leave.request.read.team
- **Description:** View leave requests submitted by direct reports.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports. Owner/HR Admin: organisation-wide.
- **Conditions:** Manager sees only requests from employees in their reporting chain.
- **Sensitive fields:** None.
- **Server-side enforcement:** For Manager: join with `reporting_relationship`. For Owner/HR Admin: full org scope.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view team leave requests."

### leave.request.read.all
- **Description:** View all leave requests across the organisation with filtering and search.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view all leave requests."


### leave.request.approve
- **Description:** Approve a pending leave request, confirming the employee may take the requested leave and deducting from balance.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports only. Owner/HR Admin: any employee.
- **Conditions:** Request must be in 'pending' state. Manager must be the assigned approver (based on reporting relationship at time of submission). Approval deducts from balance. Cannot approve own request (Owner/HR Admin requests need a different approver or HR override).
- **Sensitive fields:** None.
- **Server-side enforcement:** Role + scope check. State validation (must be pending). Self-approval prevention. Balance deduction in transaction. Creates audit event. Sends notification to requester.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to approve this leave request." / 422 — "Cannot approve: request is not in pending state." / 422 — "Cannot approve your own leave request."

### leave.request.reject
- **Description:** Reject a pending leave request with a mandatory reason.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports only. Owner/HR Admin: any employee.
- **Conditions:** Request must be in 'pending' state. Reason is required. Rejection does not affect balance (nothing was deducted for pending requests). Cannot reject own request.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role + scope check. State validation. Reason required (non-empty string). Creates audit event. Sends notification to requester with reason.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to reject this leave request." / 422 — "Rejection reason is required."

### leave.request.override
- **Description:** Override a leave decision — approve a previously rejected request or cancel an approved request on behalf of an employee. Also allows approving requests that exceed balance limits.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Requires a reason for the override. Creates a distinct audit event type (`leave.override`). Can override balance checks if explicitly flagged. Useful for compassionate leave or policy exceptions.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check for Owner/HR Admin. Reason required. Override flag in audit event. Balance adjustment if needed. Notification to employee.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to override leave decisions."

### leave.calendar.read.team
- **Description:** View a calendar showing approved and pending leave for direct reports (team calendar view).
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports. Owner/HR Admin: full org.
- **Conditions:** Shows only approved and pending leave (not rejected/cancelled). Useful for planning.
- **Sensitive fields:** None (shows name + leave type + dates, no personal details).
- **Server-side enforcement:** Role + scope check. Query filtered by reporting relationship for Managers.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view the team leave calendar."

### leave.calendar.read.all
- **Description:** View an organisation-wide leave calendar showing all approved/pending leave.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check for Owner/HR Admin. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view the organisation leave calendar."

---

## Attendance


### attendance.clock
- **Description:** Clock in or clock out for the current day. Records timestamp, location type (office/remote), and optional notes.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record only
- **Conditions:** Cannot clock in if already clocked in (prevents duplicate). Cannot clock out if not clocked in. Timestamp recorded in organisation timezone. IP address may be logged for audit purposes.
- **Sensitive fields:** IP address (logged but not displayed to user).
- **Server-side enforcement:** Validates current attendance state for employee. Prevents duplicate clock-in. Records in organisation timezone. Creates attendance record. No approval needed.
- **Denial behaviour:** 422 Unprocessable — "You are already clocked in." / 422 — "You are not currently clocked in."

### attendance.read.own
- **Description:** View own attendance history including clock-in/out times, duration, corrections, and monthly summaries.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record
- **Conditions:** None. All users can view their own attendance.
- **Sensitive fields:** None.
- **Server-side enforcement:** Query filtered to `employee_id = current_user_employee_id`.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### attendance.read.team
- **Description:** View attendance records for direct reports including today's status, history, and summaries.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports. Owner/HR Admin: organisation-wide.
- **Conditions:** Manager sees only direct reports' attendance.
- **Sensitive fields:** None.
- **Server-side enforcement:** For Manager: join with `reporting_relationship`. For Owner/HR Admin: full org.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view team attendance."

### attendance.read.all
- **Description:** View attendance records for all employees in the organisation.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view all attendance records."

### attendance.correct
- **Description:** Correct an existing attendance record (modify clock-in or clock-out time). Used for missed punches or errors.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Requires a mandatory reason for correction. Original record is preserved (correction creates a linked record). Employee is notified of the correction. Cannot correct records older than a configurable window (default: 30 days).
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Reason validation (non-empty). Age validation (within correction window). Preserves original, creates correction record. Creates audit event. Sends notification to affected employee.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to correct attendance records." / 422 — "Correction reason is required." / 422 — "Record is outside the correction window."

### attendance.manual.add
- **Description:** Manually add an attendance record for an employee (e.g., for days when the system was unavailable or for retroactive entries).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Requires a reason. Cannot create duplicate records for the same date/employee. Validates time range is logical (clock-out after clock-in). Flags as manually entered in the record.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Duplicate check. Time validation. Marked as `source: 'manual'`. Reason stored. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to add manual attendance records." / 422 — "An attendance record already exists for this employee on this date."

### attendance.export
- **Description:** Export attendance data as CSV or PDF for a specified date range and employee set.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: direct reports only. Owner/HR Admin: organisation-wide.
- **Conditions:** Manager can only export their own team's data. Export includes metadata (generated by, generated at, filters applied). Rate-limited to prevent abuse.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role + scope check. Rate limiting. Export metadata injection. Creates audit event recording the export scope.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to export attendance data." / 429 — "Export rate limit exceeded. Please try again later."

---

## Onboarding


### onboarding.template.read
- **Description:** View onboarding templates and their task definitions.
- **Allowed roles:** Owner, HR Administrator, Manager
- **Scope:** Organisation-wide
- **Conditions:** Employee role cannot view templates (only their assigned tasks). Manager access allows them to understand the onboarding process for their new hires.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check excludes Employee role. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view onboarding templates."

### onboarding.template.write
- **Description:** Create, edit, or archive onboarding templates. Add, remove, or reorder tasks within templates.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Cannot delete a template that is currently assigned to active onboarding processes (archive instead). Template tasks define default assignee roles, relative due dates, and descriptions.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Referential integrity check. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage onboarding templates."

### onboarding.assign
- **Description:** Assign an onboarding template to an employee, generating individual tasks with calculated due dates.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Target employee must be in 'active' or 'invited' state. Cannot assign multiple active onboarding processes to the same employee. Due dates calculated from employee's start date using template relative-day offsets.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Employee state validation. Duplicate active onboarding check. Task generation in transaction. Creates audit event. Sends notifications to all task assignees.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to assign onboarding." / 422 — "Employee already has an active onboarding process."

### onboarding.task.read.own
- **Description:** View onboarding tasks assigned to the current user (either as the onboarding employee or as a task assignee).
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own assigned tasks
- **Conditions:** A user sees tasks where they are either the subject (being onboarded) or the assignee (responsible for completing the task, e.g., Manager sets up laptop, HR provides badge).
- **Sensitive fields:** None.
- **Server-side enforcement:** Query filtered by `assignee_id = current_user_id OR employee_id = current_user_employee_id`.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### onboarding.task.read.all
- **Description:** View all onboarding tasks across all employees in the organisation (includes overdue tracking).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None. Provides full visibility for HR operations dashboard.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view all onboarding tasks."

### onboarding.task.complete.own
- **Description:** Mark an onboarding task as complete when the current user is the task assignee or the onboarded employee (for self-service tasks).
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own assigned tasks only
- **Conditions:** Task must be in 'pending' or 'in_progress' state. User must be the assignee or the onboarded employee (for self-tasks). Completion records timestamp and completing user.
- **Sensitive fields:** None.
- **Server-side enforcement:** Validates task state. Validates current user is assignee or subject. Records completion. Checks if all tasks complete (triggers onboarding completion). Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You are not assigned to this task." / 422 — "Task is already completed."

### onboarding.task.complete.assigned
- **Description:** Mark onboarding tasks as complete for tasks assigned to the user's direct reports (Manager completing tasks on behalf of team member).
- **Allowed roles:** Owner, HR Administrator, Manager (scoped)
- **Scope:** Manager: tasks for direct reports. Owner/HR Admin: any task.
- **Conditions:** Manager can complete tasks where the onboarded employee is their direct report AND the task assignee role matches their authority.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role + scope check. Reporting relationship validation. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to complete this onboarding task."

### onboarding.cancel
- **Description:** Cancel an entire onboarding process for an employee. All incomplete tasks are marked cancelled.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Completed tasks remain as-is (historical record). Only pending/in-progress tasks are cancelled. Requires a reason. Useful when employee departure occurs during onboarding.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Bulk updates incomplete tasks. Reason recorded. Creates audit event. Notifications sent to affected assignees.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to cancel onboarding processes."

---

## Documents


### document.category.read
- **Description:** View document categories (e.g., Contracts, IDs, Certificates, Policies).
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Organisation-wide
- **Conditions:** None. Categories are organisational reference data.
- **Sensitive fields:** None.
- **Server-side enforcement:** Scoped to `organisation_id`. No role restriction.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### document.category.write
- **Description:** Create, edit, or archive document categories. Configure category-level sensitivity and retention rules.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Cannot delete categories with existing documents (archive instead). Category sensitivity flag determines who can access documents within it.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Referential integrity. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage document categories."

### document.upload
- **Description:** Upload a document and attach it to an employee record with category, description, and optional expiry date.
- **Allowed roles:** Owner, HR Administrator, Employee (own documents only)
- **Scope:** Owner/HR Admin: any employee. Employee: own record only.
- **Conditions:** File type validation (allowed: PDF, JPEG, PNG, DOCX, XLSX — configurable). Max file size enforced (default: 10MB). Employee can upload to non-sensitive categories only (e.g., personal certificates). Sensitive category uploads restricted to Owner/HR Admin.
- **Sensitive fields:** None (the document content itself may be sensitive, controlled by category).
- **Server-side enforcement:** Role check. For Employee: validates own record + non-sensitive category. File type validation. File size validation. Virus scanning (if configured). Storage with tenant-scoped path. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to upload documents for this employee." / 422 — "File type not allowed." / 422 — "File exceeds maximum size."

### document.read.own
- **Description:** View metadata and access documents attached to the current user's employee record.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record
- **Conditions:** Employee can see documents in non-sensitive categories attached to their own record. Sensitive documents (e.g., disciplinary records uploaded by HR) may be hidden from the employee — controlled by document visibility flag.
- **Sensitive fields:** None in metadata. Content access controlled by storage permissions.
- **Server-side enforcement:** Filtered by `employee_id = current_user_employee_id`. Visibility flag check excludes HR-private documents.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### document.read.all
- **Description:** View document metadata for all employees across the organisation.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None. Full access to document registry.
- **Sensitive fields:** None in metadata view.
- **Server-side enforcement:** Role check. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view all employee documents."

### document.read.sensitive
- **Description:** Access documents in sensitive categories (e.g., disciplinary records, medical certificates, legal documents).
- **Allowed roles:** Owner, HR Administrator (conditional)
- **Scope:** Organisation-wide
- **Conditions:** HR Admin access may be further restricted by org setting. Sensitive categories are explicitly flagged. Access to sensitive documents creates an audit event.
- **Sensitive fields:** The document content itself.
- **Server-side enforcement:** Role check. Category sensitivity flag check. Org setting check for HR Admin. Audit event on every access. Signed URL generation with short expiry.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to access sensitive documents."

### document.download
- **Description:** Download the actual file content of a document.
- **Allowed roles:** Owner, HR Administrator, Manager (scoped), Employee (own)
- **Scope:** Owner/HR Admin: any document. Manager: documents of direct reports in non-sensitive categories. Employee: own documents (non-hidden).
- **Conditions:** Download URL is a time-limited signed URL. Download creates an audit event. Manager cannot download sensitive-category documents.
- **Sensitive fields:** File content.
- **Server-side enforcement:** Role + scope + visibility check. Signed URL with 5-minute expiry. Audit event with document ID and downloader. Tenant-scoped storage path validation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to download this document."

### document.replace
- **Description:** Replace an existing document with a new version (e.g., updated contract). Previous version may be retained based on retention policy.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Maintains document metadata (category, employee, description). Updates file content and timestamps. Previous version retained if retention enabled. Cannot replace archived documents.
- **Sensitive fields:** File content.
- **Server-side enforcement:** Role check. State check (not archived). File validation. Version history if configured. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to replace documents."

### document.archive
- **Description:** Archive a document, removing it from active views but retaining it for compliance.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Archived documents are excluded from default queries. Can be unarchived. Storage is retained.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Sets `archived_at`. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to archive documents."

### document.delete
- **Description:** Permanently delete a document and its stored file. This is a destructive, irreversible action.
- **Allowed roles:** Owner, HR Administrator (conditional)
- **Scope:** Organisation-wide
- **Conditions:** HR Admin can only delete documents in non-sensitive categories. Owner can delete any. Requires confirmation. Document must be archived first (two-step deletion: archive → delete). Storage object is removed. Deletion is irreversible.
- **Sensitive fields:** None (document is being removed).
- **Server-side enforcement:** Role check. For HR Admin: category sensitivity check. State check (must be archived). Confirmation token required. Deletes storage object. Deletes database record. Creates permanent audit event (the audit record persists even after document deletion).
- **Denial behaviour:** 403 Forbidden — "You do not have permission to delete documents." / 422 — "Document must be archived before deletion." / 403 — "HR Administrators cannot delete sensitive documents."

---

## Payroll


### payroll.period.read
- **Description:** View payroll periods (monthly cycles) and their status (draft, under review, approved, published).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** None. Payroll period visibility is limited to admin roles. Employees do not see period management — they only see published payslips.
- **Sensitive fields:** None at period level.
- **Server-side enforcement:** Role check for Owner/HR Admin. Scoped to organisation.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view payroll periods."

### payroll.period.write
- **Description:** Create a new payroll period, close a period for editing, or reopen a period (if permitted by configuration).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Periods must be sequential (cannot create overlapping periods). Reopening a published period requires Owner role specifically. Creates audit event.
- **Sensitive fields:** None.
- **Server-side enforcement:** Role check. Sequential validation. Reopen restricted to Owner only. State machine enforcement. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to manage payroll periods." / 422 — "Overlapping payroll period exists." / 403 — "Only the Owner can reopen published payroll periods."

### payroll.record.read
- **Description:** View individual employee payroll records within a period (earnings, deductions, allowances, net pay).
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Contains compensation data — highly sensitive. Access limited to payroll administrators.
- **Sensitive fields:** All fields (salary, deductions, allowances, net pay, bank details reference).
- **Server-side enforcement:** Role check. Scoped to organisation. Audit event on access.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view payroll records."

### payroll.record.write
- **Description:** Create or modify employee payroll records: add earnings lines, deductions, allowances, and calculate totals.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Period must be in 'draft' or 'under_review' state. Cannot modify records in approved/published periods (reopen first). All calculations use decimal-safe arithmetic. Creates audit event with line-item changes.
- **Sensitive fields:** All fields.
- **Server-side enforcement:** Role check. Period state check. Decimal arithmetic enforcement. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to modify payroll records." / 422 — "Payroll period is not in an editable state."

### payroll.approve
- **Description:** Approve a payroll period, locking all records for payment processing.
- **Allowed roles:** Owner, HR Administrator (conditional)
- **Scope:** Organisation-wide
- **Conditions:** Period must be in 'under_review' state. Approval locks all records. HR Admin can approve only if org setting `hr_admin_payroll_approve` is enabled (default: true). The person who prepared the payroll should not be the same person who approves it (separation of duties — enforced if more than one admin exists).
- **Sensitive fields:** None at approval level.
- **Server-side enforcement:** Role check. State check. Separation of duties check (if applicable). Transitions period to 'approved'. Creates audit event with approver identity.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to approve payroll." / 422 — "Period is not in review state." / 422 — "Separation of duties: approver cannot be the same as preparer."

### payroll.publish
- **Description:** Publish payslips to employees, making them visible in self-service.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Period must be in 'approved' state. Publishing generates individual payslip records accessible to each employee. Triggers notifications to all employees with payslips. Irreversible without Owner reopening the period.
- **Sensitive fields:** Payslip content (salary, deductions, net pay).
- **Server-side enforcement:** Role check. State check. Generates payslip records per employee. Marks period as 'published'. Sends bulk notification. Creates audit event.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to publish payslips." / 422 — "Period must be approved before publishing."

### payslip.read.own
- **Description:** View own published payslips showing earnings breakdown, deductions, allowances, and net pay.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own record only
- **Conditions:** Only published payslips are visible. Employee sees only their own payslips. This is the primary self-service payroll interface for employees.
- **Sensitive fields:** All fields (salary, deductions, net pay). However, this is the employee's own data.
- **Server-side enforcement:** Query filtered to `employee_id = current_user_employee_id` AND `status = 'published'`. No role restriction for own data.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

---

## Notifications


### notification.read.own
- **Description:** View own in-app notifications including leave decisions, task assignments, document expiry alerts, and payslip availability.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own notifications only
- **Conditions:** None. Every authenticated user can read their own notifications. Notifications are never shared between users.
- **Sensitive fields:** None (notification content is already scoped to what the user is allowed to know).
- **Server-side enforcement:** Query filtered to `recipient_id = current_user_id`. Scoped to active organisation.
- **Denial behaviour:** 401 Unauthorized — "Authentication required."

### notification.mark_read
- **Description:** Mark one or all notifications as read.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own notifications only
- **Conditions:** Can only mark own notifications. Supports mark-single and mark-all-read operations.
- **Sensitive fields:** None.
- **Server-side enforcement:** Validates `notification.recipient_id = current_user_id` before update. Prevents marking another user's notifications.
- **Denial behaviour:** 403 Forbidden — "You can only manage your own notifications."

---

## Audit

### audit.read
- **Description:** View the audit log showing all recorded actions: employee changes, leave decisions, attendance corrections, permission changes, payroll approvals, document operations, and settings modifications.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Audit logs are read-only. No user can modify, delete, or truncate audit records through the application. Logs include actor, action, target, timestamp, old values, new values, and IP address.
- **Sensitive fields:** May contain references to sensitive data changes (e.g., "salary changed from X to Y"). Values may be masked in display but stored in full.
- **Server-side enforcement:** Role check for Owner/HR Admin. Scoped to organisation. Pagination enforced. No write/delete endpoints exist for audit.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view audit logs."

### audit.export
- **Description:** Export audit logs as CSV for compliance reporting and external archival.
- **Allowed roles:** Owner, HR Administrator (conditional)
- **Scope:** Organisation-wide
- **Conditions:** HR Admin can export only if org setting `hr_admin_audit_export` is enabled (default: true). Export includes all fields including sensitive values. Rate-limited. Export itself is logged as an audit event.
- **Sensitive fields:** Exported data may contain sensitive change records.
- **Server-side enforcement:** Role check. Org setting check for HR Admin. Rate limiting. The export action creates its own audit event. Generates file with metadata header.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to export audit logs." / 429 — "Export rate limit exceeded."

---

## Dashboard

### dashboard.admin
- **Description:** Access the administrative dashboard showing organisation-wide metrics: active employees, pending leave, missing clock-outs, overdue onboarding, expiring documents, payroll status, and recent audit activity.
- **Allowed roles:** Owner, HR Administrator
- **Scope:** Organisation-wide
- **Conditions:** Aggregated metrics only — does not grant access to individual records beyond what the role already allows. Dashboard queries are optimised to avoid N+1 patterns.
- **Sensitive fields:** Counts and aggregations only (no individual compensation data on dashboard).
- **Server-side enforcement:** Role check. All widget queries independently enforce tenant scoping. Cached where appropriate with short TTL.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view the admin dashboard." Redirect to role-appropriate dashboard.

### dashboard.manager
- **Description:** Access the manager dashboard showing team-specific metrics: direct reports' status, pending leave approvals, team attendance today, overdue onboarding tasks assigned to manager, and team calendar summary.
- **Allowed roles:** Owner, HR Administrator, Manager
- **Scope:** Manager: direct reports only. Owner/HR Admin: see all (equivalent to admin dashboard for them, but this defines the Manager's landing page).
- **Conditions:** Manager sees only their team's data. If a Manager has no direct reports, the dashboard shows empty states with guidance.
- **Sensitive fields:** None (team-level aggregations and status).
- **Server-side enforcement:** Role check. For Manager: all queries scoped to `reporting_relationship.manager_id = current_user_employee_id`. Empty state handling.
- **Denial behaviour:** 403 Forbidden — "You do not have permission to view the manager dashboard." Redirect to employee dashboard.

### dashboard.employee
- **Description:** Access the employee self-service dashboard showing own status: attendance today, leave balance summary, pending requests, onboarding progress, recent notifications, and upcoming events.
- **Allowed roles:** Owner, HR Administrator, Manager, Employee
- **Scope:** Own data only
- **Conditions:** All authenticated users with an employee record can see this. If a user has Manager/HR Admin/Owner role, they also have access to higher dashboards but can navigate to this view.
- **Sensitive fields:** None.
- **Server-side enforcement:** Validates user has an associated employee record. All queries scoped to own employee_id. Minimal database load.
- **Denial behaviour:** 401 Unauthorized — "Authentication required." / 404 — "No employee record found for this account."

---


## Implementation Notes

### Permission Evaluation Order

1. **Authentication** — Is the user logged in with a valid session?
2. **Organisation membership** — Does the user belong to the target organisation?
3. **Role check** — Does the user's role include the required permission?
4. **Scope check** — Is the user accessing data within their allowed scope (own / team / org)?
5. **Condition check** — Are any additional conditions satisfied (org settings, state, etc.)?
6. **Field filtering** — Strip sensitive fields the user is not permitted to see.

### Permission Service Interface

```typescript
interface PermissionCheck {
  userId: string;
  organisationId: string;
  permission: string;           // e.g., "employee.compensation.read"
  targetResourceId?: string;    // e.g., employee ID being accessed
  targetResourceType?: string;  // e.g., "employee", "leave_request"
}

interface PermissionResult {
  granted: boolean;
  scope: 'own' | 'team' | 'organisation';
  denialReason?: string;
  fieldRestrictions?: string[];  // Fields to exclude from response
}
```

### Role Hierarchy

Roles are NOT hierarchical in a strict inheritance sense. Each role has explicitly defined permissions. However, the Owner role is a superset of all other roles. The permission evaluation is:

- Owner: all permissions granted
- HR Administrator: all permissions except org ownership/settings write and specific conditional gates
- Manager: team-scoped permissions + self-service
- Employee: self-service only

### Conditional Permissions (Org Settings)

The following permissions are gated by organisation settings that the Owner can configure:

| Setting Key | Default | Effect |
|---|---|---|
| `hr_admin_sensitive_access` | `true` | Whether HR Admin can view employee sensitive data (national ID, bank) |
| `hr_admin_payroll_approve` | `true` | Whether HR Admin can approve payroll (vs Owner-only) |
| `hr_admin_audit_export` | `true` | Whether HR Admin can export audit logs |
| `hr_admin_document_delete` | `true` | Whether HR Admin can delete archived documents |

### Multi-Tenant Enforcement

- Every permission check MUST validate `organisation_id` from the authenticated session
- Organisation ID is NEVER taken from request parameters for authorization purposes
- Cross-tenant requests return 404 (not 403) to prevent information leakage about resource existence
- Background jobs must explicitly set tenant context before any data operation

### Audit Trail

The following permission-related events are always logged:

- Permission denied attempts (actor, action, target, reason)
- Sensitive data access (compensation, national ID, bank details)
- Role changes
- Ownership transfers
- Bulk operations (exports, mass updates)
- Administrative overrides

### Denial Response Format

All permission denials return a consistent error shape:

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "status": 403,
    "message": "You do not have permission to [action description].",
    "permission": "employee.compensation.read",
    "requiredRole": ["owner", "hr_admin"],
    "currentRole": "manager"
  }
}
```

For cross-tenant violations, return 404:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "status": 404,
    "message": "Resource not found."
  }
}
```

### Future: System Administrator Role

The System Administrator is a platform-level role for the future managed hosting offering. It operates OUTSIDE the organisation context:

- Can list organisations (metadata only)
- Can disable/enable organisations
- Can view platform health metrics
- Cannot access organisation data (employee records, payroll, documents)
- Cannot impersonate users within organisations
- Separate authentication mechanism (platform admin portal)

This role is explicitly NOT part of V1 implementation but is documented here for forward compatibility. The permission system should be designed so that platform-level permissions exist in a separate namespace (e.g., `platform.org.list`, `platform.org.disable`) that never intersects with organisation-level permissions.

---

## Change Log

| Date | Change | Author |
|---|---|---|
| Initial | Complete V1 permissions matrix | HR Daddy Architecture |
