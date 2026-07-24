# Information Architecture — HR Daddy V1

This document defines the navigation structure, page hierarchy, URL patterns, breadcrumbs, global UI elements, and mobile navigation for all roles.

---

## 1. Main Navigation Structure (Sidebar)

HR Daddy uses a persistent left sidebar on desktop (collapsed on tablet, hidden on mobile). The sidebar contains:

1. **Organisation logo/name** — Top of sidebar, links to role-appropriate dashboard
2. **Primary navigation** — Role-filtered links to main modules
3. **Utility section** — Bottom of sidebar: settings, help, sign-out

### Sidebar Layout

```
┌─────────────────────────┐
│ [Logo] Northstar Studios│
│ ─────────────────────── │
│ 🏠 Dashboard            │
│ 👥 Employees            │
│ 🗓️ Leave                │
│ ⏰ Attendance           │
│ 📋 Onboarding           │
│ 📄 Documents            │
│ 💰 Payroll              │
│ 📊 Reports              │
│ 🔔 Notifications        │
│ 📜 Audit Log            │
│                         │
│ ─────────────────────── │
│ ⚙️ Settings             │
│ ❓ Help                  │
│ 🚪 Sign Out             │
└─────────────────────────┘
```

---

## 2. Role-Specific Navigation Items

Each role sees only the sidebar items they have permission to access. The system renders navigation server-side based on the user's role and permissions.

### Owner

| Nav Item | Destination | Icon |
|----------|-------------|------|
| Dashboard | Admin dashboard | Home |
| Employees | Employee directory | Users |
| Leave | Leave management (all requests, calendar, policies) | Calendar |
| Attendance | Organisation attendance (all records, corrections) | Clock |
| Onboarding | Onboarding templates and all active processes | Clipboard |
| Documents | All employee documents | File |
| Payroll | Payroll periods and records | DollarSign |
| Notifications | Own notifications | Bell |
| Audit Log | Organisation audit trail | Shield |
| Settings | Organisation + personal settings | Gear |

### HR Administrator

| Nav Item | Destination | Icon |
|----------|-------------|------|
| Dashboard | Admin dashboard | Home |
| Employees | Employee directory | Users |
| Leave | Leave management (all requests, calendar, policies) | Calendar |
| Attendance | Organisation attendance (all records, corrections) | Clock |
| Onboarding | Onboarding templates and all active processes | Clipboard |
| Documents | All employee documents | File |
| Payroll | Payroll periods and records | DollarSign |
| Notifications | Own notifications | Bell |
| Audit Log | Organisation audit trail | Shield |
| Settings | Personal settings only (org settings read-only) | Gear |

### Manager

| Nav Item | Destination | Icon |
|----------|-------------|------|
| Dashboard | Manager dashboard (team focus) | Home |
| My Team | Direct reports list | Users |
| Leave | Team leave requests + own leave | Calendar |
| Attendance | Team attendance + own | Clock |
| Onboarding | Team onboarding tasks | Clipboard |
| Documents | Own documents | File |
| Payslips | Own payslips | DollarSign |
| Notifications | Own notifications | Bell |
| Settings | Personal settings | Gear |

### Employee

| Nav Item | Destination | Icon |
|----------|-------------|------|
| Dashboard | Employee dashboard (personal) | Home |
| Directory | Employee directory (limited view) | Users |
| Leave | Own leave requests + balance | Calendar |
| Attendance | Own attendance | Clock |
| Onboarding | Own onboarding tasks | Clipboard |
| Documents | Own documents | File |
| Payslips | Own payslips | DollarSign |
| Notifications | Own notifications | Bell |
| Settings | Personal settings | Gear |

---

## 3. Page Hierarchy

```
HR Daddy
├── Public Pages
│   ├── Sign In
│   ├── Register
│   ├── Forgot Password
│   ├── Reset Password
│   ├── Accept Invitation
│   └── Verify Email
│
├── Organisation Setup (post-registration, no-org state)
│   ├── Create Organisation
│   └── Setup Wizard
│       ├── Regional Settings
│       ├── Working Schedule
│       ├── Leave Year
│       ├── Departments
│       ├── Job Titles
│       └── Review Summary
│
├── Authenticated (within organisation context)
│   ├── Dashboard
│   │   ├── Admin Dashboard (Owner, HR Admin)
│   │   ├── Manager Dashboard (Manager)
│   │   └── Employee Dashboard (all)
│   │
│   ├── Employees
│   │   ├── Directory (list/grid)
│   │   ├── Employee Profile
│   │   │   ├── Overview
│   │   │   ├── Personal Details
│   │   │   ├── Employment Details
│   │   │   ├── Compensation
│   │   │   ├── Documents
│   │   │   ├── Leave History
│   │   │   ├── Attendance History
│   │   │   └── Onboarding
│   │   ├── Add Employee
│   │   └── Edit Employee
│   │
│   ├── Leave
│   │   ├── My Leave (own requests + balance)
│   │   ├── Submit Request
│   │   ├── Approval Inbox (Manager/HR/Owner)
│   │   ├── All Requests (HR/Owner)
│   │   ├── Team Calendar
│   │   ├── Leave Types (HR/Owner)
│   │   └── Leave Policies (HR/Owner)
│   │
│   ├── Attendance
│   │   ├── My Attendance (own clock + history)
│   │   ├── Team Attendance (Manager)
│   │   ├── All Attendance (HR/Owner)
│   │   ├── Corrections (HR/Owner)
│   │   └── Monthly Summary
│   │
│   ├── Onboarding
│   │   ├── My Tasks (own onboarding tasks)
│   │   ├── All Onboarding (HR/Owner)
│   │   ├── Templates (HR/Owner)
│   │   │   ├── Template List
│   │   │   ├── Create Template
│   │   │   └── Edit Template
│   │   └── Assign Onboarding (HR/Owner)
│   │
│   ├── Documents
│   │   ├── My Documents (own)
│   │   ├── All Documents (HR/Owner)
│   │   ├── Upload Document
│   │   └── Categories (HR/Owner)
│   │
│   ├── Payroll
│   │   ├── Payroll Periods (HR/Owner)
│   │   ├── Period Detail (records within a period)
│   │   ├── Employee Payroll Record
│   │   ├── My Payslips (all roles — own only)
│   │   └── Publish Payslips
│   │
│   ├── Notifications
│   │   └── Notification Centre
│   │
│   ├── Audit Log (HR/Owner)
│   │   └── Audit Event List (filterable)
│   │
│   └── Settings
│       ├── Organisation Settings (Owner; read-only for HR Admin)
│       │   ├── General (name, timezone, currency)
│       │   ├── Working Schedule
│       │   ├── Leave Configuration
│       │   ├── Branding
│       │   ├── Members & Roles
│       │   ├── Departments
│       │   ├── Job Titles
│       │   ├── Locations
│       │   └── Security (sensitive access toggles)
│       └── Personal Settings
│           ├── Profile
│           ├── Password
│           ├── Notifications Preferences
│           └── Sessions
```

---

## 4. URL Structure

All authenticated routes are scoped under `/org/[orgId]` to enforce tenant context in the URL, support multi-organisation switching, and make deep-linking unambiguous.

### Pattern

```
/org/[orgId]/[module]/[subpage?]/[resourceId?]/[action?]
```

### Complete URL Map

| Page | Route | Notes |
|------|-------|-------|
| **Public** | | |
| Sign In | `/sign-in` | |
| Register | `/register` | |
| Forgot Password | `/forgot-password` | |
| Reset Password | `/reset-password?token=[token]` | |
| Verify Email | `/verify-email?token=[token]` | |
| Accept Invitation | `/invitation/[token]` | |
| **Organisation Setup** | | |
| Create Organisation | `/create-org` | |
| Setup Wizard | `/setup` | Steps managed client-side |
| **Dashboard** | | |
| Admin Dashboard | `/org/[orgId]/dashboard` | Role-switch renders correct dashboard |
| Manager Dashboard | `/org/[orgId]/dashboard` | Same route, content adapts |
| Employee Dashboard | `/org/[orgId]/dashboard` | Same route, content adapts |
| **Employees** | | |
| Employee Directory | `/org/[orgId]/employees` | |
| Employee Profile | `/org/[orgId]/employees/[employeeId]` | |
| Employee Profile Tab | `/org/[orgId]/employees/[employeeId]/[tab]` | tab: personal, employment, compensation, documents, leave, attendance, onboarding |
| Add Employee | `/org/[orgId]/employees/new` | |
| Edit Employee | `/org/[orgId]/employees/[employeeId]/edit` | |
| **Leave** | | |
| My Leave | `/org/[orgId]/leave` | Default view: own requests |
| Submit Leave Request | `/org/[orgId]/leave/new` | |
| Leave Request Detail | `/org/[orgId]/leave/requests/[requestId]` | |
| Approval Inbox | `/org/[orgId]/leave/approvals` | |
| All Requests | `/org/[orgId]/leave/all` | |
| Team Calendar | `/org/[orgId]/leave/calendar` | |
| Leave Types | `/org/[orgId]/leave/types` | |
| Leave Policies | `/org/[orgId]/leave/policies` | |
| **Attendance** | | |
| My Attendance | `/org/[orgId]/attendance` | Default: own view with clock |
| Team Attendance | `/org/[orgId]/attendance/team` | |
| All Attendance | `/org/[orgId]/attendance/all` | |
| Corrections | `/org/[orgId]/attendance/corrections` | |
| Monthly Summary | `/org/[orgId]/attendance/summary` | |
| **Onboarding** | | |
| My Tasks | `/org/[orgId]/onboarding` | Default: own tasks |
| All Onboarding | `/org/[orgId]/onboarding/all` | |
| Templates | `/org/[orgId]/onboarding/templates` | |
| Create Template | `/org/[orgId]/onboarding/templates/new` | |
| Edit Template | `/org/[orgId]/onboarding/templates/[templateId]/edit` | |
| Assign Onboarding | `/org/[orgId]/onboarding/assign` | |
| **Documents** | | |
| My Documents | `/org/[orgId]/documents` | Default: own docs |
| All Documents | `/org/[orgId]/documents/all` | |
| Upload Document | `/org/[orgId]/documents/upload` | |
| Categories | `/org/[orgId]/documents/categories` | |
| **Payroll** | | |
| Payroll Periods | `/org/[orgId]/payroll` | |
| Period Detail | `/org/[orgId]/payroll/[periodId]` | |
| Employee Record | `/org/[orgId]/payroll/[periodId]/[employeeId]` | |
| My Payslips | `/org/[orgId]/payslips` | |
| Payslip Detail | `/org/[orgId]/payslips/[payslipId]` | |
| **Notifications** | | |
| Notification Centre | `/org/[orgId]/notifications` | |
| **Audit** | | |
| Audit Log | `/org/[orgId]/audit` | |
| **Settings** | | |
| Organisation Settings | `/org/[orgId]/settings` | |
| Org General | `/org/[orgId]/settings/general` | |
| Org Working Schedule | `/org/[orgId]/settings/schedule` | |
| Org Leave Config | `/org/[orgId]/settings/leave` | |
| Org Branding | `/org/[orgId]/settings/branding` | |
| Members & Roles | `/org/[orgId]/settings/members` | |
| Departments | `/org/[orgId]/settings/departments` | |
| Job Titles | `/org/[orgId]/settings/job-titles` | |
| Locations | `/org/[orgId]/settings/locations` | |
| Org Security | `/org/[orgId]/settings/security` | |
| Personal Settings | `/org/[orgId]/settings/personal` | |
| Personal Profile | `/org/[orgId]/settings/personal/profile` | |
| Change Password | `/org/[orgId]/settings/personal/password` | |
| Notification Prefs | `/org/[orgId]/settings/personal/notifications` | |
| Active Sessions | `/org/[orgId]/settings/personal/sessions` | |

---

## 5. Breadcrumb Rules

Breadcrumbs provide hierarchical context and navigation aid. They appear below the page header on all authenticated pages.

### Rules

1. **Always show organisation name as root**: `Northstar Studios > ...`
2. **Module level**: Shows the module name matching sidebar nav item.
3. **Resource level**: Shows the resource name (e.g., employee name, template name).
4. **Action level**: Shows the action verb (e.g., "Edit", "New").
5. **Maximum depth**: 4 levels (org > module > resource > action).
6. **All breadcrumb items are clickable** except the current page (displayed as plain text).
7. **Mobile**: Breadcrumbs collapse to "< Back to [parent]" link.

### Examples

| Page | Breadcrumb |
|------|------------|
| Employee Directory | Northstar Studios > Employees |
| Employee Profile | Northstar Studios > Employees > John Smith |
| Edit Employee | Northstar Studios > Employees > John Smith > Edit |
| Leave Approval Inbox | Northstar Studios > Leave > Approvals |
| Leave Request Detail | Northstar Studios > Leave > Requests > REQ-2024-001 |
| Payroll Period | Northstar Studios > Payroll > March 2024 |
| Onboarding Template | Northstar Studios > Onboarding > Templates > New Hire Standard |
| Org Settings General | Northstar Studios > Settings > General |
| Personal Profile | Northstar Studios > Settings > Personal > Profile |

---

## 6. Global Search

A search input in the header bar provides quick navigation and entity lookup.

### Behaviour

- **Position**: Top header bar, centre-aligned, expands on focus.
- **Shortcut**: `Cmd+K` / `Ctrl+K` opens search overlay.
- **Search scope**: Searches within the current organisation only.
- **Searchable entities** (role-dependent):
  - Employees (name, email, employee number, job title)
  - Departments
  - Documents (filename, description)
  - Leave requests (by employee name)
  - Pages (fuzzy match on page names for navigation)

### Search Results

Results are grouped by category:

```
┌──────────────────────────────────┐
│ 🔍 "john"                        │
│ ──────────────────────────────── │
│ EMPLOYEES                        │
│   John Smith — Software Engineer │
│   John Doe — Designer            │
│ PAGES                            │
│   Employee Directory             │
│ DOCUMENTS                        │
│   John_Smith_Contract.pdf        │
└──────────────────────────────────┘
```

### Permissions in Search

- Results are filtered by the user's permissions
- Employee search: all roles see basic results; Employees only see name/title (not sensitive fields)
- Document search: only returns documents the user can access
- Payroll records: never appear in search results (requires explicit navigation)

---

## 7. Notification Bell

A notification bell icon in the header provides real-time awareness of pending items.

### Behaviour

- **Position**: Header bar, right side, before profile avatar.
- **Badge**: Red dot with unread count (capped at "99+").
- **Click action**: Opens a dropdown panel showing the 10 most recent notifications.
- **Dropdown contents**:
  - Notification list (type icon, message, timestamp, read/unread state)
  - "Mark all as read" action at the top
  - "View all notifications" link at the bottom (navigates to `/org/[orgId]/notifications`)
- **Real-time updates**: Badge count updates via polling (30-second interval in V1; WebSocket in future).

### Notification Types

| Type | Icon | Example Message |
|------|------|-----------------|
| Leave Request | Calendar | "Alex requested 3 days annual leave (12-14 Mar)" |
| Leave Decision | CheckCircle/XCircle | "Your leave request was approved by David" |
| Onboarding Task | Clipboard | "New task assigned: Complete IT setup for Alex" |
| Document Expiry | AlertTriangle | "John's passport expires in 30 days" |
| Payslip Published | DollarSign | "Your March 2024 payslip is available" |
| Attendance Alert | Clock | "Missing clock-out detected for yesterday" |
| System | Info | "Welcome to HR Daddy! Complete your profile" |

---

## 8. Profile Menu

A user avatar/initials in the top-right header corner provides account-level actions.

### Dropdown Contents

```
┌────────────────────────────┐
│ 👤 Sarah Thompson          │
│    sarah@northstar.io      │
│    Owner                   │
│ ─────────────────────────  │
│ 🏢 Northstar Studios      │ ← current org (if multi-org)
│ ─────────────────────────  │
│ 👤 My Profile              │
│ ⚙️ Personal Settings       │
│ 🔐 Change Password         │
│ ─────────────────────────  │
│ 🚪 Sign Out                │
└────────────────────────────┘
```

### Rules

1. Shows user's full name, email, and current role.
2. Shows current organisation name (clickable to org switcher if user belongs to multiple orgs).
3. "My Profile" navigates to the user's own employee profile page.
4. "Personal Settings" navigates to `/org/[orgId]/settings/personal`.
5. "Change Password" navigates to `/org/[orgId]/settings/personal/password`.
6. "Sign Out" ends the session and redirects to `/sign-in`.

---

## 9. Mobile Navigation

On viewports below 768px, the desktop sidebar is replaced with a bottom tab bar and a hamburger menu.

### Bottom Tab Bar (5 Items)

The bottom tab bar provides instant access to the most frequently used pages. Tabs are role-specific:

**Employee**:
| Tab | Icon | Destination |
|-----|------|-------------|
| Home | Home | Employee Dashboard |
| Leave | Calendar | My Leave |
| Clock | Clock | My Attendance (clock in/out) |
| Docs | File | My Documents |
| More | Menu | Hamburger overlay |

**Manager**:
| Tab | Icon | Destination |
|-----|------|-------------|
| Home | Home | Manager Dashboard |
| Team | Users | My Team |
| Approvals | CheckSquare | Leave Approvals |
| Clock | Clock | My Attendance |
| More | Menu | Hamburger overlay |

**HR Admin / Owner**:
| Tab | Icon | Destination |
|-----|------|-------------|
| Home | Home | Admin Dashboard |
| Employees | Users | Employee Directory |
| Leave | Calendar | Leave Management |
| Clock | Clock | Attendance |
| More | Menu | Hamburger overlay |

### Hamburger Menu (More Tab)

Tapping "More" opens a full-screen overlay containing all navigation items not in the bottom bar:

```
┌─────────────────────────────────┐
│ ✕ Close                         │
│ ─────────────────────────────── │
│ 📋 Onboarding                   │
│ 📄 Documents                    │
│ 💰 Payroll / Payslips           │
│ 🔔 Notifications          (3)  │
│ 📜 Audit Log                    │
│ ─────────────────────────────── │
│ ⚙️ Settings                     │
│ 👤 My Profile                   │
│ 🚪 Sign Out                     │
└─────────────────────────────────┘
```

### Mobile Header

- Simplified header: organisation name (truncated) + notification bell + profile avatar
- No search bar in header on mobile; search accessible from a search icon that opens full-screen search overlay
- Breadcrumbs become a "< Back" link

---

## 10. Settings Organisation

Settings are split into two categories accessible from the Settings nav item:

### Organisation Settings (Owner — full access; HR Admin — read-only)

Organised as a sidebar-within-a-page (on desktop) or a list menu (on mobile):

| Section | Description | Access |
|---------|-------------|--------|
| General | Organisation name, timezone, currency, date format | Owner write; HR Admin read |
| Working Schedule | Working days, working hours | Owner write; HR Admin read |
| Leave Configuration | Leave year start, carry-over rules, default policies | Owner write; HR Admin read |
| Branding | Logo, primary colour, display name | Owner + HR Admin write |
| Members & Roles | Invite, remove, change roles | Owner full; HR Admin invite only |
| Departments | Create, edit, archive departments | Owner + HR Admin write |
| Job Titles | Create, edit, archive titles | Owner + HR Admin write |
| Locations | Create, edit, archive locations | Owner + HR Admin write |
| Security | Toggle HR Admin sensitive access, payroll approve, audit export | Owner only |

### Personal Settings (All Roles)

| Section | Description |
|---------|-------------|
| Profile | Display name, avatar, phone |
| Password | Change password (requires current password) |
| Notification Preferences | Toggle email notifications per type, in-app sound |
| Active Sessions | View and revoke active sessions |

### Navigation Pattern

- Desktop: Settings page has a left sub-navigation with sections listed
- Tablet: Same as desktop but sub-nav collapses
- Mobile: Settings landing shows a list of sections; tapping a section navigates to that page

---

## 11. Organisation Switcher (Future Multi-Org Support)

If a user belongs to multiple organisations, the organisation name in the sidebar and profile menu becomes a switcher.

### Behaviour (designed for V1 but multi-org is V2)

- Click on organisation name opens a dropdown listing all organisations the user belongs to.
- Switching organisation triggers a full page reload to `/org/[newOrgId]/dashboard`.
- The session validates membership for the target organisation.
- V1: Most users will have one organisation. The switcher UI is prepared but not prominently surfaced.

---

## 12. Empty State Philosophy

Every page that can have no data should display a meaningful empty state rather than a blank page. Empty states include:

1. **Illustration or icon** — Visual indicator that there's no data, not an error
2. **Headline** — What this page shows (e.g., "No employees yet")
3. **Description** — Brief explanation of what the user can do
4. **Primary action** — Button to create the first item (e.g., "Add Employee")
5. **Help link** — Optional link to documentation

---

## 13. Loading State Philosophy

All data-dependent pages show:

1. **Skeleton screens** — Layout-preserving placeholder content (grey shapes matching expected content)
2. **No spinner-only pages** — Users should always see the page structure, even while data loads
3. **Progressive loading** — Header and nav load immediately; content area shows skeleton
4. **Timeout handling** — If data takes >5 seconds, show a retry option

---

## 14. Error State Philosophy

When data fails to load:

1. **Inline error** — Within the content area (not a full-page error unless authentication fails)
2. **Error message** — Clear description of what went wrong
3. **Retry action** — Button to retry the failed request
4. **Fallback navigation** — Sidebar and header remain functional so user can navigate away
5. **Permission errors** — Redirect to role-appropriate dashboard with toast notification

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Initial | Complete information architecture for V1 | HR Daddy Design |
