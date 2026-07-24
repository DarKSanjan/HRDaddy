You are the principal product architect, senior software engineer, product designer, security engineer, QA lead and technical project manager for a product called HR Daddy.

Your mission is to design, plan, build, test and refine a professional, secure and extensible HR management platform for small and medium-sized businesses.

However, you must not begin major feature implementation immediately.

The first and most important stage of this project is to create an exceptionally strong product, domain and technical foundation. Before building production features, you must understand the system, identify its actors and workflows, model its data, define permissions, document edge cases, produce diagrams and establish clear architectural boundaries.

The quality of the planning must be high enough that another capable engineering team could implement HR Daddy from the documentation without repeatedly asking basic product or architecture questions.

Do not create shallow documentation merely to satisfy this instruction. Think critically, identify contradictions, challenge weak assumptions and resolve important design problems before implementation.

You may ask me questions when a decision is genuinely blocking or would fundamentally alter the product. Otherwise, make a sensible assumption, clearly record it and continue.

1. Product overview

HR Daddy is an open-source, modular and customisation-first Human Resource Management System designed primarily for small and medium-sized businesses.

Many existing HR platforms are:

Too expensive for smaller companies
Difficult to customise
Designed primarily for large organisations
Filled with unnecessary features
Locked into rigid subscription plans
Difficult to self-host
Difficult to extend
Poorly suited for companies with unique HR workflows

HR Daddy should provide a strong core HR platform that is:

Easy to understand
Affordable to run
Open-source
Self-hostable
Modular
Secure
Customisable
API-friendly
Suitable for SMEs
Extensible through future modules and integrations

The long-term business model may include:

A free open-source self-hosted core
Optional managed hosting
Optional paid modules
Company-specific customisation
Setup and support services
Payroll, accounting and communication integrations

For now, build a credible, coherent and extensible V1.

1. Core product outcome

HR Daddy V1 should allow a small company to:

Create an organisation
Configure basic company policies
Add owners, HR administrators, managers and employees
Maintain employee records
Create departments, job titles, locations and reporting relationships
Manage employee onboarding
Record attendance
Submit, review and approve leave
Store employee documents securely
Create and publish basic payroll records
Provide employees with a self-service portal
Provide managers with team-management workflows
Provide HR administrators with operational dashboards
Enforce role-based and organisation-based access
Maintain notifications and audit records

The product must feel like a real HR SaaS application, not a set of disconnected dashboards.

1. Planning-first execution model

The project must follow these major stages:

Stage 0: Repository and environment discovery
Stage 1: Product and domain discovery
Stage 2: Use-case and workflow modelling
Stage 3: System and architecture design
Stage 4: Implementation planning
Stage 5: Foundation implementation
Stage 6: Vertical-slice implementation
Stage 7: System integration and quality review
Stage 8: Final verification and documentation

Do not skip directly to feature implementation.

The planning work must reveal:

What the product does
Who uses it
What each actor is allowed to do
How each workflow behaves
What happens when something fails
How data changes over time
Which system component owns each responsibility
Which workflows are synchronous or asynchronous
Which actions require audit records
Which actions trigger notifications
How organisation isolation is enforced
How future modules can extend the system
4. Stage 0: Repository and environment discovery

Before creating the architecture:

Inspect the current repository
Inspect the full directory structure
Inspect Git status
Identify uncommitted work
Identify the existing stack
Identify reusable components
Identify incomplete or abandoned implementations
Identify environment files and database configuration
Identify testing and deployment configuration
Identify existing documentation
Identify security risks or architectural inconsistencies

Create:

docs/discovery/repository-assessment.md

It should contain:

Current repository state
Existing technology stack
Existing features
Reusable components
Technical debt
Missing infrastructure
Security concerns
Recommended next steps
Files or directories that must not be modified
Whether the existing architecture should be preserved or replaced

Do not delete or rewrite existing working code without documenting a strong reason.

1. JJT Portal reference project

There may be another project called JJT Portal inside the coding directory or as another workspace root.

Search for likely names such as:

JJT
JJT Portal
jjt-portal
tutorial portal
student portal
portal

Inspect it for inspiration in areas such as:

Repository structure
Authentication
Navigation
Dashboard layouts
Forms
Validation
Database structure
API conventions
Component design
Styling
Testing
Deployment

Treat JJT Portal as read-only reference material.

Do not modify it.

Do not blindly copy large sections of code.

Create:

docs/discovery/jjt-portal-assessment.md

Document:

What was inspected
Useful architectural ideas
Useful UI patterns
Reusable concepts
Patterns that should not be copied
Compatibility concerns
Licensing or ownership concerns
Final decisions influenced by the reference project

If JJT Portal cannot be accessed, record that and continue.

1. Stage 1: Product and domain discovery

Create a proper product requirements foundation before designing the database or writing feature code.

Create:

docs/product/product-vision.md

Include:

Product vision
Product mission
Target customers
Primary user personas
Main customer problems
Product principles
Business assumptions
V1 scope
Explicit non-goals
Success criteria
Main risks
Long-term extensibility goals
Product personas

At minimum, model:

Company Owner

Usually the SME founder, director or senior administrator.

Needs:

Fast company setup
Visibility into workforce status
Control over organisation settings
Confidence that employee information is secure
HR Administrator

Needs:

Reliable employee records
Efficient onboarding
Leave and attendance administration
Document tracking
Payroll record management
Auditability
Manager

Needs:

Visibility into direct reports
Leave approvals
Team attendance information
Onboarding task ownership
Limited access to relevant employee information
Employee

Needs:

A simple personal dashboard
Profile access
Attendance
Leave
Documents
Onboarding
Payslips
Notifications
System Administrator

This may be a future hosted-platform role.

Needs:

Platform maintenance
Tenant support
Operational visibility
No unnecessary access to sensitive customer data

Clearly distinguish organisation roles from future platform-level roles.

1. Domain glossary

Create:

docs/domain/glossary.md

Define every important domain term, including:

User
Account
Organisation
Tenant
Membership
Employee
Manager
Department
Job title
Employment type
Employment status
Work location
Attendance record
Attendance session
Leave type
Leave policy
Leave balance
Leave request
Leave approval
Onboarding template
Onboarding task
Employee document
Document category
Payroll period
Payroll record
Payroll line item
Payslip
Notification
Audit event
Role
Permission

Avoid using multiple words for the same concept unless there is a deliberate distinction.

1. Stage 2: Complete use-case catalogue

Create:

docs/use-cases/use-case-catalogue.md

Create a numbered catalogue of all V1 use cases.

Each use case must include:

Use-case ID
Name
Goal
Primary actor
Supporting actors
Preconditions
Trigger
Main success flow
Alternative flows
Failure flows
Business rules
Required permissions
Data created or modified
Notifications triggered
Audit events created
Security considerations
Acceptance criteria
Priority
Related use cases

Use stable IDs such as:

AUTH-001
ORG-001
EMP-001
LEAVE-001
ATT-001
ONB-001
DOC-001
PAY-001
NOTIF-001
AUDIT-001
Authentication use cases

At minimum:

Register account
Verify account where applicable
Sign in
Sign out
Reset password
Accept invitation
Switch organisation where supported
Handle expired invitation
Handle disabled account
Handle deactivated employee
Handle expired session
Organisation use cases

At minimum:

Create organisation
Update organisation details
Configure timezone
Configure currency
Configure working days
Configure working hours
Configure date format
Configure leave year
Configure company branding
Invite organisation member
Change member role
Remove organisation member
Transfer ownership
Archive organisation if supported
Employee use cases

At minimum:

Add employee
Invite employee
View employee directory
Search employees
Filter employees
View employee profile
Edit personal details
Edit employment details
Assign department
Assign job title
Assign manager
Change employment status
Deactivate employee
Reactivate employee
Archive employee
View employee activity
Restrict access to sensitive fields
Department and organisation-structure use cases

At minimum:

Create department
Edit department
Archive department
Assign department manager
Move employee between departments
Handle archived department members
Create job title
Create work location
Configure employment types
Assign reporting relationships
Remove manager
Reassign direct reports
Leave use cases

At minimum:

Create leave type
Configure leave policy
Assign leave allowance
View leave balance
Submit leave request
Submit half-day leave
Attach supporting document
Detect overlapping request
Detect insufficient balance
Review leave request
Approve leave
Reject leave
Cancel leave
Withdraw pending leave
Override decision as HR
View team leave calendar
Recalculate leave balance
Handle manager absence
Handle employee without manager
Handle leave spanning weekends and holidays
Attendance use cases

At minimum:

Clock in
Clock out
View current attendance state
View attendance history
View monthly summary
Correct attendance
Add manual attendance
Mark remote attendance
Handle missing clock-out
Handle duplicate clock-in
Handle overnight shift
Handle organisation timezone
Handle employee leave
Handle holiday
Export attendance where supported
Onboarding use cases

At minimum:

Create onboarding template
Add template task
Edit template
Archive template
Apply template to employee
Generate employee tasks
Assign task to employee
Assign task to manager
Assign task to HR
Complete task
Reopen task
Add task notes
View overdue tasks
Cancel onboarding
Handle changed joining date
Document use cases

At minimum:

Create document category
Upload employee document
View document metadata
Download document
Replace document
Archive document
Delete document
Restrict document visibility
Add expiry date
Trigger expiry warning
Handle invalid file type
Handle oversized file
Handle unauthorised access
Handle missing storage object
Payroll-record use cases

At minimum:

Create payroll period
Add employee payroll record
Add earnings
Add allowances
Add deductions
Calculate gross pay
Calculate net pay
Save draft payroll
Approve payroll
Mark payroll paid
Publish payslip
View payslip
Reopen payroll where permitted
Restrict payroll access
Handle decimal and rounding rules
Notification use cases

At minimum:

Create in-app notification
Mark notification read
Mark all notifications read
Notify manager of leave request
Notify employee of leave decision
Notify task owner
Notify document expiry
Notify employee of payslip
Handle failed email delivery
Prevent duplicate notifications
Audit use cases

At minimum:

Record administrative action
Record permission change
Record employee change
Record attendance correction
Record leave decision
Record document deletion
Record payroll approval
View audit log
Filter audit events
Protect audit records from modification
9. Use-case diagrams

Create:

docs/diagrams/use-case-diagrams.md

Use Mermaid where supported.

Produce separate use-case diagrams for:

Authentication and organisation setup
Employee management
Leave management
Attendance
Onboarding
Documents
Payroll
Notifications and audit
Employee self-service
Manager workflows
HR administrator workflows

Do not create one unreadable diagram containing the whole platform.

Each diagram should clearly show:

Actors
System boundary
Main use cases
Included use cases
Extended or exceptional use cases
Role-specific differences
10. User journeys

Create:

docs/product/user-journeys.md

Model complete journeys such as:

Owner onboarding journey

From first visit to configured organisation and first employee invitation.

HR administrator daily journey

From dashboard review to resolving leave, attendance, onboarding and document issues.

Employee first-week journey

From invitation acceptance to profile completion, onboarding, attendance and document access.

Manager leave-approval journey

From notification to approval and team-calendar update.

Monthly HR operations journey

From attendance review to payroll-record preparation and payslip publication.

For each journey include:

Starting context
User goal
Steps
System responses
Decision points
Friction risks
Error recovery
Success state
Related metrics
11. Sequence diagrams

Create:

docs/diagrams/sequence-diagrams.md

Use Mermaid sequence diagrams.

At minimum, create detailed sequence diagrams for:

Authentication
Account registration
Sign in
Session validation
Password reset
Invitation acceptance
Expired invitation
Organisation setup
Create organisation
Create owner membership
Apply default settings
Seed initial roles and policies
Reach dashboard
Employee creation

Include:

HR user
UI
Server action or API
Validation layer
Permission service
Employee service
Membership or account service
Database
Notification service
Audit service

Show both:

Employee with login access
Employee record without login access
Leave request

Include:

Employee
UI
API
Permission check
Leave-policy service
Balance service
Calendar or working-day service
Database
Notification service
Audit service
Manager
Leave approval

Show:

Manager access validation
Reporting relationship validation
Current request-state validation
Balance update
Notification
Audit event
Dashboard invalidation
Clock in and clock out

Show:

Current attendance-state lookup
Duplicate clock-in prevention
Timezone handling
Attendance record creation
Duration calculation
Audit requirements where applicable
Attendance correction

Show:

HR permission check
Original record
Corrected record
Reason requirement
Audit entry
Employee notification where appropriate
Onboarding assignment

Show:

Template selection
Relative due-date generation
Task ownership
Database transaction
Notifications
Audit event
Document upload

Show:

Client
Upload validation
Authorisation
Storage adapter
Database metadata
Failure cleanup
Audit service
Expiry notification scheduling
Document download

Show:

Permission validation
Tenant validation
Document visibility check
Signed or controlled access
Storage response
Payroll creation and publication

Show:

Draft creation
Calculation
Approval
Publication
Employee access
Notification
Audit event
Dashboard loading

Show:

Authenticated request
Organisation context
Aggregation queries
Permission-sensitive widgets
Caching strategy
Response

For every important sequence, include failure paths rather than only the ideal flow.

1. State-machine diagrams

Create:

docs/diagrams/state-machines.md

Use Mermaid state diagrams.

Model at minimum:

Employee lifecycle

Possible states:

Draft
Invited
Active
On leave
Suspended
Deactivated
Archived

Clearly define which states are actual stored states and which are derived states.

Invitation lifecycle
Created
Sent
Accepted
Expired
Revoked
Leave-request lifecycle
Draft
Pending
Approved
Rejected
Cancelled
Withdrawn

Define valid and invalid transitions.

Attendance-session lifecycle
Not clocked in
Clocked in
Clocked out
Missing clock-out
Corrected
Onboarding lifecycle
Not started
In progress
Completed
Overdue
Cancelled
Onboarding-task lifecycle
Pending
In progress
Completed
Reopened
Waived
Overdue
Document lifecycle
Active
Expiring
Expired
Replaced
Archived
Deleted
Payroll-period lifecycle
Draft
Under review
Approved
Published
Paid
Reopened
Archived

For each state machine document:

Entry conditions
Exit conditions
Allowed actors
Side effects
Notifications
Audit events
Data constraints
13. Business rules catalogue

Create:

docs/domain/business-rules.md

Assign stable IDs such as:

BR-AUTH-001
BR-ORG-001
BR-EMP-001
BR-LEAVE-001
BR-ATT-001

Document rules such as:

A user must have an active organisation membership
Every tenant-owned record must contain an organisation ID
Organisation IDs must come from authenticated context
Employees may exist without login accounts
Deactivated employees cannot sign in
A manager can approve leave only for authorised reports
Approved leave reduces or reserves balance according to the chosen model
Leave requests cannot overlap active leave requests
Attendance records use organisation timezone
An employee cannot clock in twice without clocking out
Attendance corrections require a reason
Payroll values must use decimal-safe calculations
Published payslips are immutable unless formally reopened
Audit records cannot be edited through normal application workflows
Sensitive documents require explicit visibility permissions

For each rule include:

Rule ID
Description
Reason
Enforcement location
Related use cases
Test requirements
14. Role and permissions matrix

Create:

docs/security/permissions-matrix.md

Build a complete matrix covering:

Owner
HR Administrator
Manager
Employee
Future platform administrator

Cover permissions such as:

Organisation settings
Membership management
Employee personal details
Employee employment details
Compensation
Payroll
Attendance
Attendance correction
Leave submission
Leave approval
Leave override
Onboarding
Documents
Sensitive documents
Audit logs
Notifications
Reports

For each permission define:

Permission key
Description
Allowed roles
Scope
Conditions
Sensitive fields
Server-side enforcement point
Expected denial behaviour

Use explicit permission keys such as:

employee.read
employee.write
employee.compensation.read
leave.request.create
leave.request.approve
attendance.correct
payroll.read
payroll.manage
audit.read

Do not rely only on broad role checks when a permission check is clearer.

1. Domain model

Create:

docs/domain/domain-model.md

Describe the main aggregates and ownership boundaries.

Possible aggregates include:

Organisation
Membership
Employee
Leave
Attendance
Onboarding
Document
Payroll
Notification
Audit

For each aggregate explain:

Aggregate root
Child entities
Invariants
Commands
Domain events
Repository boundary
Transaction boundary
Cross-aggregate interactions

Do not force full Domain-Driven Design if it creates unnecessary complexity. Use domain modelling where it improves clarity.

1. Entity relationship diagram

Create:

docs/diagrams/entity-relationship-diagram.md

Produce a Mermaid ER diagram.

Likely entities include:

User
Organisation
OrganisationMembership
Employee
Department
JobTitle
Location
EmploymentType
ReportingRelationship
Invitation
AttendanceRecord
LeaveType
LeavePolicy
LeaveBalance
LeaveRequest
LeaveApproval
HolidayCalendar
OnboardingTemplate
OnboardingTemplateTask
EmployeeOnboarding
EmployeeOnboardingTask
DocumentCategory
EmployeeDocument
PayrollPeriod
PayrollRecord
PayrollLineItem
Payslip
Notification
AuditLog
OrganisationSetting

For every entity define:

Primary key
Organisation ownership
Important fields
Foreign keys
Uniqueness constraints
Indexes
Soft-delete strategy
Audit timestamps
Sensitive data
Retention considerations

Explicitly identify entities that are:

Global
Organisation-owned
User-owned
Employee-owned
Immutable
Append-only
17. Data access and tenancy model

Create:

docs/security/tenant-isolation.md

Explain:

How organisation context is resolved
How memberships are validated
How tenant-owned queries are scoped
How cross-tenant access is prevented
Whether organisation IDs are passed into repository methods
How background jobs retain tenant context
How file storage is tenant-scoped
How caches are tenant-scoped
How audit events retain organisation context
How tests will attempt cross-tenant access

Create example safe and unsafe query patterns.

Never trust an organisation ID supplied by the browser without validating it against the authenticated session.

1. Architecture design

Create:

docs/architecture/system-architecture.md

Include:

System context
Container architecture
Application modules
Backend boundaries
Frontend boundaries
Authentication
Database
File storage
Notifications
Background jobs
Audit system
Testing
Deployment
Observability

Use Mermaid diagrams for:

System context diagram

Show:

Employee
Manager
HR administrator
Owner
HR Daddy
Email provider
File storage
Database
Future payroll or accounting integration
Container diagram

Show:

Browser application
Next.js application
Authentication layer
Domain services
Database
Object storage
Background worker if required
Email adapter
Component diagrams

Create separate diagrams for:

Authentication
Employee management
Leave
Attendance
Onboarding
Documents
Payroll
Notifications
Audit
19. Architecture decision records

Create:

docs/architecture/decisions/

Record important decisions as ADRs.

At minimum:

ADR-001: Application architecture
ADR-002: Database and ORM
ADR-003: Authentication strategy
ADR-004: Multi-tenant data isolation
ADR-005: Role and permission enforcement
ADR-006: Employee account versus employee record
ADR-007: Leave-balance calculation strategy
ADR-008: Attendance time and timezone strategy
ADR-009: Document storage abstraction
ADR-010: Notification architecture
ADR-011: Audit-log immutability
ADR-012: Payroll decimal and rounding strategy
ADR-013: API versus server-action boundaries
ADR-014: Testing strategy
ADR-015: Deployment model

Each ADR must contain:

Context
Decision
Alternatives considered
Consequences
Risks
Revisit conditions
20. API and interaction contracts

Create:

docs/architecture/api-contracts.md

Before implementation, define major commands and queries.

Examples:

Create organisation
Invite member
Create employee
Update employee
Assign manager
Submit leave request
Approve leave request
Reject leave request
Clock in
Clock out
Correct attendance
Apply onboarding template
Complete onboarding task
Upload document
Publish payroll record
Mark notification read

For each operation define:

Name
Actor
Permission
Input schema
Output schema
Validation
Errors
Side effects
Transaction boundary
Idempotency requirement
Notifications
Audit events

Define a consistent error model.

Possible error categories:

Authentication required
Permission denied
Resource not found
Invalid state transition
Validation error
Organisation mismatch
Conflict
Rate limited
Storage failure
Internal error
21. Event catalogue

Create:

docs/domain/domain-events.md

Document events such as:

OrganisationCreated
MemberInvited
InvitationAccepted
EmployeeCreated
EmployeeActivated
EmployeeDeactivated
ManagerAssigned
LeaveRequested
LeaveApproved
LeaveRejected
LeaveCancelled
AttendanceClockedIn
AttendanceClockedOut
AttendanceCorrected
OnboardingAssigned
OnboardingTaskCompleted
DocumentUploaded
DocumentExpiring
PayrollApproved
PayslipPublished

For each event include:

Producer
Trigger
Payload
Consumers
Notification effects
Audit effects
Retry behaviour
Idempotency considerations
Whether V1 handles it synchronously or asynchronously
22. Threat model and security design

Create:

docs/security/threat-model.md

Cover:

Cross-tenant data exposure
Insecure direct object references
Privilege escalation
Session theft
Weak password handling
Invitation abuse
File upload attacks
File URL leakage
Sensitive payroll exposure
Audit-log tampering
Mass assignment
Injection
Cross-site scripting
Cross-site request forgery
Rate-limit abuse
Sensitive information in logs
Misconfigured environment variables
Accidental production seed data
Broken access control in exports
Background-job tenant confusion

For each threat define:

Asset
Threat
Attack path
Likelihood
Impact
Mitigation
Verification method
23. Non-functional requirements

Create:

docs/product/non-functional-requirements.md

Define measurable requirements for:

Security
Privacy
Availability
Performance
Scalability
Accessibility
Maintainability
Observability
Testability
Portability
Responsiveness
Data integrity
Backup and recovery
Developer experience

Examples:

All tenant-owned queries must be scoped
Important pages should remain usable at mobile widths
Critical actions must create audit records
Main dashboard should avoid unnecessary query waterfalls
Production builds must pass type checking
Sensitive operations must enforce server-side permissions
Forms must have accessible labels and keyboard support
24. Edge-case catalogue

Create:

docs/product/edge-cases.md

Identify edge cases across all modules.

Examples:

Owner is also an employee
Employee has no login account
Employee has no manager
Manager is deactivated
Employee changes department during pending leave
Employee changes timezone
Organisation changes working days
Leave overlaps a public holiday
Leave is approved after balance changes
Employee clocks in before midnight and out after midnight
Attendance session remains open
Employee is deactivated during onboarding
Document expires after employee leaves
Payroll record exists for a deactivated employee
Invitation is accepted twice
User belongs to multiple organisations
Organisation is deleted or archived
A file uploads but database write fails
Database write succeeds but notification fails
Two managers approve the same request simultaneously

For every important edge case specify expected behaviour.

1. Reporting and dashboard model

Create:

docs/product/dashboard-metrics.md

Define each dashboard metric before implementation.

For every metric include:

Name
Definition
Source tables
Filters
Timezone behaviour
Role visibility
Empty-state behaviour
Drill-down destination

Metrics may include:

Active employees
Present today
On leave today
Pending leave requests
Missing clock-outs
Overdue onboarding tasks
Expiring documents
Current payroll status
Upcoming birthdays
Upcoming work anniversaries
Recent administrative activity

Do not implement decorative charts without a valid product use case.

1. UX and information architecture

Create:

docs/design/information-architecture.md

Define:

Main navigation
Role-specific navigation
Page hierarchy
URL structure
Breadcrumb rules
Global search
Notifications
Profile menu
Mobile navigation
Settings organisation

Create:

docs/design/page-inventory.md

For every page define:

Page name
Route
Allowed roles
Primary goal
Main actions
Data dependencies
Empty state
Loading state
Error state
Mobile behaviour
Related use cases

At minimum cover:

Sign in
Registration
Invitation acceptance
Organisation setup
Admin dashboard
Employee dashboard
Employee directory
Employee profile
Leave requests
Leave approval inbox
Leave calendar
Attendance
Onboarding
Documents
Payroll
Notifications
Audit log
Organisation settings
Personal settings
27. Wireframes and UI flows

Before producing polished UI, create low-fidelity wireframes or structured UI descriptions for the main workflows.

Create:

docs/design/wireframes.md

Cover:

Organisation onboarding
Admin dashboard
Employee directory
Employee profile
Leave submission
Leave approval
Clock in and clock out
Attendance correction
Onboarding checklist
Document upload
Payroll publication
Employee dashboard
Settings

For each page explain:

Information hierarchy
Main action
Secondary actions
Table or card behaviour
Responsive behaviour
Confirmation steps
Validation placement
Empty state
Error recovery
28. Technical stack

Inspect the repository first.

If the repository already has a suitable stack, preserve it unless there is a documented reason not to.

If the repository is empty, use a sensible default such as:

Next.js App Router
TypeScript
React
Tailwind CSS
shadcn/ui or an equivalent accessible component system
PostgreSQL
Prisma or Drizzle
Zod
Secure session-based authentication
Playwright
Vitest
Docker Compose

Prefer a modular monolith for V1.

Avoid unnecessary microservices.

The architecture should have clear boundaries between:

Presentation
Application services
Domain logic
Data access
Authentication
Authorisation
Storage
Notifications
Audit
Background processing
29. Implementation dependency map

Create:

docs/planning/dependency-map.md

Include a Mermaid dependency graph.

Show dependencies such as:

Authentication before protected routes
Organisation membership before employee management
Employee management before leave, attendance and onboarding
Departments before reporting relationships
Leave policy before leave requests
Attendance model before clock actions
Storage adapter before document workflows
Payroll period before payroll records
Domain events before notification consumers
Permission service before sensitive features

Identify:

Critical path
Parallelisable work
High-risk dependencies
Migration dependencies
External-service dependencies
30. Implementation roadmap

Create:

docs/planning/implementation-roadmap.md

Break work into milestones and small, verifiable tasks.

Every task should include:

Task ID
Goal
Related use cases
Dependencies
Files or modules affected
Acceptance criteria
Required tests
Browser-verification steps
Security checks
Definition of done

Do not create vague tasks such as “build leave management.”

Prefer tasks such as:

Create leave-type schema and organisation-scoped repository
Implement leave-request validation service
Implement overlapping-request check
Implement manager approval permission check
Implement leave-request state transition tests
Build leave-submission form
Verify leave submission in Playwright
31. Priority model

Use:

P0: Core foundation
Repository assessment
Product requirements
Domain glossary
Use-case catalogue
Permissions matrix
Business rules
Sequence diagrams
State machines
Domain model
ERD
Architecture
Threat model
API contracts
Implementation roadmap
Authentication
Organisation setup
Tenant isolation
Employee management
Leave
Attendance
Admin dashboard
Employee dashboard
Seed data
Tests
README
P1: Important operational modules
Onboarding
Documents
Notifications
Audit-log interface
Organisation settings
Manager inbox
Leave balances
Attendance corrections
P2: Extended V1
Payroll records
Payslips
Additional reports
Email delivery
Advanced filters
Additional customisation

Do not begin P2 while P0 workflows are unstable.

1. Planning quality review

Before implementation, perform a formal planning review.

Create:

docs/planning/planning-review.md

Check:

Are all major actors defined?
Are all P0 use cases documented?
Are permissions consistent?
Do sequence diagrams match the use cases?
Do state machines match business rules?
Does the ERD support all workflows?
Are tenant boundaries explicit?
Are sensitive fields identified?
Are audit requirements complete?
Are notification triggers complete?
Are edge cases handled?
Are API contracts consistent?
Are tasks small and testable?
Are any requirements contradictory?
Are any important decisions unresolved?
Is the plan too complex for V1?
Are any abstractions premature?

List:

Contradictions found
Missing decisions
Simplifications made
Risks accepted
Questions requiring user input
Final recommendation
33. Planning completion gate

Do not begin major production implementation until all of the following exist and are internally consistent:

Repository assessment
Product vision
V1 scope and non-goals
Personas
Domain glossary
Use-case catalogue
Use-case diagrams
User journeys
Sequence diagrams
State machines
Business-rules catalogue
Permissions matrix
Domain model
ER diagram
Tenant-isolation design
System architecture
Component diagrams
Architecture decision records
API contracts
Event catalogue
Threat model
Non-functional requirements
Edge-case catalogue
Dashboard metric definitions
Information architecture
Page inventory
Wireframes
Dependency map
Implementation roadmap
Planning review

After completing these documents:

Review them together
Resolve inconsistencies
Summarise the architecture
Summarise the proposed V1
List important assumptions
List questions that are genuinely blocking
If no blocking question exists, proceed automatically into foundation implementation

Do not ask for approval simply because the planning stage is complete.

1. Foundation implementation

After the planning gate passes, implement the technical foundation first.

Include:

Project structure
Environment validation
Database connection
Migrations
Seed infrastructure
Authentication
Session handling
Organisation context
Membership validation
Permission service
Tenant-scoped repositories
Error model
Audit service
Notification interface
Storage interface
Application shell
Design tokens
Testing infrastructure
Playwright configuration
CI checks
Development README

Do not begin broad feature work until this foundation is tested.

1. First vertical slice

The first complete vertical slice should be:

Owner signs in
Owner creates or accesses an organisation
HR administrator adds an employee
Employee record is persisted
Optional login invitation is created
Employee appears in the directory
Employee profile can be viewed
Employee details can be edited
Permissions are enforced
Cross-tenant access is rejected
Audit events are created
Notifications occur where required
Browser workflow passes
Tests pass

Use this slice to validate the architecture before implementing other major modules.

1. Feature implementation order

After the first slice:

Milestone 1
Authentication
Organisation setup
Memberships
Permissions
Employee directory
Employee profiles
Departments
Reporting relationships
Milestone 2
Leave policies
Leave balances
Leave requests
Approval workflow
Team calendar
Notifications
Audit events
Milestone 3
Attendance
Clock in
Clock out
History
Corrections
Timezone handling
Milestone 4
Onboarding
Templates
Assigned tasks
Completion
Overdue tracking
Milestone 5
Documents
Upload
Permissions
Storage
Expiry tracking
Milestone 6
Payroll records
Payroll periods
Line items
Approval
Payslips
Milestone 7
Dashboard refinement
Reporting
Responsive design
Accessibility
Security review
Performance review
Deployment
37. Browser-based verification

Configure Playwright or another available browser automation tool.

Use Chromium or installed Chrome.

For every important workflow:

Start the application
Open the workflow
Perform the complete action
Verify database persistence
Refresh the page
Verify state remains correct
Inspect console errors
Inspect network errors
Test validation
Test permission denial
Test empty state
Test loading state
Test error state
Test desktop width
Test tablet width
Test mobile width
Capture screenshots
Record defects
Fix defects
Run the test again

Do not assume a page works because it compiles.

1. Testing strategy

Create tests at multiple levels.

Unit tests

Test:

Business rules
State transitions
Permission checks
Leave calculations
Attendance duration
Payroll calculations
Tenant-scoping utilities
Integration tests

Test:

Organisation isolation
Employee creation
Leave approval
Attendance correction
Document permissions
Payroll permissions
Audit creation
Notification creation
End-to-end tests

Test complete user workflows.

At minimum:

Owner signs in
HR adds employee
Employee signs in
Employee clocks in
Employee clocks out
Employee submits leave
Manager approves leave
Employee sees approval
HR assigns onboarding
Employee completes task
HR uploads document
Employee accesses document
HR publishes payslip
Employee views payslip
39. Seeded demonstration organisation

Create a realistic demo organisation.

Suggested company:

Northstar Studios

Include:

Owner
HR administrator
Two managers
At least eight employees
Multiple departments
Job titles
Reporting relationships
Attendance history
Pending leave
Approved leave
Onboarding tasks
Documents
Payroll records
Notifications
Audit history

Use fictional information only.

Provide development credentials in the README.

1. Quality gates

Do not declare V1 complete until:

Planning documentation is complete
Diagrams are internally consistent
Database migrations work
Seed data works
Authentication works
Organisation isolation works
Permission checks work
Production build succeeds
Type checking succeeds
Linting succeeds
Critical tests pass
Browser workflows pass
Data persists
Dashboard metrics are real
Desktop layout works
Tablet layout works
Mobile layout works
Empty states exist
Loading states exist
Error states exist
Sensitive data is protected
Audit events are created
README is complete
Known limitations are documented
41. Definition of done

HR Daddy V1 is complete only when a reviewer can:

Understand the product from the documentation
Understand every major actor and use case
Understand the architecture and data model
Understand all major workflow sequences
Run the project
Sign in
Manage employees
Manage departments and reporting relationships
Submit and approve leave
Record attendance
Complete onboarding
Upload and access documents
Create and view payroll records
Use employee self-service
View notifications
View audit activity
Run tests
Build for production
Use the app on desktop and mobile
Confirm cross-tenant isolation

Static mock-ups, placeholder modules, frontend-only permissions or incomplete workflows do not count.

1. Decision-making rules

When facing ambiguity:

Prefer clarity before code.
Prefer documented assumptions.
Prefer secure and simple architecture.
Prefer complete workflows.
Prefer explicit permissions.
Prefer explicit state transitions.
Prefer tenant-safe data access.
Prefer maintainable modules.
Prefer measurable acceptance criteria.
Avoid unnecessary abstractions.
Avoid premature microservices.
Ask me only when genuinely blocked.
43. Final reporting

At the end of the planning stage, provide:

Product summary
V1 scope
Actor summary
Use-case summary
Architecture summary
Data-model summary
Security summary
Main sequence diagrams
Main state machines
Implementation roadmap
Major assumptions
Main risks
Blocking questions

At the end of implementation, provide:

What was built
Technology stack
Architecture
Completed workflows
Demo credentials
Setup instructions
Test results
Browser-verification results
Screenshots
Security review
Known limitations
Recommended V2 roadmap

Begin now.

First inspect the repository, workspace and Git state. Inspect JJT Portal if available. Then perform the complete planning and architecture stage. Do not start broad production implementation until the planning completion gate has passed and the documentation, diagrams, use cases, data model, permissions and architecture are internally consistent.
