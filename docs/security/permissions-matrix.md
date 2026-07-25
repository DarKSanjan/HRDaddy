# Permissions Matrix

This matrix is generated from the actual permission definitions in `src/core/permissions/kernel.ts` and `src/modules/*/manifest.ts`. Each row represents a permission key as declared via `defineModule()` or `registerPermissions()`. Columns indicate which roles are granted the permission by default.

## Roles

| Role | Description |
|------|-------------|
| OWNER | Organisation owner. Full administrative access. |
| HR_ADMIN | Human Resources administrator. Full operational access. |
| MANAGER | People manager. Team-scoped access. |
| EMPLOYEE | Standard employee. Self-scoped access. |

## Legend

- ✓ = Granted by default
- ✗ = Not granted
- 🔒 = Sensitive permission (audit-significant; flagged in UI)

---

## Core (always enabled)

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| org.view | View organisation details | ✓ | ✓ | ✓ | ✓ |
| org.edit | Edit organisation details | ✓ | ✓ | ✗ | ✗ |
| org.manage_settings | Change organisation settings | ✓ | ✓ | ✗ | ✗ |
| org.manage_members | Add, remove and re-role organisation members | ✓ | ✓ | ✗ | ✗ |
| org.manage_modules | Enable and disable modules for the organisation | ✓ | ✗ | ✗ | ✗ |
| org.invite | Invite people to the organisation | ✓ | ✓ | ✗ | ✗ |
| org.transfer_ownership | Transfer ownership of the organisation | ✓ | ✗ | ✗ | ✗ |
| notification.view_own | View own notifications | ✓ | ✓ | ✓ | ✓ |
| audit.view | View the audit log | ✓ | ✓ | ✗ | ✗ | 🔒 |

---

## Employees Module (required: true, dependsOn: [])

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| employee.view_all | View all employees | ✓ | ✓ | ✗ | ✗ |
| employee.view_own | View own employee profile | ✓ | ✓ | ✓ | ✓ |
| employee.view_team | View team members | ✓ | ✓ | ✓ | ✗ |
| employee.create | Create employees | ✓ | ✓ | ✗ | ✗ |
| employee.edit | Edit employee records | ✓ | ✓ | ✗ | ✗ |
| employee.archive | Archive employees | ✓ | ✓ | ✗ | ✗ |
| department.view | View departments | ✓ | ✓ | ✓ | ✓ |
| department.manage | Create/edit departments | ✓ | ✓ | ✗ | ✗ |

---

## Leave Module (dependsOn: ['employees'])

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| leave.request.create | Submit leave requests | ✓ | ✓ | ✓ | ✓ |
| leave.request.approve | Approve/reject leave requests | ✓ | ✓ | ✓ | ✗ |
| leave.request.override | Override leave decisions | ✓ | ✓ | ✗ | ✗ |
| leave.balance.view_own | View own leave balance | ✓ | ✓ | ✓ | ✓ |
| leave.balance.view_all | View all leave balances | ✓ | ✓ | ✗ | ✗ |
| leave.type.manage | Manage leave types | ✓ | ✓ | ✗ | ✗ |
| leave.policy.manage | Manage leave policies | ✓ | ✓ | ✗ | ✗ |
| leave.calendar.view_team | View team leave calendar | ✓ | ✓ | ✓ | ✗ |

---

## Attendance Module (dependsOn: ['employees'])

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| attendance.clock | Clock in and out | ✓ | ✓ | ✓ | ✓ |
| attendance.view_own | View own attendance records | ✓ | ✓ | ✓ | ✓ |
| attendance.view_team | View team attendance | ✓ | ✓ | ✓ | ✗ |
| attendance.view_all | View all attendance records | ✓ | ✓ | ✗ | ✗ |
| attendance.correct | Correct attendance entries | ✓ | ✓ | ✗ | ✗ |
| attendance.manual_add | Add manual attendance entries | ✓ | ✓ | ✗ | ✗ |
| attendance.export | Export attendance data | ✓ | ✓ | ✓ | ✗ |

---

## Onboarding Module (dependsOn: ['employees'])

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| onboarding.template.manage | Manage onboarding templates | ✓ | ✓ | ✗ | ✗ |
| onboarding.template.view | View onboarding templates | ✓ | ✓ | ✓ | ✗ |
| onboarding.assign | Assign onboarding to employees | ✓ | ✓ | ✗ | ✗ |
| onboarding.cancel | Cancel onboarding processes | ✓ | ✓ | ✗ | ✗ |
| onboarding.complete_task | Complete onboarding tasks | ✓ | ✓ | ✓ | ✓ |
| onboarding.view_all | View all onboarding progress | ✓ | ✓ | ✗ | ✗ |

---

## Documents Module (dependsOn: ['employees'])

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| document.upload | Upload documents | ✓ | ✓ | ✗ | ✗ |
| document.view_all | View all employee documents | ✓ | ✓ | ✗ | ✗ |
| document.view_own | View own documents | ✓ | ✓ | ✓ | ✓ |
| document.category.manage | Manage document categories | ✓ | ✓ | ✗ | ✗ |
| document.archive | Archive documents | ✓ | ✓ | ✗ | ✗ |
| document.delete | Delete archived documents | ✓ | ✓ | ✗ | ✗ | 🔒 |

---

## Payroll Module (dependsOn: ['employees'])

| Permission Key | Description | OWNER | HR_ADMIN | MANAGER | EMPLOYEE |
|---------------|-------------|-------|----------|---------|----------|
| payroll.process | Process payroll runs | ✓ | ✓ | ✗ | ✗ |
| payroll.approve | Approve payroll for payment | ✓ | ✗ | ✗ | ✗ |
| payroll.view_all | View all payslips | ✓ | ✓ | ✗ | ✗ | 🔒 |
| payroll.view_own | View own payslips | ✓ | ✓ | ✓ | ✓ |

---

## Permission Resolution Rules

1. **Core permissions** are always resolved regardless of which modules are enabled.
2. **Module permissions** are only resolved if the module is enabled for the organisation (`organisation_modules.enabled = true`).
3. A permission belonging to a disabled module is **never granted**, even to OWNER.
4. The `required` flag on the employees module means its permissions are always available.
5. `resolvePermissions(role, enabledModules)` returns a `Set<string>` of all granted keys for the given role + enabled module combination.

---

## Total Permission Count

| Module | Count |
|--------|-------|
| Core | 9 |
| Employees | 8 |
| Leave | 8 |
| Attendance | 7 |
| Onboarding | 6 |
| Documents | 6 |
| Payroll | 4 |
| **Total** | **48** |
