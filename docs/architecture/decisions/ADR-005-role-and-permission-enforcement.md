# ADR-005: Role and Permission Enforcement

**Status:** Accepted

## Context

HR Daddy has four roles (Owner, HR Admin, Manager, Employee) with complex scoping rules: organisation-wide, team-scoped, and own-record-only. Permissions must be checked server-side on every operation. The system must support conditional permissions gated by organisation settings.

## Decision

Use **RBAC with explicit permission keys** checked via a `PermissionService`. Each permission is a dot-notation key (e.g., `employee.compensation.read`). The service resolves the user's role from their membership, evaluates the permission against a static permission matrix, and applies scope filtering. Permission checks happen in server actions before business logic executes.

## Alternatives Considered

- **Simple role-name checks** (`if role === 'admin'`) — brittle, scattered logic, no scoping support, hard to audit.
- **ABAC (Attribute-Based Access Control)** — powerful but over-engineered for V1's four-role model; adds policy engine complexity.
- **Casbin / OPA** — external policy engines add deployment dependencies and learning curve.

## Consequences

- Centralised permission logic; adding a new permission means updating the matrix and service
- Scoping (own/team/org) is handled uniformly across all modules
- Conditional permissions (org settings) are evaluated at check time
- Permission denial responses include the required permission key (aids debugging)

## Risks

- Permission matrix becomes large over time (mitigated: modular grouping by domain)
- Adding a new role requires reviewing all permissions (mitigated: Owner is a superset; new roles subtract)

## Revisit Conditions

- If custom roles or per-org permission customisation is required
- If permission checks become a performance bottleneck (pre-compute role→permission set)
- If platform-level roles (System Admin) need a separate permission namespace
