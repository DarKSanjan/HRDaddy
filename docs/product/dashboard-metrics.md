# Dashboard Metrics Definition

This document defines every metric displayed on the HR Daddy dashboard, including data source, calculation logic, timezone behaviour, role visibility, empty states, and drill-down targets.

---

## General Principles

- All metrics are calculated in real time (no pre-aggregated caches in V1).
- "Today" is always relative to the organisation's configured timezone (`OrganisationSettings.timezone`).
- Metrics respect tenant isolation — queries are always scoped to `organisation_id`.
- Archived employees (status = 'archived') are excluded from all dashboard metrics unless stated otherwise.
- Deactivated employees are excluded from "active workforce" metrics but may appear in historical/pending metrics where relevant.

---

## 1. Active Employees

| Attribute | Value |
|-----------|-------|
| **Name** | Active Employees |
| **Definition** | Count of employees with employment status = 'active' in the current organisation. |
| **Source tables** | `Employee` |
| **Query logic** | `SELECT COUNT(*) FROM employee WHERE organisation_id = :org AND status = 'active'` |
| **Filters** | None (all active employees regardless of department, location, or type). |
| **Timezone behaviour** | Not time-sensitive — status is a persisted field, not dependent on current time. |
| **Role visibility** | Owner, HR Admin: full count. Manager: count of direct reports only. Employee: hidden. |
| **Empty state** | "0 active employees. Add your first employee to get started." with CTA to employee creation. |
| **Drill-down** | Navigates to the Employee Directory filtered by status = 'active'. |
| **Refresh** | On page load and after any employee status change event. |

---


## 2. Present Today

| Attribute | Value |
|-----------|-------|
| **Name** | Present Today |
| **Definition** | Count of employees who have clocked in today and have an open or closed attendance session for today's date. |
| **Source tables** | `AttendanceRecord`, `Employee` |
| **Query logic** | `SELECT COUNT(DISTINCT ar.employee_id) FROM attendance_record ar JOIN employee e ON ar.employee_id = e.id WHERE ar.organisation_id = :org AND ar.session_date = :today AND ar.status IN ('open', 'closed') AND e.status = 'active'` |
| **Filters** | Only active employees. Session date is calculated from org timezone. |
| **Timezone behaviour** | "Today" is derived from `NOW() AT TIME ZONE org_timezone`. The session_date field on AttendanceRecord already stores the clock-in date. |
| **Role visibility** | Owner, HR Admin: full count. Manager: count of direct reports present. Employee: hidden (replaced by own clock-in status). |
| **Empty state** | "No one has clocked in yet today." Displays clock-in CTA for employees who haven't clocked in. |
| **Drill-down** | Navigates to Attendance view filtered to today, showing who is present and who is absent. |
| **Refresh** | On page load, after clock-in/out events. Consider polling every 5 minutes for dashboard freshness. |

---

## 3. On Leave Today

| Attribute | Value |
|-----------|-------|
| **Name** | On Leave Today |
| **Definition** | Count of employees who have an approved leave request covering today's date. |
| **Source tables** | `LeaveRequest`, `Employee` |
| **Query logic** | `SELECT COUNT(DISTINCT lr.employee_id) FROM leave_request lr JOIN employee e ON lr.employee_id = e.id WHERE lr.organisation_id = :org AND lr.status = 'approved' AND lr.start_date <= :today AND lr.end_date >= :today AND e.status = 'active'` |
| **Filters** | Only approved leave (not pending). Only active employees. Includes both full-day and half-day leave (half-day still counts the person as "on leave"). |
| **Timezone behaviour** | "Today" derived from org timezone. Leave dates (start_date, end_date) are stored as DATE type and compared directly against the org-timezone date. |
| **Role visibility** | Owner, HR Admin: full count. Manager: count of direct reports on leave. Employee: hidden. |
| **Empty state** | "No one is on leave today." |
| **Drill-down** | Navigates to Leave Calendar view filtered to today, showing who is on leave and leave type. |
| **Refresh** | On page load and after leave approval/cancellation events. |

---


## 4. Pending Leave Requests

| Attribute | Value |
|-----------|-------|
| **Name** | Pending Leave Requests |
| **Definition** | Count of leave requests currently in 'pending' status awaiting approval. |
| **Source tables** | `LeaveRequest` |
| **Query logic** | `SELECT COUNT(*) FROM leave_request WHERE organisation_id = :org AND status = 'pending'` |
| **Filters** | Status = 'pending' only. All leave types included. |
| **Timezone behaviour** | Not time-sensitive — based on status field, not a time comparison. |
| **Role visibility** | Owner, HR Admin: total pending count across all employees. Manager: pending count for their direct reports only. Employee: own pending requests count. |
| **Empty state** | Owner/HR: "No pending leave requests. All caught up!" Manager: "No pending requests from your team." Employee: "You have no pending leave requests." |
| **Drill-down** | Owner/HR: Navigates to Leave Management filtered to pending. Manager: Navigates to Team Leave with pending filter. Employee: Navigates to own leave history with pending filter. |
| **Refresh** | On page load and after any leave status change event. |
| **Alert threshold** | If pending count > 0 for more than 48 hours, display amber indicator. If > 72 hours, display red indicator. |

---

## 5. Missing Clock-Outs

| Attribute | Value |
|-----------|-------|
| **Name** | Missing Clock-Outs |
| **Definition** | Count of attendance records with status = 'missing_clock_out' that have not been corrected. |
| **Source tables** | `AttendanceRecord` |
| **Query logic** | `SELECT COUNT(*) FROM attendance_record WHERE organisation_id = :org AND status = 'missing_clock_out'` |
| **Filters** | Only records flagged by the background job. Does not include currently open sessions (those are normal until the threshold passes). |
| **Timezone behaviour** | Not directly time-sensitive — the background job flags records using UTC comparison against org working hours. The metric simply counts flagged records. |
| **Role visibility** | Owner, HR Admin: full count. Manager: count for direct reports only. Employee: own missing clock-outs only (0 or 1). |
| **Empty state** | "No missing clock-outs. Attendance is clean." |
| **Drill-down** | Navigates to Attendance Corrections view showing all uncorrected missing_clock_out records with employee name, date, and clock-in time. |
| **Refresh** | On page load and after the background job runs (typically end-of-day + buffer). |
| **Alert threshold** | Any count > 0 shows amber indicator. Count > 5 shows red. |

---


## 6. Overdue Onboarding Tasks

| Attribute | Value |
|-----------|-------|
| **Name** | Overdue Onboarding Tasks |
| **Definition** | Count of onboarding tasks where status is 'pending' or 'in_progress' and due_date is before today. |
| **Source tables** | `EmployeeOnboardingTask`, `EmployeeOnboarding` |
| **Query logic** | `SELECT COUNT(*) FROM employee_onboarding_task eot JOIN employee_onboarding eo ON eot.onboarding_id = eo.id WHERE eo.organisation_id = :org AND eo.status IN ('not_started', 'in_progress') AND eot.status IN ('pending', 'in_progress') AND eot.due_date < :today` |
| **Filters** | Only tasks from active (non-cancelled, non-completed) onboarding instances. Cancelled and completed tasks are excluded. |
| **Timezone behaviour** | "Today" derived from org timezone. Due dates are stored as DATE type and compared directly. |
| **Role visibility** | Owner, HR Admin: total overdue count across all employees. Manager: overdue tasks assigned to them or for their direct reports. Employee: own overdue tasks only. |
| **Empty state** | "All onboarding tasks are on track!" |
| **Drill-down** | Navigates to Onboarding view filtered to overdue tasks, grouped by employee, showing task title, assignee, and days overdue. |
| **Refresh** | On page load. Changes once per day (when a new day starts in org timezone). |
| **Alert threshold** | Count > 0 shows amber. Tasks overdue by more than 7 days show red per-task indicator in drill-down. |

---

## 7. Expiring Documents

| Attribute | Value |
|-----------|-------|
| **Name** | Expiring Documents |
| **Definition** | Count of active employee documents where expiry_date is within the next 30 days (inclusive of today). |
| **Source tables** | `EmployeeDocument`, `Employee` |
| **Query logic** | `SELECT COUNT(*) FROM employee_document ed JOIN employee e ON ed.employee_id = e.id WHERE ed.organisation_id = :org AND ed.status IN ('active', 'expiring') AND ed.expiry_date IS NOT NULL AND ed.expiry_date BETWEEN :today AND :today + INTERVAL '30 days' AND ed.deleted_at IS NULL AND e.status = 'active'` |
| **Filters** | Only documents with an expiry_date set. Excludes deleted documents. Only for active employees. |
| **Timezone behaviour** | "Today" derived from org timezone. Expiry dates are DATE type. Comparison is date-only (no time component). |
| **Role visibility** | Owner, HR Admin: full count across all employees. Manager: count for direct reports. Employee: own expiring documents only. |
| **Empty state** | "No documents expiring in the next 30 days." |
| **Drill-down** | Navigates to Document Management filtered to expiring, showing: employee name, document name, category, expiry date, days remaining. Sorted by days remaining ascending (most urgent first). |
| **Refresh** | On page load. Primarily changes once per day as dates advance. |
| **Alert threshold** | Expiring within 7 days: red indicator. Expiring within 8–30 days: amber indicator. |

---


## 8. Payroll Status

| Attribute | Value |
|-----------|-------|
| **Name** | Payroll Status |
| **Definition** | The current status of the most recent (by end_date) payroll period, or the presence of an active draft period. Displays as a status badge rather than a numeric count. |
| **Source tables** | `PayrollPeriod` |
| **Query logic** | `SELECT status, label, end_date FROM payroll_period WHERE organisation_id = :org ORDER BY end_date DESC LIMIT 1` |
| **Filters** | Returns the single most recent payroll period regardless of status. |
| **Timezone behaviour** | Not time-sensitive — payroll periods use DATE fields and status is a persisted state. |
| **Role visibility** | Owner, HR Admin: visible with full status (draft, under_review, approved, published, paid). Manager: hidden. Employee: hidden (employees access their own payslips separately). |
| **Empty state** | "No payroll periods created yet. Set up your first payroll run." with CTA to create payroll period. |
| **Display format** | Badge showing: "[Period Label] — [Status]" e.g., "March 2024 — Under Review". Colour-coded: draft (grey), under_review (amber), approved (blue), published (green), paid (green ✓). |
| **Drill-down** | Navigates to Payroll Management showing the current period detail. |
| **Refresh** | On page load and after payroll status transition events. |
| **Alert threshold** | If current period is "draft" and end_date has passed: red "Overdue" indicator. If under_review for more than 5 days: amber indicator. |

---

## 9. Upcoming Birthdays

| Attribute | Value |
|-----------|-------|
| **Name** | Upcoming Birthdays |
| **Definition** | List of active employees whose birthday (date_of_birth) falls within the next 7 days, including today. |
| **Source tables** | `Employee` |
| **Query logic** | Extract month and day from `date_of_birth`, compare against the next 7 days from today in org timezone. Handle year-boundary (e.g., Dec 28 looking ahead into January). `SELECT id, first_name, last_name, date_of_birth FROM employee WHERE organisation_id = :org AND status = 'active' AND date_of_birth IS NOT NULL AND (EXTRACT(MONTH FROM date_of_birth), EXTRACT(DAY FROM date_of_birth)) IN (:next_7_day_pairs)` |
| **Filters** | Only active employees. Only those with date_of_birth set (field is optional). |
| **Timezone behaviour** | "Today" and the 7-day window are calculated in org timezone. Birthday matching uses month+day only (year-agnostic). |
| **Role visibility** | Owner, HR Admin: all upcoming birthdays. Manager: direct reports' birthdays. Employee: all colleagues' birthdays (community feature). |
| **Empty state** | "No birthdays in the next 7 days." |
| **Display format** | List showing: employee name, date (formatted per org date_format), "Today!" badge for today's birthdays. Sorted by date ascending. |
| **Drill-down** | None (informational widget). Clicking a name navigates to that employee's profile. |
| **Refresh** | On page load. Changes once per day. |

---


## 10. Upcoming Work Anniversaries

| Attribute | Value |
|-----------|-------|
| **Name** | Upcoming Anniversaries |
| **Definition** | List of active employees whose employment anniversary (start_date) falls within the next 7 days, including today. Only shows employees with 1+ year tenure. |
| **Source tables** | `Employee` |
| **Query logic** | Extract month and day from `start_date`, compare against next 7 days from today. Exclude employees whose start_date is within the current year (they haven't completed a full year yet). `SELECT id, first_name, last_name, start_date, (EXTRACT(YEAR FROM :today) - EXTRACT(YEAR FROM start_date)) AS years FROM employee WHERE organisation_id = :org AND status = 'active' AND start_date IS NOT NULL AND start_date < :today - INTERVAL '1 year' AND (EXTRACT(MONTH FROM start_date), EXTRACT(DAY FROM start_date)) IN (:next_7_day_pairs)` |
| **Filters** | Only active employees. Must have completed at least 1 full year. Start_date must be set. |
| **Timezone behaviour** | Same as birthdays — "today" and 7-day window in org timezone. Anniversary matching uses month+day. |
| **Role visibility** | Owner, HR Admin: all upcoming anniversaries. Manager: direct reports' anniversaries. Employee: all colleagues' anniversaries (community feature). |
| **Empty state** | "No work anniversaries in the next 7 days." |
| **Display format** | List showing: employee name, anniversary date, years of service (e.g., "3 years"). "Today!" badge for today's anniversaries. Sorted by date ascending. |
| **Drill-down** | None (informational widget). Clicking a name navigates to that employee's profile. |
| **Refresh** | On page load. Changes once per day. |

---

## 11. Recent Admin Activity

| Attribute | Value |
|-----------|-------|
| **Name** | Recent Admin Activity |
| **Definition** | The 10 most recent high-impact audit events for the organisation, providing at-a-glance visibility into significant system changes. |
| **Source tables** | `AuditLog`, `User` |
| **Query logic** | `SELECT al.action, al.target_type, al.target_id, al.created_at, u.full_name AS actor_name FROM audit_log al JOIN "user" u ON al.actor_id = u.id WHERE al.organisation_id = :org AND al.severity IN ('high', 'critical') ORDER BY al.created_at DESC LIMIT 10` |
| **Filters** | Only high and critical severity events. Normal severity events are excluded to keep the widget focused. |
| **Timezone behaviour** | `created_at` is stored in UTC. Displayed in org timezone with relative timestamps ("2 hours ago", "Yesterday at 3:15 PM"). |
| **Role visibility** | Owner, HR Admin: visible (per BR-AUDIT-006). Manager: hidden. Employee: hidden. |
| **Empty state** | "No recent admin activity." (Appears only for brand-new organisations with no audit events yet.) |
| **Display format** | Feed/timeline format showing: actor name, action description (human-readable), relative timestamp. Colour-coded by severity: high (amber), critical (red). |
| **Drill-down** | Clicking an entry navigates to the full Audit Log filtered to that specific event. A "View all" link navigates to the full Audit Log. |
| **Refresh** | On page load and after any high/critical severity audit event. |

---


## Dashboard Layout by Role

### Owner / HR Admin Dashboard

| Section | Metrics |
|---------|---------|
| **Workforce Summary** (top row) | Active Employees, Present Today, On Leave Today |
| **Action Required** (second row) | Pending Leave Requests, Missing Clock-Outs, Overdue Onboarding Tasks |
| **Compliance & Payroll** (third row) | Expiring Documents, Payroll Status |
| **Community** (sidebar) | Upcoming Birthdays, Upcoming Anniversaries |
| **Activity Feed** (bottom) | Recent Admin Activity |

### Manager Dashboard

| Section | Metrics |
|---------|---------|
| **My Team** (top row) | Active Reports (count), Reports Present Today, Reports On Leave Today |
| **Action Required** (second row) | Pending Leave Requests (for my reports), Missing Clock-Outs (my reports) |
| **Onboarding** (if applicable) | Overdue Tasks assigned to me or my reports |
| **Community** (sidebar) | Team Birthdays, Team Anniversaries |

### Employee Dashboard

| Section | Metrics |
|---------|---------|
| **My Status** (top row) | Own clock-in status, Leave balance summary, Pending requests count |
| **Tasks** (second row) | Own overdue onboarding tasks, Expiring documents |
| **Community** (sidebar) | Upcoming Birthdays (all colleagues), Upcoming Anniversaries (all colleagues) |

---

## Performance Considerations

| Metric | Query complexity | Optimisation strategy |
|--------|-----------------|----------------------|
| Active Employees | O(1) with index on (org_id, status) | Simple count query, sub-millisecond. |
| Present Today | O(n) where n = today's attendance records | Index on (org_id, session_date, status). |
| On Leave Today | O(n) where n = approved leave overlapping today | Index on (org_id, status, start_date, end_date). |
| Pending Leave | O(1) with index on (org_id, status) | Simple count query. |
| Missing Clock-Outs | O(1) with index on (org_id, status) | Simple count query. |
| Overdue Onboarding | O(n) where n = active onboarding tasks | Index on (due_date, status). Bounded by org size. |
| Expiring Documents | O(n) where n = docs with expiry | Index on (org_id, expiry_date). |
| Payroll Status | O(1) single row fetch | Index on (org_id, end_date DESC). |
| Birthdays | O(n) full scan of active employees | Acceptable for <500 employees. Future: materialised view. |
| Anniversaries | O(n) full scan of active employees | Same as birthdays. |
| Recent Activity | O(1) with index on (org_id, severity, created_at DESC) | Top-N query with covering index. |

For organisations approaching 500 employees, consider adding a 60-second dashboard cache that invalidates on relevant domain events.

---

## Metric Event Triggers

| Domain Event | Metrics Affected |
|--------------|-----------------|
| EmployeeActivated / Deactivated | Active Employees, Present Today, On Leave Today |
| AttendanceClockedIn / ClockedOut | Present Today |
| MissingClockOutDetected | Missing Clock-Outs |
| LeaveRequested | Pending Leave Requests |
| LeaveApproved / Rejected / Cancelled | Pending Leave Requests, On Leave Today |
| OnboardingTaskCompleted | Overdue Onboarding Tasks |
| PayrollPeriod status change | Payroll Status |
| DocumentUploaded with expiry | Expiring Documents |
| DocumentExpiring / Expired | Expiring Documents |
| AuditEventRecorded (high/critical) | Recent Admin Activity |
