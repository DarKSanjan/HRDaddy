# Domain Glossary

This glossary defines every important domain term used in HR Daddy. Each term is defined precisely to eliminate ambiguity across product, design, and engineering.

---

## Core Identity Terms

### User

- **Definition:** A person who has authentication credentials (email + password) and can sign into the platform. A User exists independently of any Organisation. A single User may belong to multiple Organisations via Memberships.
- **Disambiguation:** A User is NOT the same as an Employee. A User is a login identity; an Employee is an employment record. Not all Employees have User accounts (e.g., employees onboarded without system access).
- **Related terms:** Account, Membership, Employee, Role

---

### Account

- **Definition:** Synonym for User in this system. We prefer "User" to avoid confusion. "Account" is only used in the context of "account settings" (profile, password, preferences).
- **Disambiguation:** Do NOT use "Account" to refer to an Organisation or a billing entity. It strictly maps to a single User's authentication and profile settings.
- **Related terms:** User

---

### Organisation

- **Definition:** A company, business, or entity that uses HR Daddy. An Organisation is the primary tenant boundary. All employee data, policies, and configuration belong to exactly one Organisation. Equivalent to "tenant" in multi-tenant architecture.
- **Disambiguation:** An Organisation is NOT a department. It is the top-level entity. In user-facing language, always use "Organisation" rather than "Tenant" or "Company."
- **Related terms:** Tenant, Membership, Department, Employee

---

### Tenant

- **Definition:** Architectural synonym for Organisation. Used in technical documentation to refer to the data isolation boundary. In user-facing language, always use "Organisation."
- **Disambiguation:** Only use "Tenant" in technical/infrastructure contexts (database schemas, API scoping, data isolation). Never expose this term to end users.
- **Related terms:** Organisation

---

### Membership

- **Definition:** The relationship between a User and an Organisation. A Membership carries an organisation-level role (Owner, HR Administrator, Manager, Employee). A User may have different roles in different Organisations. Memberships can be active or revoked.
- **Disambiguation:** A Membership is NOT the same as an Employee record. Membership grants system access and permissions. An Employee record stores HR/employment data. They are related but distinct entities.
- **Related terms:** User, Organisation, Role, Employee

---

## People & Structure Terms

### Employee

- **Definition:** A person who works for an Organisation. An Employee record contains employment details (job title, department, start date, compensation). An Employee MAY or MAY NOT have an associated User account (login access).
- **Disambiguation:** A User is an authentication identity. An Employee is an employment record. They are linked but separate. An Employee without a User account cannot log in. A User without an Employee record (e.g., an external HR consultant) can log in but has no employment data.
- **Related terms:** User, Membership, Department, Job Title, Employment Status, Employment Type, Reporting Relationship

---

### Manager

- **Definition:** An Employee who has direct reports assigned to them via a Reporting Relationship. "Manager" is both an organisation role (for permissions) and a structural relationship (for approvals, team visibility).
- **Disambiguation:** An Employee can be a Manager in the reporting structure while having the "Employee" role if they don't need full Manager permissions. Conversely, someone with the "Manager" role permission set may not have direct reports yet. The role and the structural relationship are independent.
- **Related terms:** Employee, Reporting Relationship, Role, Leave Approval

---

### Department

- **Definition:** An organisational unit that groups Employees. Departments have a name and optionally a department manager. An Employee belongs to zero or one Department at a time.
- **Disambiguation:** Departments are flat in V1 (no nested/hierarchical departments). A Department is NOT the same as a team or project group.
- **Related terms:** Employee, Manager, Organisation

---

### Job Title

- **Definition:** A named position within the Organisation (e.g., "Software Engineer", "Marketing Director"). Job Titles are organisation-defined, not system-defined. An Employee has exactly one Job Title at a time.
- **Disambiguation:** Job Title is a free-text or catalogue selection per Organisation. It is NOT a system-wide enum. Different Organisations can define different Job Titles.
- **Related terms:** Employee, Department, Employment Type

---

### Employment Type

- **Definition:** The contractual basis of employment (e.g., Full-time, Part-time, Contract, Intern). Organisation-configurable.
- **Disambiguation:** Employment Type describes the contractual arrangement, NOT the employee's current status (active, suspended, etc.). That is Employment Status.
- **Related terms:** Employee, Employment Status

---

### Employment Status

- **Definition:** The current lifecycle state of an Employee within the Organisation.
  - **Stored states:** Draft, Invited, Active, Suspended, Deactivated, Archived.
  - **Derived states:** On Leave (active but currently on approved leave).
- **Disambiguation:** "Derived states" are computed at read time and not persisted. An Employee with status "Active" who is currently on approved leave appears as "On Leave" in the UI but remains "Active" in the database. "Deactivated" means the employment has ended but records are retained. "Archived" means moved to cold storage (not visible in normal queries).
- **Related terms:** Employee, Leave Request, Onboarding

---

### Work Location

- **Definition:** A physical or virtual location where Employees work (e.g., "Singapore Office", "Remote - Malaysia"). Organisation-defined.
- **Disambiguation:** Work Location is the assigned/default location for an Employee, not the real-time GPS location. It does not track daily attendance location (that is captured in the Attendance Record).
- **Related terms:** Employee, Organisation, Attendance Record

---

### Reporting Relationship

- **Definition:** A directed relationship where one Employee (the report) reports to another Employee (the manager). This determines approval chains and team visibility. An Employee has zero or one direct manager.
- **Disambiguation:** The reporting relationship is strictly hierarchical and single-parent (no matrix reporting in V1). It governs leave approvals and team visibility, not department membership.
- **Related terms:** Employee, Manager, Leave Approval, Department

---

## Attendance Terms

### Attendance Record

- **Definition:** A single entry recording an Employee's presence for a work period. Contains clock-in time, clock-out time (optional until clocked out), duration, type (office/remote), and status.
- **Disambiguation:** An Attendance Record is the database entity. It maps one-to-one with an Attendance Session but represents the persisted data, not the logical time window.
- **Related terms:** Attendance Session, Employee, Work Location

---

### Attendance Session

- **Definition:** The period between a clock-in and its corresponding clock-out. A session is "open" when clocked in but not yet clocked out. A session is "closed" when both timestamps exist.
- **Disambiguation:** An Attendance Session is the logical concept of "being clocked in." It is not a separate database entity from the Attendance Record but rather a lens for understanding the record's state.
- **Related terms:** Attendance Record, Employee

---

## Leave Terms

### Leave Type

- **Definition:** A category of time off defined by the Organisation (e.g., Annual Leave, Sick Leave, Maternity Leave, Unpaid Leave). Each type has its own policies.
- **Disambiguation:** Leave Types are organisation-defined, not system-wide. Each Organisation configures its own set of Leave Types. The system may provide default templates, but Organisations can customise them.
- **Related terms:** Leave Policy, Leave Balance, Leave Request, Organisation

---

### Leave Policy

- **Definition:** Configuration rules for a Leave Type within an Organisation: annual allowance, accrual rules, carry-over limits, approval requirements, documentation requirements.
- **Disambiguation:** A Leave Policy defines the RULES for a Leave Type. It is not a specific employee's balance or request. One Leave Policy applies to all eligible Employees for that Leave Type (or a subset based on employment type, tenure, etc.).
- **Related terms:** Leave Type, Leave Balance, Leave Request, Organisation

---

### Leave Balance

- **Definition:** The current available days/hours of a specific Leave Type for a specific Employee in a specific leave year. Calculated as: Allowance + Carry-over - Used - Pending.
- **Disambiguation:** Balance is NOT the same as Allowance. Allowance is the total granted for the year. Balance is the remaining available amount after accounting for used and pending leave.
- **Related terms:** Leave Type, Leave Policy, Leave Request, Employee

---

### Leave Request

- **Definition:** A formal submission by an Employee to take time off. Contains: leave type, start date, end date, reason, supporting documents (optional). Has a lifecycle: Draft → Pending → Approved/Rejected/Cancelled/Withdrawn.
- **Disambiguation:** A Leave Request in "Pending" state has NOT yet been approved and does NOT guarantee time off. "Cancelled" means the approver cancelled it. "Withdrawn" means the requester retracted it before a decision.
- **Related terms:** Leave Type, Leave Balance, Leave Approval, Employee, Manager

---

### Leave Approval

- **Definition:** The act of a Manager or HR Administrator reviewing and deciding on a Leave Request. Records: approver, decision, reason, timestamp.
- **Disambiguation:** Leave Approval is the decision event, not the Leave Request itself. A single Leave Request has exactly one Leave Approval decision (approve or reject). Multi-level approvals are not supported in V1.
- **Related terms:** Leave Request, Manager, Role, Permission

---

## Onboarding Terms

### Onboarding Template

- **Definition:** A reusable checklist of tasks that should be completed when a new Employee joins. Organisation-defined. Can be assigned to new hires.
- **Disambiguation:** A template is a BLUEPRINT. It does not contain employee-specific data. When applied to an Employee, it generates an Employee Onboarding instance.
- **Related terms:** Onboarding Task, Employee Onboarding, Organisation

---

### Onboarding Task

- **Definition:** A single action item within an Onboarding Template (e.g., "Set up email account", "Complete tax forms"). Has an assignee type (Employee, Manager, HR).
- **Disambiguation:** Within a template, an Onboarding Task is abstract (no specific person assigned). When instantiated as part of an Employee Onboarding, it becomes a concrete task assigned to a specific person with a due date.
- **Related terms:** Onboarding Template, Employee Onboarding

---

### Employee Onboarding

- **Definition:** An instance of an Onboarding Template applied to a specific Employee. Generates concrete tasks with due dates based on the employee's joining date.
- **Disambiguation:** This is the INSTANCE, not the template. It is tied to one Employee and tracks the completion status of each generated task. Modifying the template after instantiation does NOT affect existing Employee Onboarding instances.
- **Related terms:** Onboarding Template, Onboarding Task, Employee

---

## Document Terms

### Employee Document

- **Definition:** A file uploaded and associated with a specific Employee (e.g., ID copy, contract, certification). Has metadata: category, upload date, expiry date (optional), visibility level.
- **Disambiguation:** Employee Documents belong to a specific Employee record. They are NOT shared organisation-wide documents (e.g., company policies). Visibility level controls who can view the document (Employee only, Manager, HR, etc.).
- **Related terms:** Document Category, Employee, Organisation

---

### Document Category

- **Definition:** An organisation-defined classification for documents (e.g., "Identity", "Contracts", "Certifications", "Medical"). Controls default visibility and retention.
- **Disambiguation:** Document Categories are organisation-configurable labels. They determine default access rules and retention policies. They are NOT system-fixed; Organisations can create custom categories.
- **Related terms:** Employee Document, Organisation

---

## Payroll Terms

### Payroll Period

- **Definition:** A defined time range for which payroll is calculated (e.g., "July 2024", "1-15 Aug 2024"). Has a lifecycle: Draft → Under Review → Approved → Published → Paid.
- **Disambiguation:** A Payroll Period is NOT the same as a calendar month. Organisations can define their own pay cycle (monthly, bi-monthly, weekly). A period in "Draft" state can be modified. Once "Published," it becomes immutable to employees (Payslips are generated). "Paid" indicates actual disbursement has occurred.
- **Related terms:** Payroll Record, Payslip, Organisation

---

### Payroll Record

- **Definition:** A single employee's pay details within a Payroll Period. Contains line items for earnings, allowances, and deductions.
- **Disambiguation:** A Payroll Record is the internal HR/finance view of an employee's pay. It is editable while the Payroll Period is in Draft or Under Review. It is NOT the same as a Payslip (which is the employee-facing, immutable view).
- **Related terms:** Payroll Period, Payroll Line Item, Payslip, Employee

---

### Payroll Line Item

- **Definition:** An individual component of a Payroll Record (e.g., "Basic Salary: $5,000", "Transport Allowance: $200", "CPF Deduction: -$1,000"). Has a type (Earning, Allowance, Deduction) and amount.
- **Disambiguation:** Line Items are the atomic building blocks of a Payroll Record. They are categorised by type: Earning (base pay, overtime), Allowance (transport, meals), or Deduction (tax, statutory contributions, loan repayments).
- **Related terms:** Payroll Record, Payroll Period

---

### Payslip

- **Definition:** A read-only, employee-visible view of their Payroll Record for a given period. Generated when payroll is published. Immutable once published.
- **Disambiguation:** A Payslip is NOT editable. If corrections are needed after publishing, a new Payroll Period or adjustment entry must be created. Payslips are the legal record of payment provided to the Employee.
- **Related terms:** Payroll Record, Payroll Period, Employee

---

## System Terms

### Notification

- **Definition:** An in-app message delivered to a User about a system event relevant to them (e.g., leave request received, task assigned, document expiring). Has read/unread state.
- **Disambiguation:** Notifications are in-app only in V1. Email notifications are a separate delivery channel and may not have a 1:1 mapping with in-app notifications. A Notification targets a User (not an Employee), because only Users can log in to see them.
- **Related terms:** User, Audit Event

---

### Audit Event

- **Definition:** An immutable record of a significant action performed in the system. Contains: actor, action, target, timestamp, organisation, before/after values where applicable. Cannot be modified or deleted through normal application workflows.
- **Disambiguation:** Audit Events are NOT Notifications. Audit Events are a compliance/security record. Notifications are user-facing alerts. Not every Audit Event generates a Notification, and not every Notification corresponds to an Audit Event.
- **Related terms:** Notification, User, Organisation, Permission

---

### Role

- **Definition:** A named set of permissions assigned to a Membership. V1 roles: Owner, HR Administrator, Manager, Employee. Roles are fixed in V1 (not custom-definable).
- **Disambiguation:** A Role is NOT the same as a Job Title. Role controls system permissions. Job Title is an HR/employment concept. An Employee with Job Title "Team Lead" might have either the Manager or Employee role depending on what system access they need.
- **Related terms:** Permission, Membership, Organisation

---

### Permission

- **Definition:** A specific capability granted by a Role (e.g., `employee.write`, `leave.request.approve`, `payroll.manage`). Permissions are checked server-side on every sensitive operation.
- **Disambiguation:** Permissions are NOT directly assigned to Users or Employees. They are assigned to Roles, and Roles are assigned via Memberships. Permission checks always consider the User's Membership in the relevant Organisation.
- **Related terms:** Role, Membership, User, Organisation

---

## Important Distinctions

| Concept A | Concept B | Distinction |
|-----------|-----------|-------------|
| User | Employee | User = login identity. Employee = employment record. Not all Employees have Users. |
| Organisation | Tenant | Same thing. "Organisation" is user-facing, "Tenant" is technical. |
| Role | Permission | Role is a named group. Permission is a specific capability within that group. |
| Role | Job Title | Role = system access level. Job Title = HR/employment position name. |
| Membership | Employment | Membership = User↔Organisation relationship with a role. Employee record = HR data. |
| Leave Balance | Leave Allowance | Allowance = total granted for the year. Balance = remaining available. |
| Attendance Record | Attendance Session | Record = the database entry. Session = the logical open/closed period. |
| Payroll Record | Payslip | Record = internal HR/finance view (editable). Payslip = employee-visible published view (immutable). |
| Onboarding Template | Employee Onboarding | Template = reusable blueprint. Instance = applied to a specific employee with concrete tasks. |
| Notification | Audit Event | Notification = user-facing alert. Audit Event = compliance/security log entry. |
| Employment Type | Employment Status | Type = contractual basis (Full-time, Part-time). Status = lifecycle state (Active, Suspended). |
| Department | Organisation | Organisation = top-level tenant. Department = subdivision within an Organisation. |
| Account | User | Same thing. Prefer "User." "Account" only in "account settings" context. |

---

## Naming Conventions

- **User-facing language:** Use Organisation (not Tenant), User (not Account), Employee (not Worker/Staff).
- **Technical/API language:** May use Tenant for data isolation contexts, but map to Organisation in domain models.
- **Database naming:** Use snake_case versions of these terms (e.g., `leave_request`, `payroll_period`, `employment_status`).
- **Code naming:** Use PascalCase for types/classes (e.g., `LeaveRequest`, `PayrollPeriod`), camelCase for variables/properties.
