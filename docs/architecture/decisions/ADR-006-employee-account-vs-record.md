# ADR-006: Employee Account vs Employee Record

**Status:** Accepted

## Context

Not all employees need platform login access. A company may track payroll and attendance for workers who never sign in (field staff, contractors). Additionally, a single user might be an employee in multiple organisations. The data model must separate the login identity from the employment record.

## Decision

Maintain **separate User and Employee entities**. User represents a login identity (email, password, sessions). Employee represents an employment record within an organisation (name, department, salary, status). They are linked via an optional `user_id` FK on Employee. An Employee can exist without a User (no login). A User can be linked to multiple Employees across organisations.

## Alternatives Considered

- **Single User/Employee entity** — simpler initially, but cannot represent employees without login or users in multiple organisations.
- **Employee extends User** — inheritance model creates awkward null states and breaks when employee leaves but user account remains.

## Consequences

- Employee records persist for compliance even after user account is disabled
- Invitation workflow creates User → links to pre-existing Employee record
- Deactivation revokes membership (User access) without deleting Employee data
- Queries for "my profile" require joining through membership → employee

## Risks

- Confusion between User.fullName and Employee.firstName/lastName (mitigated: clear naming, documentation)
- Orphaned Employee records if User is deleted (mitigated: User is never hard-deleted)

## Revisit Conditions

- If the distinction causes excessive join complexity in common queries
- If SSO integration requires rethinking the User entity's role
