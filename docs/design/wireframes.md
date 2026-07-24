# Wireframes — HR Daddy V1

Structured text wireframes describing layout, information hierarchy, actions, responsive behaviour, and states for the main pages.

---

## 1. Admin Dashboard

### Layout (Desktop — 1200px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  HEADER: "Dashboard" + Search + Bell (3) + Avatar      │
│            │─────────────────────────────────────────────────────────│
│ Dashboard  │                                                         │
│ Employees  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ Leave      │  │ Active   │ │ Present  │ │ On Leave │ │ Pending  │  │
│ Attendance │  │ Employees│ │ Today    │ │ Today    │ │ Requests │  │
│ Onboarding │  │   45     │ │   38     │ │   4      │ │   3      │  │
│ Documents  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│ Payroll    │                                                         │
│ Audit Log  │  ┌─────────────────────────┐ ┌───────────────────────┐ │
│            │  │ PENDING ACTIONS          │ │ QUICK STATS           │ │
│ ────────── │  │ ● 3 leave requests      │ │ Missing clock-outs: 2 │ │
│ Settings   │  │ ● 2 missing clock-outs  │ │ Overdue tasks: 4      │ │
│            │  │ ● 4 overdue tasks       │ │ Expiring docs: 1      │ │
│            │  │ ● 1 expiring document   │ │ Payroll: Draft        │ │
│            │  └─────────────────────────┘ └───────────────────────┘ │
│            │                                                         │
│            │  ┌─────────────────────────────────────────────────────┐│
│            │  │ RECENT ACTIVITY (Audit)                             ││
│            │  │ 10:32 — Priya approved leave for Alex               ││
│            │  │ 10:15 — John clocked in                             ││
│            │  │ 09:58 — Sarah updated department "Engineering"      ││
│            │  │ [View full audit log →]                             ││
│            │  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Metric cards** (top) — At-a-glance numbers for key operational metrics
2. **Pending actions** — Items requiring immediate attention (clickable to relevant page)
3. **Quick stats** — Secondary metrics that indicate health
4. **Recent activity** — Chronological feed of recent org-wide actions

### Primary Action
- None on dashboard itself; each card/item links to its detail page

### Secondary Actions
- "Add Employee" quick-action button in header area
- "View All" links on each section

### Responsive Behaviour
- **Tablet (768–1199px)**: Metric cards become 2x2 grid; sidebar collapses to icons
- **Mobile (<768px)**: Single column; metric cards 2-per-row; pending actions as scrollable cards; recent activity truncated to 5 items

### Empty State (First Use)
```
┌─────────────────────────────────────────┐
│  🎉 Welcome to HR Daddy!                │
│                                         │
│  Get started by setting up your team:   │
│                                         │
│  [Add Your First Employee]              │
│  [Configure Leave Policies]             │
│  [Invite Team Members]                  │
│                                         │
│  ☐ Create organisation  ✓              │
│  ☐ Add first employee                  │
│  ☐ Configure leave policies            │
│  ☐ Invite HR admin                     │
└─────────────────────────────────────────┘
```

---

## 2. Employee Directory

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER: "Employees" + [+ Add Employee] button (HR/Owner only)       │
│ Breadcrumb: Northstar Studios > Employees                           │
│─────────────────────────────────────────────────────────────────────│
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search employees...    [Department ▾] [Status ▾] [📋│📇]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Photo │ Name          │ Job Title        │ Department │ Status  │ │
│ │───────│───────────────│──────────────────│────────────│─────────│ │
│ │  👤   │ Alex Chen     │ Software Engineer│ Engineering│ Active  │ │
│ │  👤   │ David Kumar   │ Eng Lead         │ Engineering│ Active  │ │
│ │  👤   │ Emma Wilson   │ Designer         │ Design     │ Active  │ │
│ │  👤   │ John Smith    │ DevOps Engineer  │ Engineering│ On Leave│ │
│ │  👤   │ Priya Sharma  │ HR Manager       │ Operations │ Active  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Showing 1-25 of 45 employees          [← Prev] [1] [2] [Next →]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Search and filters** — Immediate access to find specific employees
2. **Employee table** — Sortable columns with essential info at a glance
3. **Pagination** — Navigate large employee lists

### Primary Action
- "+ Add Employee" button (top-right, visible to HR Admin and Owner only)

### Secondary Actions
- Toggle list/grid view
- Click row to navigate to employee profile
- Sort by column header
- Export (future)

### Table vs Card Behaviour
- **List view** (default): Table with sortable columns
- **Grid view**: Cards showing photo, name, title, department in a 3-column grid

### Responsive Behaviour
- **Tablet**: Table with fewer columns (hide department, show on expand)
- **Mobile**: Switches to card layout exclusively; search sticky at top; filters via bottom sheet; infinite scroll replaces pagination

### Empty State
```
┌─────────────────────────────────┐
│      👥                          │
│  No employees yet               │
│                                 │
│  Add your first employee to     │
│  start managing your team.      │
│                                 │
│  [+ Add Employee]               │
└─────────────────────────────────┘
```

---

## 3. Employee Profile

### Layout (Desktop)


```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Employees > Alex Chen               │
│─────────────────────────────────────────────────────────────────────│
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [Avatar]  Alex Chen                        [Edit] [⋮ More]   │   │
│ │           Software Engineer · Engineering                     │   │
│ │           Active since 15 Jan 2024                            │   │
│ │           Reports to: David Kumar                             │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ [Overview] [Personal] [Employment] [Compensation] [Leave] [Docs]    │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ OVERVIEW TAB:                                                       │
│ ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│ │ QUICK INFO               │  │ LEAVE BALANCE                    │  │
│ │ Employee No: EMP-012     │  │ Annual: 12/18 days remaining     │  │
│ │ Email: alex@northstar.io │  │ Sick:    8/10 days remaining     │  │
│ │ Phone: +65 9123 4567     │  │ [View full balance →]            │  │
│ │ Location: Singapore HQ   │  └──────────────────────────────────┘  │
│ │ Type: Full-time          │                                        │
│ └──────────────────────────┘  ┌──────────────────────────────────┐  │
│                               │ ATTENDANCE THIS WEEK              │  │
│ ┌──────────────────────────┐  │ Mon: 09:01 – 18:15 (9h 14m)     │  │
│ │ ONBOARDING               │  │ Tue: 08:55 – 18:30 (9h 35m)     │  │
│ │ ██████████░░ 80%         │  │ Wed: Clocked in at 09:03         │  │
│ │ 8/10 tasks complete      │  │ [View full history →]            │  │
│ │ [View tasks →]           │  └──────────────────────────────────┘  │
│ └──────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Profile header** — Name, role, department, status, avatar (always visible)
2. **Tab navigation** — Organised sections of employee data
3. **Overview tab** — Summary cards from all modules for quick scanning
4. **Detail tabs** — Full information per domain

### Primary Action
- "Edit" button (HR Admin/Owner only) — opens edit mode for current tab

### Secondary Actions
- "More" menu: Change status, Deactivate, Assign onboarding, Upload document
- Tab-specific actions (e.g., "Submit Leave" on Leave tab)

### Responsive Behaviour
- **Tablet**: Two-column layout maintained; tabs scroll horizontally
- **Mobile**: Single column; tabs become horizontal scrollable pills; header collapses avatar to smaller size; action buttons in bottom sheet via "More" icon

### Empty State (per tab)
- Personal: "No personal details recorded yet" (with edit CTA for HR)
- Documents: "No documents uploaded" (with upload CTA)
- Leave: "No leave history" (with submit leave CTA)
- Onboarding: "No onboarding assigned"

---

## 4. Leave Submission

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Leave > New Request                 │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ SUBMIT LEAVE REQUEST                                            │ │
│ │                                                                 │ │
│ │ Leave Type:    [Annual Leave        ▾]                          │ │
│ │                Available: 12 days                               │ │
│ │                                                                 │ │
│ │ Start Date:    [📅 15/03/2024      ]                            │ │
│ │ End Date:      [📅 17/03/2024      ]                            │ │
│ │                                                                 │ │
│ │ Duration:      3 working days (excludes weekends)               │ │
│ │                                                                 │ │
│ │ Half Day:      ☐ First day is half day                          │ │
│ │                ☐ Last day is half day                           │ │
│ │                                                                 │ │
│ │ Reason/Notes:  ┌─────────────────────────────────────┐          │ │
│ │                │ Family vacation                      │          │ │
│ │                └─────────────────────────────────────┘          │ │
│ │                                                                 │ │
│ │ Attachment:    [📎 Choose file] (optional)                      │ │
│ │                                                                 │ │
│ │ Approver:      David Kumar (auto-assigned from reporting chain) │ │
│ │                                                                 │ │
│ │ ─────────────────────────────────────────────────────────────── │ │
│ │ [Cancel]                                    [Submit Request]    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ⚠️  NOTE: 2 team members already on leave 15-16 Mar             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Form fields** — Type, dates, options in logical order
2. **Contextual info** — Available balance shown inline; duration auto-calculated
3. **Conflict warning** — Non-blocking notice about team availability
4. **Approver info** — Transparency about who will review

### Primary Action
- "Submit Request" — submits and redirects to My Leave with success toast

### Secondary Actions
- "Cancel" — returns to My Leave without saving
- Half-day toggles (conditional on leave type supporting half days)
- File attachment upload

### Responsive Behaviour
- **Mobile**: Single column form; date pickers use native date input; file attachment via device camera/gallery; submit button fixed at bottom

### Empty State
- N/A (this is a form page)

### Validation Placement
- Inline below each field on blur/submit
- Balance check shown immediately when type selected
- Overlap warning shown after date selection (non-blocking)
- Blocking errors: "Insufficient balance", "Overlapping request exists"

---

## 5. Attendance Clock

### Layout (Desktop)


```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Attendance                          │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │                    TODAY — Wednesday, 13 Mar 2024              │   │
│ │                                                               │   │
│ │              ┌─────────────────────────┐                      │   │
│ │              │                         │                      │   │
│ │              │     ⏰ 09:03 AM         │                      │   │
│ │              │     Clocked in          │                      │   │
│ │              │     Duration: 4h 32m    │                      │   │
│ │              │                         │                      │   │
│ │              │    [🔴 Clock Out]       │                      │   │
│ │              │                         │                      │   │
│ │              └─────────────────────────┘                      │   │
│ │                                                               │   │
│ │  Location: ○ Office  ● Remote                                 │   │
│ │  Notes:    [Optional note...                    ]             │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ THIS WEEK                                                     │   │
│ │ Mon 11 Mar:  09:01 – 18:15  │  9h 14m   │ Office             │   │
│ │ Tue 12 Mar:  08:55 – 18:30  │  9h 35m   │ Remote             │   │
│ │ Wed 13 Mar:  09:03 – ...    │  Running   │ Remote             │   │
│ │ Thu 14 Mar:  —                                                │   │
│ │ Fri 15 Mar:  —                                                │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ MONTHLY SUMMARY — March 2024                                  │   │
│ │ Days worked: 9/22  │  Avg hours: 9h 12m  │  Total: 82h 48m   │   │
│ │ [View full history →]                                         │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Clock widget** (centre, prominent) — Current state, time, and action button
2. **Location/notes** — Contextual input for the clock event
3. **Weekly view** — Immediate recent history
4. **Monthly summary** — Aggregate stats

### Primary Action
- "Clock In" (green, large) when not clocked in
- "Clock Out" (red, large) when clocked in

### Secondary Actions
- Toggle location (office/remote)
- Add optional note
- Navigate to full history
- View monthly summary

### Responsive Behaviour
- **Mobile**: Clock button is the hero element (full width, large tap target); weekly history below as compact rows; monthly summary as a single stats row

### Empty State (never clocked in)
```
┌────────────────────────────────┐
│         ⏰                      │
│   Ready to start your day?     │
│                                │
│   [🟢 Clock In]                │
│                                │
│   No attendance history yet.   │
└────────────────────────────────┘
```

---

## 6. Onboarding Checklist

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Onboarding                          │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ MY ONBOARDING — New Hire Standard                             │   │
│ │ Progress: ████████░░░░ 60% (6/10 tasks)                       │   │
│ │ Started: 15 Jan 2024  │  Due: 29 Jan 2024                    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ✅ Complete profile information          Self    Done 15 Jan  │   │
│ │ ✅ Read employee handbook                Self    Done 15 Jan  │   │
│ │ ✅ Set up development environment        Self    Done 16 Jan  │   │
│ │ ✅ Meet with manager                     David   Done 16 Jan  │   │
│ │ ✅ Collect laptop and badge              IT      Done 16 Jan  │   │
│ │ ✅ Complete security training            Self    Done 17 Jan  │   │
│ │ ──────────────────────────────────────────────────────────── │   │
│ │ ☐  Submit bank details                  Self    Due 20 Jan   │   │
│ │ ☐  Submit tax form                      Self    Due 20 Jan   │   │
│ │ ☐  Complete compliance quiz             Self    Due 25 Jan   │   │
│ │ ⚠️  Schedule 30-day review              David   OVERDUE      │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Task Detail (expanded on click):                                    │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ☐ Submit bank details                                         │   │
│ │ Description: Provide bank account details for payroll setup.  │   │
│ │ Assigned to: You  │  Due: 20 Jan 2024                        │   │
│ │ Notes: [Add a note...]                                        │   │
│ │ [Mark Complete]                                               │   │
│ └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Progress summary** — Overall completion percentage and timeline
2. **Completed tasks** — Checked off with completion date (collapsible)
3. **Pending tasks** — Unchecked with due dates and assignees
4. **Overdue tasks** — Highlighted with warning indicator
5. **Task detail** — Expanded view with description, notes, and action

### Primary Action
- "Mark Complete" on each task (for tasks assigned to current user)

### Secondary Actions
- Add notes to a task
- Expand/collapse task detail
- Filter: All / Pending / Overdue / Completed
- View task history

### Responsive Behaviour
- **Mobile**: Single-column checklist; tap to expand task; "Mark Complete" as full-width button in expanded view; progress bar at top sticky

### Empty State
```
┌────────────────────────────────┐
│      📋                         │
│  No onboarding tasks yet       │
│                                │
│  Your onboarding tasks will    │
│  appear here once assigned     │
│  by your HR team.              │
└────────────────────────────────┘
```

---

## 7. Document Upload

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Documents > Upload                  │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ UPLOAD DOCUMENT                                                 │ │
│ │                                                                 │ │
│ │ Employee:     [Alex Chen              ▾] (HR/Owner select)      │ │
│ │               (Employee: locked to self)                        │ │
│ │                                                                 │ │
│ │ Category:     [Identity Documents     ▾]                        │ │
│ │                                                                 │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │                                                             │ │ │
│ │ │     📁 Drag and drop file here                              │ │ │
│ │ │        or [Browse Files]                                    │ │ │
│ │ │                                                             │ │ │
│ │ │     Accepted: PDF, JPEG, PNG, DOCX, XLSX                   │ │ │
│ │ │     Max size: 10MB                                          │ │ │
│ │ │                                                             │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │                                                                 │ │
│ │ File selected: passport_alex.pdf (2.3 MB) ✓   [✕ Remove]       │ │
│ │                                                                 │ │
│ │ Description:  [Passport scan - valid until 2029    ]            │ │
│ │                                                                 │ │
│ │ Expiry Date:  [📅 15/06/2029   ] (optional)                    │ │
│ │               ℹ️ You'll be notified 30 days before expiry       │ │
│ │                                                                 │ │
│ │ Visibility:   ● Visible to employee  ○ HR only                 │ │
│ │               (HR/Owner only option)                            │ │
│ │                                                                 │ │
│ │ ─────────────────────────────────────────────────────────────── │ │
│ │ [Cancel]                                    [Upload Document]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Employee selection** — Who this document belongs to
2. **Category** — Classification for organisation and access control
3. **File upload zone** — Drag-and-drop with fallback browse
4. **Metadata** — Description, expiry, visibility settings
5. **Actions** — Submit or cancel

### Primary Action
- "Upload Document" — validates, uploads to storage, creates record, redirects to documents list

### Secondary Actions
- "Cancel" — returns without saving
- Remove selected file
- Change visibility (HR-only vs visible to employee)

### Responsive Behaviour
- **Mobile**: File upload via native file picker (no drag-drop); form single-column; upload button fixed at bottom

### Empty State
- N/A (form page)

### Validation
- File type check on selection (immediate feedback)
- File size check on selection
- Category required
- Description optional but encouraged
- Upload progress bar during file transfer

---

## 8. Payroll View

### Layout (Desktop)


```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Payroll > March 2024                │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ MARCH 2024 PAYROLL                      Status: [Draft ●]     │   │
│ │ Period: 01 Mar – 31 Mar 2024                                  │   │
│ │ Employees: 42/45 (3 excluded: deactivated)                    │   │
│ │                                                               │   │
│ │ [Submit for Review]  [Export CSV]                              │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ SUMMARY                                                       │   │
│ │ Total Gross:  $186,450.00  │  Total Deductions: $42,150.00    │   │
│ │ Total Net:    $144,300.00  │  Records Complete:  38/42        │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ 🔍 Search employee...   [Department ▾]  [Status: Incomplete ▾]     │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Employee       │ Gross      │ Deductions │ Net Pay   │ Status │   │
│ │────────────────│────────────│────────────│───────────│────────│   │
│ │ Alex Chen      │ $5,500.00  │ $1,200.00  │ $4,300.00 │ ✓ Done │   │
│ │ David Kumar    │ $8,200.00  │ $1,800.00  │ $6,400.00 │ ✓ Done │   │
│ │ Emma Wilson    │ $4,800.00  │ $1,050.00  │ $3,750.00 │ ⚠ Inco.│   │
│ │ John Smith     │ $6,100.00  │ $1,350.00  │ $4,750.00 │ ✓ Done │   │
│ │ [Click to edit record →]                                      │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ PERIOD TIMELINE:                                                    │
│ [Draft] → [Under Review] → [Approved] → [Published] → [Paid]       │
│   ●                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Period header** — Period name, dates, status badge, record count
2. **Summary totals** — Aggregated financial figures
3. **Employee records table** — Individual pay records with completion status
4. **Period timeline** — Visual state machine showing current position

### Primary Action
- "Submit for Review" (when Draft) / "Approve" (when Under Review) / "Publish Payslips" (when Approved)

### Secondary Actions
- Export CSV
- Search/filter employees
- Click row to edit individual record
- Reopen period (Owner only, when published)

### Responsive Behaviour
- **Tablet**: Table columns reduced (hide deductions column)
- **Mobile**: Not optimised for payroll editing; shows read-only summary cards with "Use desktop for editing" note. Payslip viewing works on mobile.

### Empty State (no payroll periods)
```
┌────────────────────────────────┐
│      💰                         │
│  No payroll periods yet        │
│                                │
│  Create your first payroll     │
│  period to start managing      │
│  employee pay records.         │
│                                │
│  [+ Create Payroll Period]     │
└────────────────────────────────┘
```

---

## 9. Employee Dashboard

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER: "My Dashboard" + Bell (1) + Avatar                          │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│ │ TODAY                    │  │ ATTENDANCE                        │  │
│ │ Wednesday, 13 Mar 2024   │  │ ┌──────────────────────────────┐ │  │
│ │                          │  │ │  Clocked in at 09:03         │ │  │
│ │ Good morning, Alex! 👋   │  │ │  Duration: 4h 32m            │ │  │
│ │                          │  │ │  [🔴 Clock Out]              │ │  │
│ └──────────────────────────┘  │ └──────────────────────────────┘ │  │
│                               └──────────────────────────────────┘  │
│                                                                     │
│ ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│ │ LEAVE BALANCE            │  │ PENDING REQUESTS                 │  │
│ │ Annual:  12/18 days      │  │ Annual Leave: 15-17 Mar          │  │
│ │ Sick:     8/10 days      │  │ Status: ⏳ Pending approval      │  │
│ │ [Submit Leave Request →] │  │ [View Details →]                 │  │
│ └──────────────────────────┘  └──────────────────────────────────┘  │
│                                                                     │
│ ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│ │ ONBOARDING               │  │ RECENT NOTIFICATIONS             │  │
│ │ ████████░░ 80%           │  │ • Payslip Feb 2024 available     │  │
│ │ 2 tasks remaining        │  │ • Onboarding task due tomorrow   │  │
│ │ ⚠️ 1 overdue             │  │ • Welcome to Northstar Studios!  │  │
│ │ [View Tasks →]           │  │ [View All →]                     │  │
│ └──────────────────────────┘  └──────────────────────────────────┘  │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ UPCOMING                                                        │ │
│ │ 15 Mar — Annual Leave starts                                    │ │
│ │ 20 Mar — Bank details submission due (onboarding)               │ │
│ │ 31 Mar — Payslip expected                                       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Greeting + attendance clock** — Most time-sensitive actions (clock in/out)
2. **Leave balance + pending requests** — Self-service status at a glance
3. **Onboarding progress** — Outstanding tasks (if active onboarding)
4. **Notifications** — Recent unread items
5. **Upcoming events** — Calendar/timeline of near-future items

### Primary Action
- Clock In/Out button (prominent, contextual)

### Secondary Actions
- "Submit Leave Request" quick action
- Navigate to any section via card links
- View all notifications

### Responsive Behaviour
- **Mobile**: Single column; clock button hero at top; leave balance as horizontal card; onboarding progress compact; notifications as a scrollable mini-list

### Empty State (new employee, no data yet)
```
┌────────────────────────────────────────┐
│  👋 Welcome to Northstar Studios!       │
│                                        │
│  Here's what you can do:               │
│  • Clock in to start your day          │
│  • Complete your onboarding tasks      │
│  • Check your leave balance            │
│                                        │
│  [🟢 Clock In]                          │
└────────────────────────────────────────┘
```

---

## 10. Settings

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Northstar Studios > Settings                            │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│ ┌────────────────┐  ┌──────────────────────────────────────────────┐│
│ │ SETTINGS NAV   │  │ GENERAL SETTINGS                             ││
│ │                │  │                                              ││
│ │ ● General      │  │ Organisation Name:                           ││
│ │   Schedule     │  │ [Northstar Studios               ]           ││
│ │   Leave        │  │                                              ││
│ │   Branding     │  │ Timezone:                                    ││
│ │   Members      │  │ [Asia/Singapore (UTC+8)          ▾]          ││
│ │   Departments  │  │                                              ││
│ │   Job Titles   │  │ Currency:                                    ││
│ │   Locations    │  │ [SGD — Singapore Dollar           ▾]          ││
│ │   Security     │  │                                              ││
│ │ ────────────── │  │ Date Format:                                 ││
│ │   Personal     │  │ ○ DD/MM/YYYY  ● MM/DD/YYYY  ○ YYYY-MM-DD   ││
│ │   Profile      │  │                                              ││
│ │   Password     │  │ Leave Year Start:                            ││
│ │   Notif. Prefs │  │ [📅 01/01                        ]           ││
│ │   Sessions     │  │                                              ││
│ │                │  │ ─────────────────────────────────────────────││
│ └────────────────┘  │ [Save Changes]                              ││
│                     └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Information Hierarchy

1. **Settings navigation** (left) — Section list with active indicator
2. **Settings form** (right) — Current section's configurable fields
3. **Save action** — Explicit save button (no auto-save for settings)

### Primary Action
- "Save Changes" — persists the current section's modifications

### Secondary Actions
- Navigate between settings sections
- "Reset to defaults" link per section (where applicable)
- "Invite Member" button in Members section
- "Add Department" in Departments section

### Table/Card Layouts
- **Members section**: Table with name, email, role, status, actions (remove, change role)
- **Departments section**: Table with name, manager, employee count, actions (edit, archive)
- **Job Titles section**: Simple list with edit/archive actions
- **Locations section**: Simple list with edit/archive actions

### Responsive Behaviour
- **Tablet**: Side nav collapses to top tabs
- **Mobile**: Settings landing is a list menu of sections; tapping navigates to full-page form; save button sticky at bottom

### Empty States
- Members: Always has at least Owner (no empty state)
- Departments: "No departments created yet. [+ Add Department]"
- Job Titles: "No job titles created yet. [+ Add Job Title]"
- Locations: "No locations created yet. [+ Add Location]"

### Confirmation Steps
- Role change: "Change Alex's role to Manager?" confirmation dialog
- Member removal: "Remove Alex from Northstar Studios? They will lose all access." destructive confirmation
- Ownership transfer: Requires password re-entry + explicit "I understand" checkbox

### Error Recovery
- Save failure: Inline error above save button; form state preserved
- Network error: "Unable to save. Check your connection and try again."
- Conflict (stale data): "Settings were updated by another user. Reload to see latest."

---

## Design Principles Applied Across All Wireframes

### Consistency

- All page headers follow the same structure: Title + Primary Action button
- All forms follow: Label above field, validation below field, actions bottom-right
- All tables follow: Sortable headers, row hover state, click-to-navigate
- All empty states follow: Icon + headline + description + CTA

### Accessibility

- All interactive elements have visible focus states
- Form fields have associated labels (not just placeholders)
- Colour is never the only indicator of state (icons/text accompany)
- Touch targets minimum 44x44px on mobile
- Skip navigation link for keyboard users

### Loading Patterns

- Skeleton screens match the expected layout geometry
- No layout shifts when data loads (fixed dimensions for containers)
- Progressive loading: header → nav → content area
- Optimistic UI for simple actions (mark as read, clock in)

### Error Patterns

- Form errors: Red border + error text below field
- API errors: Toast for transient; inline message for persistent
- Permission errors: Redirect with toast explanation
- Network errors: Retry button; preserve user input

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Initial | Complete structured wireframes for V1 main pages | HR Daddy Design |
