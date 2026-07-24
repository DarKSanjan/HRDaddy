# Page Inventory — HR Daddy V1

This document defines every page in the application with its route, allowed roles, primary goal, main actions, data dependencies, states, and mobile behaviour.

---

## 1. Sign In

| Property | Value |
|----------|-------|
| **Route** | `/sign-in` |
| **Allowed Roles** | Public (unauthenticated users) |
| **Primary Goal** | Authenticate user and establish session |
| **Main Actions** | Submit credentials, navigate to forgot password, navigate to register |
| **Data Dependencies** | None (form submission validates against user table) |
| **Empty State** | N/A |
| **Loading State** | Button shows spinner on submit; form disabled |
| **Error State** | Inline error below form: "Invalid email or password"; account locked message after 5 failures |
| **Mobile Behaviour** | Full-width centred card; no sidebar/header; keyboard-aware scroll |

---

## 2. Register

| Property | Value |
|----------|-------|
| **Route** | `/register` |
| **Allowed Roles** | Public (unauthenticated users) |
| **Primary Goal** | Create a new user account |
| **Main Actions** | Submit registration form, navigate to sign in |
| **Data Dependencies** | None |
| **Empty State** | N/A |
| **Loading State** | Button spinner on submit |
| **Error State** | Inline validation (email taken, weak password); generic server error with retry |
| **Mobile Behaviour** | Full-width centred card; password strength indicator below field |

---

## 3. Accept Invitation

| Property | Value |
|----------|-------|
| **Route** | `/invitation/[token]` |
| **Allowed Roles** | Public (anyone with a valid token) |
| **Primary Goal** | Accept org invitation and create account or link existing account |

| **Main Actions** | Set password (new user) or confirm join (existing user) |
| **Data Dependencies** | Invitation record (token lookup: org name, role, inviter, expiry) |
| **Empty State** | N/A |
| **Loading State** | Skeleton showing org name and role while token validates |
| **Error State** | Expired token: message + "Request new invitation" prompt; invalid token: generic error |
| **Mobile Behaviour** | Full-width card; shows org name and assigned role prominently |

---

## 4. Organisation Setup

| Property | Value |
|----------|-------|
| **Route** | `/create-org` and `/setup` |
| **Allowed Roles** | Authenticated users with no organisation |
| **Primary Goal** | Create and configure a new organisation |
| **Main Actions** | Enter org name, configure timezone/currency/schedule/leave year, create departments/titles, complete wizard |
| **Data Dependencies** | Authenticated user session; timezone list; currency list |
| **Empty State** | N/A (wizard is always populated with defaults) |
| **Loading State** | Step transitions show brief skeleton; dropdowns load async |
| **Error State** | Inline validation per field; transaction error shows retry |
| **Mobile Behaviour** | Single-column wizard; step indicator at top; large touch targets for toggles |

---

## 5. Admin Dashboard

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/dashboard` |
| **Allowed Roles** | Owner, HR Administrator |
| **Primary Goal** | Organisation-wide operational overview; surface items needing attention |
| **Main Actions** | View metrics, click-through to pending items, quick-add employee |
| **Data Dependencies** | Employee count, present today, on leave today, pending leave requests, missing clock-outs, overdue onboarding, expiring documents, payroll status, recent audit activity |
| **Empty State** | First-use: "Welcome! Get started by adding your first employee" with CTA buttons |
| **Loading State** | Metric cards show skeleton placeholders; charts show grey boxes |
| **Error State** | Individual widget errors (retry per widget); full page error if auth/org fails |
| **Mobile Behaviour** | Stacked metric cards (2-column grid); action items as scrollable list |

---

## 6. Employee Dashboard

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/dashboard` |
| **Allowed Roles** | Employee (also accessible by Manager, HR Admin, Owner as their "personal" view) |
| **Primary Goal** | Personal status overview; quick access to self-service actions |
| **Main Actions** | Clock in/out, view leave balance, view pending requests, access onboarding tasks, view recent notifications |

| **Data Dependencies** | Own attendance state, leave balances, pending requests, onboarding progress, recent notifications, upcoming events |
| **Empty State** | New employee: "Welcome! Here's what you need to do" with onboarding checklist |
| **Loading State** | Skeleton cards for each widget section |
| **Error State** | Per-widget error with retry; navigation remains functional |
| **Mobile Behaviour** | Single column; clock in/out button prominent at top; swipeable sections |

---

## 7. Manager Dashboard

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/dashboard` |
| **Allowed Roles** | Manager |
| **Primary Goal** | Team oversight; pending approvals; direct report status |
| **Main Actions** | Approve/reject leave, view team attendance, see overdue tasks, navigate to team members |
| **Data Dependencies** | Direct reports list, pending leave approvals count, team attendance today, overdue onboarding tasks, team calendar summary |
| **Empty State** | No direct reports: "No team members assigned. Contact HR to set up reporting relationships." |
| **Loading State** | Skeleton for approval queue and team status cards |
| **Error State** | Per-widget error with retry |
| **Mobile Behaviour** | Approval queue as tappable cards at top; team status as compact list below |

---

## 8. Employee Directory

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/employees` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | Find and navigate to employee profiles |
| **Main Actions** | Search, filter by department/status/location, toggle list/grid view, add employee (HR/Owner) |
| **Data Dependencies** | Employee list (name, photo, job title, department, email, status), department list, location list |
| **Empty State** | No employees: "Add your first employee" CTA (HR/Owner); "No employees found" for filters |
| **Loading State** | Table skeleton rows or grid skeleton cards |
| **Error State** | "Failed to load employees. Retry." with retry button |
| **Mobile Behaviour** | Card layout (no table); search bar sticky at top; infinite scroll; filter as bottom sheet |

---

## 9. Employee Profile

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/employees/[employeeId]` |
| **Allowed Roles** | Owner, HR Admin (full), Manager (scoped to reports), Employee (own only) |
| **Primary Goal** | View comprehensive employee information organised in tabs |
| **Main Actions** | Edit details (HR/Owner), change status, assign manager, view history, upload document |
| **Data Dependencies** | Employee record, department, job title, manager, reporting chain, leave balance, attendance summary, onboarding status, documents |
| **Empty State** | Per-tab: "No documents uploaded yet", "No leave history", "No onboarding assigned" |
| **Loading State** | Header with avatar skeleton; tab content skeleton |
| **Error State** | 404 if employee not found; 403 redirects to dashboard with toast |
| **Mobile Behaviour** | Tabs become horizontal scrollable pills; content full-width; actions in bottom action sheet |

---

## 10. Leave Requests (My Leave)

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/leave` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | View own leave balance and request history; submit new requests |

| **Main Actions** | Submit new request, cancel pending request, view balance breakdown, filter by status/type |
| **Data Dependencies** | Leave balances (per type), leave request history, leave types, leave policies |
| **Empty State** | No requests: "You haven't submitted any leave requests yet. Submit your first request." |
| **Loading State** | Balance cards skeleton + table skeleton rows |
| **Error State** | Inline error with retry; balance section independent from history |
| **Mobile Behaviour** | Balance cards horizontal scroll; request list as cards; FAB for new request |

---

## 11. Leave Approval Inbox

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/leave/approvals` |
| **Allowed Roles** | Owner, HR Administrator, Manager |
| **Primary Goal** | Review and action pending leave requests from team/organisation |
| **Main Actions** | Approve, reject (with reason), view request detail, filter by employee/type/date |
| **Data Dependencies** | Pending leave requests (for direct reports if Manager; all if HR/Owner), employee names, leave types |
| **Empty State** | "No pending leave requests. All caught up!" with checkmark illustration |
| **Loading State** | Request card skeletons |
| **Error State** | "Failed to load approvals. Retry." |
| **Mobile Behaviour** | Swipeable cards (swipe right = approve, swipe left = reject); or tap to expand with action buttons |

---

## 12. Leave Calendar

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/leave/calendar` |
| **Allowed Roles** | Owner, HR Administrator, Manager (team only) |
| **Primary Goal** | Visual overview of team/org leave to identify conflicts and availability |
| **Main Actions** | Navigate months, filter by department/team, click day for detail |
| **Data Dependencies** | Approved and pending leave requests, employee names, leave types (for colour coding) |
| **Empty State** | Calendar grid with no markers: "No leave scheduled this month" |
| **Loading State** | Calendar grid structure with shimmer on day cells |
| **Error State** | "Failed to load calendar data. Retry." |
| **Mobile Behaviour** | Switches to list view grouped by week; month navigation via swipe |

---

## 13. Attendance

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/attendance` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | Clock in/out and view personal attendance history |
| **Main Actions** | Clock in, clock out, view daily/weekly/monthly history, view summary stats |
| **Data Dependencies** | Current attendance state, attendance history, monthly summary, working hours config |
| **Empty State** | No history: "No attendance records yet. Clock in to start tracking." |
| **Loading State** | Clock button area skeleton; history table skeleton |
| **Error State** | Clock action error: toast notification; history error: inline with retry |
| **Mobile Behaviour** | Large clock in/out button at top; history as vertical timeline cards below |

---

## 14. Onboarding

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/onboarding` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | View and complete assigned onboarding tasks |
| **Main Actions** | Mark task complete, add notes, view task details, filter by status |
| **Data Dependencies** | Assigned onboarding tasks (own), task descriptions, due dates, assignee info |
| **Empty State** | No tasks: "No onboarding tasks assigned to you." |
| **Loading State** | Checklist skeleton rows |
| **Error State** | "Failed to load tasks. Retry." |
| **Mobile Behaviour** | Checklist as tappable cards with checkbox; swipe to complete |

---

## 15. Documents

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/documents` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | View and manage own documents (or all documents for HR/Owner) |

| **Main Actions** | Upload document, download, view metadata, filter by category/employee, archive |
| **Data Dependencies** | Document list (filename, category, upload date, expiry, employee), categories |
| **Empty State** | "No documents uploaded yet. Upload your first document." with upload CTA |
| **Loading State** | Table skeleton rows with file icon placeholders |
| **Error State** | "Failed to load documents. Retry."; upload failure: toast with retry |
| **Mobile Behaviour** | Document list as cards; upload via native file picker; tap to view detail/download |

---

## 16. Payroll (Periods & Records)

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/payroll` |
| **Allowed Roles** | Owner, HR Administrator |
| **Primary Goal** | Manage payroll periods and employee pay records |
| **Main Actions** | Create period, add records, calculate totals, approve, publish payslips |
| **Data Dependencies** | Payroll periods, employee records within period, line items, period status |
| **Empty State** | "No payroll periods created yet. Create your first payroll period." |
| **Loading State** | Period list skeleton; record table skeleton on period detail |
| **Error State** | "Failed to load payroll data. Retry." |
| **Mobile Behaviour** | Period list as cards with status badges; record editing not optimised for mobile (shows "use desktop" suggestion for complex edits) |

---

## 17. My Payslips

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/payslips` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | View own published payslips |
| **Main Actions** | View payslip detail, download PDF |
| **Data Dependencies** | Published payslips for own employee record |
| **Empty State** | "No payslips published yet." |
| **Loading State** | Payslip card list skeleton |
| **Error State** | "Failed to load payslips. Retry." |
| **Mobile Behaviour** | Payslip list as cards; tap to view full breakdown; download as PDF |

---

## 18. Notifications

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/notifications` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | View all notifications with full context; manage read state |
| **Main Actions** | Mark as read, mark all as read, click to navigate to related resource |
| **Data Dependencies** | All notifications for current user (paginated) |
| **Empty State** | "No notifications yet. You'll be notified about leave decisions, tasks, and updates." |
| **Loading State** | Notification row skeletons |
| **Error State** | "Failed to load notifications. Retry." |
| **Mobile Behaviour** | Full-width notification cards; swipe left to mark read; tap to navigate |

---

## 19. Audit Log

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/audit` |
| **Allowed Roles** | Owner, HR Administrator |
| **Primary Goal** | View chronological record of all administrative actions for compliance |
| **Main Actions** | Filter by actor/action/target/date range, export CSV, view event detail |
| **Data Dependencies** | Audit events (actor, action, target, timestamp, details, IP), paginated |
| **Empty State** | "No audit events recorded yet." (unlikely after org creation) |
| **Loading State** | Table skeleton rows |
| **Error State** | "Failed to load audit log. Retry." |
| **Mobile Behaviour** | Compact event cards with expandable detail; filters as bottom sheet; export hidden on mobile |

---

## 20. Organisation Settings

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/settings` |
| **Allowed Roles** | Owner (full write), HR Administrator (read-only on most; write on departments/titles/locations/branding) |
| **Primary Goal** | Configure organisation-wide settings and structure |
| **Main Actions** | Edit settings per section, manage members, manage departments/titles/locations |
| **Data Dependencies** | Organisation settings record, members list, departments, job titles, locations |
| **Empty State** | Per-section: settings always have defaults; member list always has at least Owner |
| **Loading State** | Form field skeletons per section |
| **Error State** | Save failure: inline error above save button with retry; load failure: section-level retry |
| **Mobile Behaviour** | Settings sections as a list menu; tapping a section navigates to full-page form |

---

## 21. Personal Settings

| Property | Value |
|----------|-------|
| **Route** | `/org/[orgId]/settings/personal` |
| **Allowed Roles** | Owner, HR Administrator, Manager, Employee |
| **Primary Goal** | Manage personal account settings independent of organisation |
| **Main Actions** | Update profile, change password, configure notification preferences, view/revoke sessions |
| **Data Dependencies** | User record (name, email, avatar), notification preferences, active sessions |
| **Empty State** | N/A (profile always exists) |
| **Loading State** | Form skeleton |
| **Error State** | Save failure: inline error; password change: specific errors (wrong current password) |
| **Mobile Behaviour** | Section list navigation; forms full-width; password fields use device keyboard type |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Initial | Complete page inventory for V1 | HR Daddy Design |
