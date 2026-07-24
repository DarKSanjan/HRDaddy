# User Journeys — HR Daddy V1

This document models complete end-to-end user journeys for each primary persona. Each journey captures the full experience from starting context through success state, including system responses, decision points, friction risks, and error recovery paths.

---

## Table of Contents

1. [Owner Onboarding Journey](#1-owner-onboarding-journey)
2. [HR Administrator Daily Journey](#2-hr-administrator-daily-journey)
3. [Employee First-Week Journey](#3-employee-first-week-journey)
4. [Manager Leave-Approval Journey](#4-manager-leave-approval-journey)
5. [Monthly HR Operations Journey](#5-monthly-hr-operations-journey)

---

## 1. Owner Onboarding Journey

**Persona:** Sarah — Startup Founder, 35, company of 25 employees
**Starting Context:** Sarah has decided to move her company from spreadsheets to HR Daddy. She has found the platform, is on the landing page, and has no existing account.
**User Goal:** Register, create her organisation, configure essential settings, set up departments, and invite her first employee (HR Admin) — all in one session.

---


### Step 1: Visit Registration Page

- **Action:** Sarah clicks "Get Started" or "Sign Up" from the landing page.
- **System Response:** Displays a clean registration form with fields: Full Name, Email, Password, Confirm Password.
- **Decision Point:** None — straightforward entry.
- **Friction Risk:** If the form requires too many fields upfront (company name, phone, etc.), Sarah may abandon. Keep it minimal.
- **Error Recovery:** If Sarah enters an email already in use, the system shows a generic "Check your email" message (no enumeration) and suggests signing in instead.

### Step 2: Complete Registration

- **Action:** Sarah fills in her name, email (sarah@northstar.io), and a strong password.
- **System Response:** Client-side validation shows a password strength indicator. On submit, system creates the User record (status: unverified), generates a verification token, and sends a verification email. Displays: "Check your email to verify your account."
- **Decision Point:** None.
- **Friction Risk:** Slow email delivery causes Sarah to wonder if it worked. A "Resend email" button should appear after 60 seconds.
- **Error Recovery:** If email delivery fails, the system queues for retry and displays "Email may take a few minutes." Sarah can request a resend (rate-limited to 3/hour).

### Step 3: Verify Email

- **Action:** Sarah opens her inbox, finds the verification email, and clicks the verification link.
- **System Response:** System validates the token (exists, not expired, not used), marks User status as "verified", invalidates the token, and redirects to the sign-in page with a success banner: "Email verified! Sign in to continue."
- **Decision Point:** None.
- **Friction Risk:** Token expired (24-hour limit). Sarah needs a clear "Request new verification" flow. Link should work across browser/device transitions.
- **Error Recovery:** Expired token → "This link has expired. Request a new verification email." Invalid token → generic "Invalid link" with sign-in option.


### Step 4: Sign In for the First Time

- **Action:** Sarah enters her email and password on the sign-in page.
- **System Response:** System validates credentials, creates a secure session (HttpOnly, Secure, SameSite=Lax cookie), and detects Sarah has no organisation. Redirects to the "Create Organisation" page instead of a dashboard.
- **Decision Point:** None — auto-redirect because no org exists.
- **Friction Risk:** If the redirect is not immediate and Sarah sees an empty dashboard, she may be confused.
- **Error Recovery:** Invalid credentials → generic "Invalid email or password." Account locked after 5 failures in 15 minutes → "Account temporarily locked. Try again in 30 minutes."

### Step 5: Create Organisation

- **Action:** Sarah enters her company name "Northstar Studios" and optionally selects industry (Creative/Technology) and company size (11-50).
- **System Response:** System creates the Organisation record, creates a Membership (role: Owner) linking Sarah to Northstar Studios, applies default settings (timezone: UTC, currency: USD, working days: Mon-Fri, hours: 09:00-17:00), seeds default leave types (Annual Leave, Sick Leave, Unpaid Leave), and seeds default document categories (Identity, Contracts, Certifications). Redirects to the Organisation Setup Wizard.
- **Decision Point:** None — minimal required input (company name only). Optional fields available but not blocking.
- **Friction Risk:** If system requires all settings upfront (timezone, currency, etc.), Sarah may drop off. Progressive disclosure: collect name now, configure details next.
- **Error Recovery:** Organisation name validation failure (too short/long) → inline validation. Database transaction failure → no partial records; generic error with retry option.

### Step 6: Configure Timezone and Regional Settings (Setup Wizard — Step 1)

- **Action:** Sarah selects her timezone from a searchable dropdown (e.g., "Asia/Singapore"), currency (SGD), and date format (DD/MM/YYYY).
- **System Response:** System updates OrganisationSettings with the selected values. Shows a preview of how dates and currency will display. Advances the wizard to the next step.
- **Decision Point:** Sarah must choose her timezone — this affects attendance recording. The system suggests a timezone based on browser locale but allows override.
- **Friction Risk:** Timezone list is overwhelming. Searchable dropdown with common timezones at the top mitigates this. Currency selection should show full name + symbol.
- **Error Recovery:** Invalid timezone → not possible with dropdown (validated server-side as safety net). Skip option available — defaults remain until configured later.


### Step 7: Configure Working Schedule (Setup Wizard — Step 2)

- **Action:** Sarah configures working days (toggles Mon-Fri on, Sat-Sun off) and working hours (09:00–18:00).
- **System Response:** System saves the configuration. Displays a summary: "Your team works Monday to Friday, 9 AM to 6 PM SGT." Advances wizard.
- **Decision Point:** Sarah considers whether Saturday is a working day for her team. She decides no.
- **Friction Risk:** Terminology confusion — "working days" vs "office days." Clear labelling with explanation: "Working days are used to calculate leave duration and expected attendance."
- **Error Recovery:** No working days selected → validation: "At least one working day must be selected." End time before start time → inline error.

### Step 8: Configure Leave Year (Setup Wizard — Step 3)

- **Action:** Sarah sets the leave year start date (default: January 1, which she keeps).
- **System Response:** System saves leave year start. Displays explanation: "Leave balances will reset annually on this date." Advances wizard.
- **Decision Point:** Sarah considers if her company's fiscal year starts differently. She keeps January 1 for simplicity.
- **Friction Risk:** Concept of "leave year" may be unfamiliar. A brief tooltip: "The leave year determines when annual leave allowances reset and carry-over is calculated."
- **Error Recovery:** Invalid date (e.g., Feb 30) → validation error. Can skip — defaults to Jan 1.

### Step 9: Create First Department

- **Action:** Sarah clicks "Add Department" within the setup wizard and creates "Engineering" (her largest team). She optionally adds "Design" and "Operations."
- **System Response:** System creates Department records for each entry. Displays the created departments in a list with edit/delete options. The wizard shows a progress indicator.
- **Decision Point:** How many departments to create now vs later? The wizard allows adding multiple but also provides a "Skip — I'll do this later" option.
- **Friction Risk:** If department creation feels mandatory or the form is heavy (requiring manager assignment immediately), Sarah may abandon. Keep it to name + optional description only.
- **Error Recovery:** Duplicate department name → "A department with this name already exists." Empty name → inline validation.


### Step 10: Create Job Titles

- **Action:** Sarah adds common job titles: "Software Engineer", "Designer", "Operations Manager", "HR Manager."
- **System Response:** System creates JobTitle records. Titles appear in a simple editable list. Wizard advances.
- **Decision Point:** Create all titles now or add as needed? Wizard communicates: "You can always add more later from Settings."
- **Friction Risk:** Over-engineering at setup time. Keep this step optional with clear skip affordance.
- **Error Recovery:** Duplicate title → "This job title already exists."

### Step 11: Review Setup Summary

- **Action:** Sarah reviews a summary page showing: Organisation name, timezone, currency, working days, leave year, departments created, job titles created.
- **System Response:** System displays a clean summary card with all configured values. Provides "Edit" links next to each section. Shows a prominent "Complete Setup" button.
- **Decision Point:** Sarah confirms everything looks correct. She notices she forgot to set currency to SGD and clicks "Edit" next to Regional.
- **Friction Risk:** If the summary is too long or visually dense, Sarah may skip review and miss errors.
- **Error Recovery:** Any edit takes Sarah to that specific section; on save, returns to summary. No data loss.

### Step 12: Complete Setup and Reach Dashboard

- **Action:** Sarah clicks "Complete Setup."
- **System Response:** System marks the organisation setup as complete (no longer shows wizard on next login). Redirects Sarah to the Owner/Admin dashboard. Dashboard shows: 0 employees, 0 pending items, with prominent call-to-action: "Add your first employee" and "Invite your HR team."
- **Decision Point:** None — natural progression.
- **Friction Risk:** Empty dashboard with no guidance causes confusion. Rich empty states with next-action prompts are essential.
- **Error Recovery:** N/A.

### Step 13: Invite First Team Member (HR Admin)

- **Action:** Sarah clicks "Invite Member" from the dashboard prompt (or navigates to Settings > Members). She enters priya@northstar.io and selects role "HR Administrator."
- **System Response:** System validates email format, checks the email is not already a member, creates an Invitation record (token, role: HR Admin, expiry: 7 days), sends the invitation email, and displays: "Invitation sent to priya@northstar.io." The pending invitation appears in the members list.
- **Decision Point:** Which role to assign? Sarah sees clear role descriptions: Owner (full control), HR Admin (employee management, payroll), Manager (team approvals), Employee (self-service).
- **Friction Risk:** Role selection confusion. Brief descriptions under each role option help. Tooltip: "HR Administrator can manage employees, leave, attendance, and payroll but cannot change organisation ownership."
- **Error Recovery:** Email already a member → "This person is already a member." Invalid email → inline validation. Email service failure → invitation created, email queued for retry, message: "Invitation created. Email delivery may be delayed."


### Step 14: Verify Invitation Delivery and First Session Complete

- **Action:** Sarah sees the confirmation and notices the dashboard now shows "1 pending invitation." She may explore the dashboard, settings, or sign out.
- **System Response:** Dashboard updates to reflect the pending invitation. The "Getting Started" checklist (if implemented) shows progress: ✓ Created organisation, ✓ Configured settings, ✓ Created departments, ✓ Invited first member. Remaining: "Add employees", "Configure leave policies."
- **Decision Point:** Continue exploring or come back later? Sarah is satisfied with the setup and signs out.
- **Friction Risk:** None at this stage — Sarah has accomplished her goal.
- **Error Recovery:** N/A.

---

### Success State

Sarah has a fully configured organisation with:
- Organisation "Northstar Studios" created with SGD currency, Asia/Singapore timezone, Mon-Fri working schedule
- Three departments (Engineering, Design, Operations)
- Four job titles defined
- Default leave types (Annual, Sick, Unpaid) seeded
- Default document categories seeded
- HR Admin (Priya) invited and awaiting acceptance
- Audit trail captures all setup actions

### Related Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Registration-to-dashboard time | < 5 minutes | Time from first click to reaching configured dashboard |
| Setup wizard completion rate | > 80% | Percentage of registrants who complete all wizard steps |
| First invitation sent rate | > 60% | Percentage of new owners who invite at least one member in first session |
| Setup abandonment point | Identify | Track which wizard step has highest drop-off |
| Time to first employee added | < 24 hours | Time from registration to first employee record created |

---


## 2. HR Administrator Daily Journey

**Persona:** Priya — HR Manager, 30, managing 80 employees across multiple departments
**Starting Context:** Priya arrives at work Monday morning. She signs into HR Daddy to review the weekend's activity and handle the day's HR operations. She has pending items from leave requests submitted over the weekend, attendance issues from Friday, an onboarding task overdue, and a document about to expire.
**User Goal:** Triage and resolve all pending HR items efficiently — review dashboard, process leave requests, fix attendance issues, check onboarding progress, and handle document expiry.

---

### Step 1: Sign In and Review Admin Dashboard

- **Action:** Priya signs in with her credentials at the start of the workday.
- **System Response:** System authenticates Priya, identifies her role as HR Administrator in Northstar Studios, and loads the Admin Dashboard. The dashboard displays key metrics: 78 active employees, 3 pending leave requests, 2 missing clock-outs (Friday), 1 overdue onboarding task, 1 expiring document (7 days), 12 employees present today so far. Notification bell shows 6 unread notifications.
- **Decision Point:** Priya scans the dashboard to prioritise. She decides to handle leave requests first (employees are waiting for approval), then attendance issues, then onboarding.
- **Friction Risk:** Dashboard information overload. Metrics should be prioritised by urgency — pending leave and missing clock-outs at the top. Low-priority items (upcoming birthdays) at the bottom.
- **Error Recovery:** Dashboard query failure for one widget should not block the entire page. Each widget loads independently with individual error states.

### Step 2: Process Pending Leave Requests

- **Action:** Priya clicks on "3 Pending Leave Requests" from the dashboard widget, navigating to the Leave Approval inbox.
- **System Response:** System displays three pending requests in a list: (1) Alex — Annual Leave, 3 days, Dec 23-25, submitted Saturday. (2) Maya — Sick Leave, 1 day, today (Monday), submitted Sunday night with medical certificate attached. (3) Raj — Annual Leave, 5 days, Jan 6-10, submitted Friday. Each entry shows: employee name, leave type, dates, days requested, current team availability for those dates.
- **Decision Point:** Priya reviews each request. For Maya's sick leave (already today), she prioritises immediate approval. For Alex's holiday leave, she checks team calendar. For Raj's request, she checks January workload.
- **Friction Risk:** If the approval inbox doesn't show team calendar context inline, Priya must navigate away to check availability — back-and-forth disrupts flow.
- **Error Recovery:** If a request was already decided by the Owner (concurrent approval), the list refreshes and removes it with a note: "Decided by Sarah (Owner)."


### Step 3: Approve and Reject Leave with Context

- **Action:** Priya approves Maya's sick leave (clicks "Approve", adds note "Get well soon"). She approves Alex's holiday leave after confirming no conflicts on the team calendar. She rejects Raj's 5-day request because the entire Engineering team is needed for a launch in early January — she adds a reason: "January launch sprint — please consider alternative dates after Jan 15."
- **System Response:** For each approval: system updates LeaveRequest status to Approved, creates LeaveApproval record, confirms balance deduction, sends notification to the employee. For the rejection: system updates status to Rejected, restores any reserved balance, sends notification to Raj with the rejection reason. Dashboard count updates from 3 → 0 pending. Success messages shown inline.
- **Decision Point:** For the rejection, Priya considers whether to approve partially (fewer days) — V1 requires full approve or reject; she'll suggest Raj resubmit for different dates.
- **Friction Risk:** If approval requires navigating to a separate page per request, the flow is slow. Inline approve/reject with optional note directly in the list is faster.
- **Error Recovery:** Concurrent decision conflict → "This request has already been decided." Network failure on approval → retry with idempotent request (same decision not applied twice).

### Step 4: Resolve Missing Clock-Outs

- **Action:** Priya clicks on "2 Missing Clock-Outs" from the dashboard. She sees: (1) David clocked in Friday 09:02, never clocked out. (2) Li Wei clocked in Friday 08:45, never clocked out.
- **System Response:** System shows the attendance correction interface with original records. For each, it shows the clock-in time and a status of "Missing Clock-Out" highlighted in amber. Provides "Add Clock-Out" and "Contact Employee" actions.
- **Decision Point:** Priya messages David and Li Wei on Slack to ask when they left. David replies "left at 18:30." Li Wei says "forgot — left around 17:00."
- **Friction Risk:** If the correction flow requires excessive form fields (justification, category, approval), it slows Priya down for a routine fix. Keep it simple: corrected time + reason.
- **Error Recovery:** If Priya enters an illogical time (clock-out before clock-in) → validation error: "Clock-out time must be after clock-in time (09:02)."

### Step 5: Apply Attendance Corrections

- **Action:** Priya opens David's record, enters clock-out time 18:30, reason: "Employee forgot to clock out — confirmed via Slack." She repeats for Li Wei with 17:00.
- **System Response:** System updates each AttendanceRecord: sets clockOut, calculates duration (David: 9h 28m, Li Wei: 8h 15m), marks record as "corrected", preserves original state in audit metadata, sends notification to each employee: "Your attendance on Friday has been corrected by HR." Dashboard "Missing Clock-Outs" count drops to 0. Audit events created for each correction.
- **Decision Point:** None — routine correction.
- **Friction Risk:** If the notification to the employee is alarming ("Your attendance has been MODIFIED"), it may create unnecessary concern. Tone should be neutral: "updated" not "modified."
- **Error Recovery:** Correction reason left empty → validation: "A reason is required for attendance corrections."


### Step 6: Check Onboarding Progress

- **Action:** Priya clicks on "1 Overdue Onboarding Task" from the dashboard widget.
- **System Response:** System shows the overdue task: "Set up workstation" for new hire Jun (started last Wednesday), assigned to David (Engineering Manager), due date was Friday — now 2 days overdue. Shows the onboarding progress for Jun: 4/7 tasks complete, 1 overdue, 2 pending.
- **Decision Point:** Priya decides whether to reassign the task, extend the deadline, or nudge David. She chooses to send a reminder to David.
- **Friction Risk:** If the overdue task view doesn't show WHO is responsible and HOW overdue, Priya can't act quickly. Context must be immediate.
- **Error Recovery:** If David's employee record is deactivated (edge case), the task shows "Assignee unavailable — reassign required."

### Step 7: Follow Up on Overdue Task

- **Action:** Priya clicks "Remind Assignee" (or manually messages David). She adds a note to the task: "David — please complete workstation setup for Jun today. He needs it for the client meeting tomorrow."
- **System Response:** System sends a notification to David: "Reminder: Overdue onboarding task — Set up workstation for Jun (due 2 days ago)." Task note is saved with timestamp and author (Priya). No status change — task remains pending/overdue until David marks it complete.
- **Decision Point:** If David doesn't respond by EOD, Priya may reassign the task to another engineer.
- **Friction Risk:** If the notification system is noisy (David already gets many notifications), the reminder may be lost. Consider escalation options for V2.
- **Error Recovery:** Note cannot be empty → validation.

### Step 8: Handle Expiring Document

- **Action:** Priya clicks on "1 Expiring Document" from the dashboard. She sees: Employee Li Wei's "Safety Certification" expires in 7 days.
- **System Response:** System shows the document details: document title, category (Certifications), employee name, current expiry date, uploaded date. Provides actions: "Notify Employee", "View Document", "Update Expiry."
- **Decision Point:** Priya needs to ask Li Wei to provide an updated certification. She clicks "Notify Employee."
- **Friction Risk:** If the expiry warning doesn't show enough context (which cert? when does it expire?), Priya must click through to determine urgency.
- **Error Recovery:** N/A — read-only with action options.


### Step 9: Send Document Expiry Notification

- **Action:** Priya clicks "Notify Employee" which sends Li Wei a notification about the expiring certification.
- **System Response:** System sends in-app notification to Li Wei: "Your Safety Certification expires on [date]. Please upload a renewed certificate." The notification includes a link to the Documents section. Dashboard expiry widget remains (clears only when document is replaced or expiry updated).
- **Decision Point:** None — straightforward notification action.
- **Friction Risk:** If the employee doesn't have platform access (no login), the notification can't be delivered. System should indicate: "This employee does not have platform access — consider emailing them directly."
- **Error Recovery:** Notification system failure → queued for retry; Priya sees "Notification queued — delivery may be delayed."

### Step 10: Review Notifications and Clear Inbox

- **Action:** Priya clicks the notification bell (6 unread) and reviews: leave submissions (already handled), attendance alerts (handled), onboarding reminders (handled), one system notification about a policy update.
- **System Response:** Notifications display in reverse chronological order with clear read/unread styling. Priya clicks "Mark All as Read" to clear the badge count. Each notification shows the relevant action taken (if any) as a link.
- **Decision Point:** None — cleanup action.
- **Friction Risk:** If notifications don't link directly to the relevant item (e.g., clicking a leave notification should open that specific request), Priya loses context.
- **Error Recovery:** "Mark All as Read" is immediately reversible in the current session (undo toast) in case of misclick.

---

### Success State

Priya has completed her morning triage:
- 3 leave requests processed (2 approved, 1 rejected with reason)
- 2 missing clock-outs corrected with reasons and employee notifications
- 1 overdue onboarding task followed up with assignee reminder
- 1 expiring document flagged with employee notification sent
- All notifications reviewed and cleared
- Dashboard shows zero pending/urgent items
- Complete audit trail of all actions taken

### Related Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to clear pending queue | < 15 minutes | Time from sign-in to zero pending items on dashboard |
| Leave response time | < 4 hours | Time from leave submission to approval/rejection |
| Attendance correction turnaround | Same day | Missing clock-outs resolved within the same business day |
| Overdue onboarding task resolution | < 48 hours | Time from overdue to completed or reassigned |
| Dashboard zero-state frequency | Daily | How often HR achieves zero pending items |

---


## 3. Employee First-Week Journey

**Persona:** Alex — Software Developer, 28, joining Northstar Studios as a new hire
**Starting Context:** Alex received an invitation email from Priya (HR Admin) to join HR Daddy. He has never used the platform before. It is Monday — his first day. He needs to set up his account, complete his profile, review onboarding tasks, mark attendance, and access his employment documents.
**User Goal:** Accept the invitation, set up his profile, complete onboarding tasks, clock in for attendance, and access documents — becoming fully operational on the platform within his first week.

---

### Step 1: Receive and Open Invitation Email

- **Action:** Alex opens the invitation email from HR Daddy: "Priya has invited you to join Northstar Studios on HR Daddy. Click here to accept."
- **System Response:** Email contains: organisation name, inviter name, a clear "Accept Invitation" button, and expiry notice ("This link expires in 7 days").
- **Decision Point:** None — Alex clicks the accept link.
- **Friction Risk:** Email lands in spam/promotions folder. Subject line must be clear and recognisable (not generic). Sender should be branded: "HR Daddy (via Northstar Studios)."
- **Error Recovery:** Link expired → "This invitation has expired. Please contact your HR administrator for a new invitation." Link already used → "This invitation has already been accepted. Sign in instead."

### Step 2: Accept Invitation and Create Account

- **Action:** Alex clicks the invitation link. Since he has no existing account, the system shows a registration form pre-filled with his email (alex@northstar.io). He enters his full name and creates a password.
- **System Response:** System validates the invitation token (not expired, not used), displays the registration form with email pre-filled and read-only. On submit: creates User record (status: verified — invitation proves email ownership), creates Membership (role: Employee), marks invitation as accepted, sends an in-app notification to Priya: "Alex accepted your invitation." Redirects Alex to the Northstar Studios dashboard.
- **Decision Point:** None — straightforward account creation.
- **Friction Risk:** If the password requirements are strict but unclear, Alex may struggle. Show requirements inline and validate as he types.
- **Error Recovery:** Password too weak → inline requirements displayed (min 8 chars, uppercase, lowercase, number). Token invalid → "This invitation is no longer valid."

### Step 3: Land on Employee Dashboard (First Visit)

- **Action:** Alex is redirected to his Employee Dashboard after account creation.
- **System Response:** Dashboard shows a first-time user experience: Welcome banner "Welcome to Northstar Studios, Alex!" with checklist: (1) Complete your profile, (2) Review onboarding tasks, (3) Clock in for today, (4) Check your documents. Clock-in button is prominently displayed. Leave balance shows "Annual Leave: 18 days" (pro-rated for mid-year start). Notification bell shows 1 notification (welcome message).
- **Decision Point:** Alex decides to complete his profile first as prompted by the checklist.
- **Friction Risk:** Overwhelming first experience if too much information is displayed. The checklist should guide sequentially. Progressive disclosure — show one suggested action at a time.
- **Error Recovery:** If employee record hasn't been created yet (edge case — invitation without employee record), show: "Your HR team is setting up your profile. Check back soon."


### Step 4: Complete Personal Profile

- **Action:** Alex clicks "Complete your profile" and navigates to his profile page > Personal tab. He adds: phone number, emergency contact (name, relationship, phone), personal email, address.
- **System Response:** System displays an editable form with current data (some fields pre-filled by HR: name, work email, department: Engineering, job title: Software Engineer). Alex can edit: phone, emergency contact, address. Fields he cannot edit (name, email) are displayed as read-only with note: "Contact HR to change." On save, system validates and persists. Progress indicator updates: "Profile 70% complete."
- **Decision Point:** Which fields to fill now vs later? The form clearly marks required vs optional. Emergency contact is flagged as important.
- **Friction Risk:** Too many fields at once. Consider splitting into sections with save-per-section rather than one giant form. Mobile-friendly layout essential for employees filling in on their phone.
- **Error Recovery:** Invalid phone format → inline validation. Save failure → "Changes could not be saved. Please try again." (no data loss — form retains entered values).

### Step 5: Upload Profile Photo

- **Action:** Alex clicks the avatar placeholder on his profile and uploads a headshot photo.
- **System Response:** System accepts the image (JPG/PNG, max 2MB), displays a crop/preview tool, and saves. Profile photo appears in directory, profile, and navigation avatar. Confirmation: "Photo updated."
- **Decision Point:** Optional step — Alex can skip this.
- **Friction Risk:** File too large → clear error with size limit. Wrong format → "Please upload a JPG or PNG image."
- **Error Recovery:** Upload failure → "Upload failed. Please try a smaller file or different format."

### Step 6: Review Onboarding Tasks

- **Action:** Alex clicks "Review onboarding tasks" from the checklist (or navigates to the Onboarding section). He sees 7 tasks assigned by HR:
  1. ✓ Set up email account (completed by IT on Day 1)
  2. ☐ Complete tax forms — assigned to Alex, due Day 2
  3. ☐ Read employee handbook — assigned to Alex, due Day 3
  4. ☐ Set up workstation (assigned to David/Manager, due Day 3) — pending
  5. ☐ Meet team members — assigned to Alex, due Day 5
  6. ☐ Complete safety briefing — assigned to Alex, due Day 5
  7. ☐ First week check-in with manager — assigned to David, due Day 5
- **System Response:** System displays the onboarding checklist with clear status indicators (complete/pending/overdue), due dates, and assignee for each task. Alex's own tasks have a "Mark Complete" button. Tasks assigned to others show "Assigned to [name]" without action buttons.
- **Decision Point:** Alex identifies which tasks he needs to do today (Day 1: none due yet, but he can work ahead on tax forms).
- **Friction Risk:** If task descriptions are vague ("Complete tax forms" without instructions), Alex doesn't know what to do. Tasks should have descriptions or links to resources.
- **Error Recovery:** N/A — read-only list view.


### Step 7: Complete an Onboarding Task

- **Action:** Alex completes the tax forms (offline), then returns to HR Daddy and clicks "Mark Complete" on "Complete tax forms."
- **System Response:** System updates task status to Completed, records completion timestamp and Alex as the completing user. Progress updates: "3/7 tasks complete." If all tasks were complete, onboarding status would change to "Completed" with a congratulations notification. System checks if all tasks are done — they're not, so onboarding remains "In Progress."
- **Decision Point:** None — simple action.
- **Friction Risk:** If "Mark Complete" requires additional input (notes, evidence), it slows down simple tasks. Keep completion one-click for most tasks; only require notes for specific task types.
- **Error Recovery:** Double-click prevention — button disables after first click. Already-completed task shows "Already completed" if accessed again.

### Step 8: Clock In for the First Time

- **Action:** Alex notices it's 09:05 and he hasn't clocked in yet. He clicks the prominent "Clock In" button on the dashboard.
- **System Response:** System verifies no open session exists, presents type selector ("Office" or "Remote"), Alex selects "Office", system records clock-in time (09:05 SGT), creates AttendanceRecord, displays confirmation: "Clocked in at 09:05. Have a great day!" Button changes to "Clock Out" with a live duration timer. Dashboard attendance widget shows "Clocked In - 0h 0m."
- **Decision Point:** Office vs Remote selection. Alex is in the office today.
- **Friction Risk:** If clock-in requires multiple steps (navigate to attendance page, then click button), Alex may forget. The button should be on the main dashboard, highly visible.
- **Error Recovery:** Already clocked in → "You're already clocked in since [time]." Not an employee (edge case) → "Attendance recording is not available for your account."

### Step 9: Clock Out at End of Day

- **Action:** At 18:10, Alex clicks "Clock Out" on his dashboard.
- **System Response:** System validates an open session exists, records clock-out time (18:10), calculates duration (9h 5m), updates AttendanceRecord (status: closed), displays: "Clocked out at 18:10. Total today: 9h 5m." Button reverts to "Clock In." Dashboard attendance shows: "Today: 9h 5m."
- **Decision Point:** None.
- **Friction Risk:** If Alex forgets to clock out, the system will flag it as "missing clock-out" the next day. A subtle reminder near end-of-working-hours could help: "Still clocked in. Remember to clock out when you leave."
- **Error Recovery:** Not clocked in → "You're not currently clocked in." Server time used — no dependency on client clock.


### Step 10: Access Employment Documents

- **Action:** On Day 3, Alex navigates to "My Documents" to find his employment contract and the employee handbook.
- **System Response:** System displays Alex's documents filtered by visibility (only documents he's permitted to see): Employment Contract (uploaded by HR, category: Contracts), Employee Handbook (category: Policies), Tax Form Template (category: Identity). Each entry shows: title, category, upload date, and a "Download" button.
- **Decision Point:** Alex downloads his employment contract to review terms.
- **Friction Risk:** If documents are disorganised (no categories, unclear titles), Alex can't find what he needs. Category filters and search help.
- **Error Recovery:** Download failure → "File could not be retrieved. Please try again or contact HR." Document deleted/moved by HR since last view → "This document is no longer available."

### Step 11: View Leave Balance and Understand Entitlements

- **Action:** On Day 4, Alex navigates to "My Leave" to understand his annual leave entitlement.
- **System Response:** System displays Alex's leave balances for the current leave year: Annual Leave — Allowance: 18 days (pro-rated from mid-year start), Used: 0, Pending: 0, Available: 18. Sick Leave — Allowance: 14 days, Available: 14. Shows a "Request Leave" button and a brief explanation of the leave policy (accrual method, carry-over rules).
- **Decision Point:** Alex notes his entitlement for future planning. He doesn't submit a request now.
- **Friction Risk:** If leave balance shows confusing numbers without explanation (what does "pending" mean?), Alex will be confused. Tooltips or a "How is this calculated?" link help.
- **Error Recovery:** No balance configured (HR hasn't set up leave policy yet) → "Leave balances have not been configured yet. Contact HR for information about your leave entitlement."

### Step 12: Complete Remaining Onboarding Tasks and Achieve Full Setup

- **Action:** By end of Day 5 (Friday), Alex has completed all his assigned tasks: tax forms, employee handbook read, meeting team members, and safety briefing. He marks each complete throughout the week.
- **System Response:** On the final task completion, system updates EmployeeOnboarding status to "Completed." Sends notification to Priya: "Alex's onboarding is complete — all 7 tasks done." Alex sees a completion banner: "Onboarding Complete! You're all set." The first-week checklist on the dashboard shows all items checked. Dashboard transitions from "new employee" mode to the standard employee dashboard layout.
- **Decision Point:** None — natural progression throughout the week.
- **Friction Risk:** If David (manager) hasn't completed his assigned tasks (workstation setup, check-in), Alex's onboarding shows incomplete despite Alex doing his part. Clear distinction between "my tasks" and "others' tasks" prevents frustration.
- **Error Recovery:** If a task is accidentally marked complete → HR Admin can reopen it (Alex cannot). Alex can add a note: "Marked by mistake — please reopen."

---

### Success State

By end of first week, Alex has:
- Active account linked to Northstar Studios
- Complete personal profile with photo, contact details, emergency contact
- All employee-assigned onboarding tasks completed
- 5 days of attendance recorded (Mon-Fri clock in/out)
- Employment documents accessed and reviewed
- Leave entitlements understood
- Standard employee dashboard showing his regular workspace

### Related Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Invitation acceptance time | < 1 hour | Time from invitation email to account creation |
| Profile completion rate | 100% by Day 2 | Percentage of required profile fields completed |
| Onboarding task completion | 100% by Day 5 | All employee-assigned tasks completed within due dates |
| First clock-in timing | Day 1 | Employee records attendance on first day |
| Document access rate | > 90% | Percentage of new hires who view their contract |
| Platform adoption signal | Daily login by Day 5 | New employee returns to platform daily |

---


## 4. Manager Leave-Approval Journey

**Persona:** David — Engineering Lead, 40, manages 12 direct reports
**Starting Context:** David receives a notification that one of his team members (Alex) has submitted a 3-day leave request for next week. David is in the middle of sprint planning and needs to quickly assess whether to approve based on team availability, project deadlines, and Alex's leave balance.
**User Goal:** Review the leave request with full context, make an informed approval decision, and ensure the team calendar is updated — all in under 2 minutes.

---

### Step 1: Receive Leave Notification

- **Action:** David sees a notification (in-app bell badge increments, and optionally an email): "Alex has requested 3 days of Annual Leave (Dec 18-20)."
- **System Response:** Notification appears in the notification panel with: employee name, leave type, dates, and number of days. The notification is clickable — links directly to the leave request detail view.
- **Decision Point:** David decides to review now (during a break) rather than deferring.
- **Friction Risk:** If the notification doesn't contain enough context (just "Alex submitted a leave request"), David must click through to assess urgency. Include dates and duration in the notification preview.
- **Error Recovery:** Notification link leads to 404 (request withdrawn before David clicks) → "This leave request is no longer pending — it was withdrawn by the employee."

### Step 2: Open Leave Request with Full Context

- **Action:** David clicks the notification and lands on the leave request detail page.
- **System Response:** System displays comprehensive context for the decision:

  **Request Details:**
  - Employee: Alex (Software Engineer, Engineering)
  - Leave Type: Annual Leave
  - Dates: December 18-20 (Wednesday to Friday)
  - Duration: 3 working days
  - Reason: "Family visiting from overseas"
  - Attachment: None
  - Submitted: Saturday at 14:30

  **Balance Context:**
  - Alex's Annual Leave balance: 15 days remaining (of 18 allowance)
  - After this request: 12 days remaining

  **Team Availability (Dec 18-20):**
  - Maya: On approved leave (Dec 19-20)
  - Everyone else: Available
  - Team capacity: 10/12 (83%) on Dec 18, 9/12 (75%) on Dec 19-20

  **Decision Actions:** "Approve" (green), "Reject" (with reason required)

- **Decision Point:** David evaluates: Alex has sufficient balance, the team retains 75%+ capacity, no critical deadlines that week (sprint ends Dec 17). He decides to approve.
- **Friction Risk:** If the team calendar context is not shown inline, David must navigate to a separate calendar view, remember the dates, and come back — major friction. All context must be on one screen.
- **Error Recovery:** Balance shows insufficient (edge case — someone approved leave since submission, reducing Alex's balance) → Warning banner: "Note: Alex's balance has changed since submission. Current available: [X] days."


### Step 3: Approve the Request

- **Action:** David clicks "Approve" and optionally adds a note: "Enjoy time with family!"
- **System Response:** System validates: (1) request is still Pending (not already decided), (2) David is Alex's direct manager (reporting relationship confirmed), (3) Alex's balance is sufficient. System updates LeaveRequest status to Approved, creates LeaveApproval record (approver: David, decision: approved, note, timestamp), confirms balance deduction (15 → 12 available). Sends notification to Alex: "Your leave request (Dec 18-20) has been approved by David." Displays success message to David: "Leave approved. Alex has been notified."
- **Decision Point:** None — confirmation action.
- **Friction Risk:** If the approve action requires typing a note (mandatory), it slows David down for straightforward approvals. Note should be optional for approvals (mandatory only for rejections).
- **Error Recovery:** Concurrent approval by HR Admin → "This request was already approved by Priya." Request withdrawn by Alex while David was reviewing → "This request has been withdrawn by the employee." Network failure → retry with idempotent check (won't double-approve).

### Step 4: Verify Team Calendar Updated

- **Action:** David navigates to "Team Calendar" to confirm the approved leave appears.
- **System Response:** Team leave calendar displays December in a month view. Alex's leave (Dec 18-20) now shows as an approved block (solid colour — e.g., blue for Annual Leave). Maya's leave (Dec 19-20) shows adjacent. The calendar clearly distinguishes approved (solid) from pending (striped/hatched) leave blocks. Hover on a block shows employee name, leave type, and dates.
- **Decision Point:** David notices two team members off on Dec 19-20 and makes a mental note for sprint planning. No further action needed.
- **Friction Risk:** If the calendar is hard to read (too small, poor contrast, no legend), David can't quickly scan team availability. Colour coding and clear labels are essential.
- **Error Recovery:** Calendar data stale (caching) → refresh button or auto-refresh on navigation.

### Step 5: Handle a Rejection Scenario (Alternative Flow)

- **Action:** (Alternative scenario) If David needs to reject — perhaps the team has a critical deployment on those dates — he clicks "Reject." System requires a reason.
- **System Response:** System displays a text field: "Reason for rejection (required)." David types: "Critical deployment scheduled Dec 19. Please consider Dec 26-28 instead." On submit: system validates reason is not empty, updates request to Rejected, restores Alex's reserved balance (pending → available), sends notification to Alex with the rejection reason and suggestion.
- **Decision Point:** David considers whether to suggest alternative dates. The rejection form has an optional "Suggest alternative dates" field.
- **Friction Risk:** If the rejection reason field is too small or doesn't support multi-line text, David can't provide helpful feedback. Allow reasonable length (500 chars) with a text area.
- **Error Recovery:** Empty reason → "A reason is required when rejecting a leave request." Accidental rejection → David can ask HR Admin to override (LEAVE-015). No "undo" for rejections — deliberate design for accountability.


### Step 6: Batch Processing Multiple Requests

- **Action:** On a busy Monday, David has 3 pending requests from his team. He navigates to "Leave Approvals" inbox to process them together.
- **System Response:** Inbox shows all pending requests from direct reports in a list/card format. For each: employee name, dates, leave type, day count, and team availability indicator (green = no conflicts, amber = some overlap, red = high overlap). David can process each with one-click approve or open for details.
- **Decision Point:** Quick triage — David approves two straightforward requests directly from the list (green indicators) and opens the third (amber) for detailed review.
- **Friction Risk:** If batch approval is not supported (must open each request individually), multiple requests become tedious. Even if full batch-select-approve isn't V1, inline approve from the list view saves time.
- **Error Recovery:** If one approval fails in a batch (unlikely for individual decisions), only that one shows an error; others succeed independently.

### Step 7: Check Manager Dashboard Metrics

- **Action:** David returns to his Manager Dashboard to confirm pending items are cleared.
- **System Response:** Dashboard shows: "Pending Leave Approvals: 0", "Team Attendance Today: 10/12 present", "Overdue Onboarding Tasks: 1 (workstation setup for Jun — overdue)." David notes the onboarding task he needs to handle.
- **Decision Point:** David sees the overdue task reminder and plans to complete it today.
- **Friction Risk:** If the manager dashboard is identical to the employee dashboard (no team context), David gains no value from it. The team-specific widgets are the differentiator.
- **Error Recovery:** N/A — informational view.

### Step 8: Receive Withdrawal Notification (Edge Case)

- **Action:** Alex decides to withdraw his pending request before David reviews it (Alex found out his family changed plans). David receives: "Alex has withdrawn their leave request (Dec 18-20)."
- **System Response:** Notification informs David; the request disappears from his approval inbox. If David had the inbox open, it refreshes or shows a banner: "1 request was withdrawn." No action needed from David.
- **Decision Point:** None — informational.
- **Friction Risk:** If David was actively typing a note to approve and the request vanishes, it may be confusing. A clear message: "This request was withdrawn while you were reviewing it" handles the race condition.
- **Error Recovery:** David tries to approve a withdrawn request → "This request has been withdrawn by the employee."

---

### Success State

David has:
- Reviewed leave request with full context (balance, team calendar, reason) in one view
- Made an informed approval decision in under 2 minutes
- Alex notified immediately of the decision
- Team calendar automatically updated to reflect the approved leave
- Approval inbox cleared to zero pending items
- Complete audit record of the decision (approver, timestamp, note)

### Related Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Notification-to-decision time | < 5 minutes | Time from notification receipt to approval/rejection action |
| Context sufficiency rate | > 95% | Percentage of decisions made without navigating away from request page |
| Approval inbox zero frequency | Daily | How often manager achieves zero pending approvals |
| Rejection-with-suggestion rate | > 50% | Percentage of rejections that include alternative date suggestions |
| Average requests per manager/week | Tracked | Workload monitoring for capacity planning |

---


## 5. Monthly HR Operations Journey

**Persona:** Priya — HR Manager, 30, responsible for attendance finalization, payroll record preparation, and payslip publication
**Starting Context:** It is the first week of February. Priya needs to finalize January's attendance records, create the January payroll period, enter earnings/deductions for all 78 active employees, get Owner approval, and publish payslips. The organisation pays monthly; payroll must be ready by the 5th of each month.
**User Goal:** Complete the full monthly payroll cycle — from attendance review through payslip publication — accurately and within the deadline, maintaining a complete audit trail.

---

### Step 1: Review January Attendance Summary

- **Action:** Priya navigates to Attendance > Monthly Summary and selects January 2024.
- **System Response:** System displays an organisation-wide attendance summary for January: Total working days: 23, employees tracked: 78. Summary table showing per-employee: days present, total hours, average hours/day, late arrivals count, missing clock-outs (unresolved), remote days. Flagged items at the top: 3 employees with unresolved missing clock-outs, 2 employees with <80% attendance (without approved leave to explain). Filter options: by department, by status.
- **Decision Point:** Priya needs to resolve all outstanding attendance issues before creating payroll records (attendance feeds into pay calculations for hourly workers or attendance-based deductions).
- **Friction Risk:** If the summary requires scrolling through 78 rows without filters, it's unusable. Department grouping, anomaly highlighting (red for issues), and export options are essential.
- **Error Recovery:** Summary calculation timeout for large org → progressive loading with "Loading department..." indicators.

### Step 2: Resolve Outstanding Attendance Issues

- **Action:** Priya clicks on the 3 flagged missing clock-outs. She contacts employees, confirms actual departure times, and applies corrections (as in Journey 2, Steps 4-5).
- **System Response:** For each correction: system updates the record, calculates duration, marks as corrected, creates audit event, notifies employee. After all corrections, the "unresolved" count drops to zero. The monthly summary recalculates to reflect corrected hours.
- **Decision Point:** For the 2 employees with low attendance (no approved leave), Priya investigates — one had unapproved absences. She makes a note for the performance conversation but does not block payroll.
- **Friction Risk:** If resolving each issue requires navigating away from the summary and back, the flow is inefficient. A "Quick Correct" modal from the summary table saves time.
- **Error Recovery:** Correction reason required → validation. Clock-out time illogical → validation. All corrections are audited and reversible (a new correction can override the previous one).

### Step 3: Export Attendance for Records

- **Action:** Priya clicks "Export" on the January attendance summary to generate a CSV backup before proceeding to payroll.
- **System Response:** System generates a CSV file: Employee Name, Employee ID, Date, Clock-In, Clock-Out, Duration, Type (Office/Remote), Status (Normal/Corrected/Manual). File downloads automatically. Audit event created: "Attendance exported for January 2024 by Priya."
- **Decision Point:** None — routine backup.
- **Friction Risk:** Large export takes time → progress indicator: "Generating export for 78 employees..."
- **Error Recovery:** Export generation failure → "Export failed. Please try again." Partial export → never delivered; always all-or-nothing.


### Step 4: Create January Payroll Period

- **Action:** Priya navigates to Payroll > Periods and clicks "Create Period." She enters: Name "January 2024", Start Date: Jan 1, End Date: Jan 31.
- **System Response:** System validates dates don't overlap with existing periods (no December period open). Creates PayrollPeriod record (status: Draft, currency: SGD from org settings). Displays the new period with an empty employee list and "Add Employees" action. Audit event created.
- **Decision Point:** None — straightforward creation.
- **Friction Risk:** If the system doesn't suggest dates based on the previous period, Priya must manually calculate. "Suggest Next Period" button that pre-fills Feb 1-28 after creating January would save time for subsequent months.
- **Error Recovery:** Overlapping dates → "Period dates overlap with December 2023 period. Please close or adjust the existing period." End before start → validation.

### Step 5: Add Employees to Payroll Period

- **Action:** Priya clicks "Add All Active Employees" to bulk-add all 78 active employees to the January period.
- **System Response:** System creates PayrollRecord entries for all 78 active employees. For each, pre-fills base salary from their compensation data on the employee record. Displays a table: Employee Name, Department, Base Salary (pre-filled), Earnings Total, Deductions Total, Net Pay. All net pay fields show the pre-filled base salary (no additional items yet). Count: "78 records created."
- **Decision Point:** Priya reviews the list to confirm all active employees are included and no deactivated employees are accidentally added.
- **Friction Risk:** If adding employees one-by-one (no bulk), this is impossibly tedious for 78 people. Bulk-add is essential. Also, if employees joined or left mid-month, their records need pro-rating — system should flag: "3 employees joined mid-month (pro-rata may apply)."
- **Error Recovery:** Employee already in period (duplicate) → skipped with note. Deactivated employee included → warning: "2 employees were deactivated during January. Include in payroll?" (yes — they worked part of the month).

### Step 6: Add Earnings and Allowances

- **Action:** Priya works through the payroll records. For each employee, she confirms base salary (most are correct from employee records) and adds any variable earnings: overtime hours for 5 employees, a performance bonus for 2 employees, transport allowance for all employees.
- **System Response:** For each record modification: system recalculates gross pay in real-time as line items are added. Display updates: Base Salary $5,000 + Overtime $450 + Transport Allowance $200 = Gross: $5,650. All calculations use decimal-safe arithmetic (integer cents internally). Running totals displayed at page bottom: Total Gross for all employees: $423,500.
- **Decision Point:** Priya cross-references overtime data from attendance records. System may show a "suggested overtime" based on hours exceeding standard (informational only — actual calculation is manual in V1).
- **Friction Risk:** Entering data for 78 employees individually is time-consuming. Consider bulk actions: "Apply Transport Allowance to all employees" with a default amount. Template-based entry for recurring items.
- **Error Recovery:** Negative amount entered → "Earnings must be positive. Use Deductions for amounts to subtract." Decimal precision loss → system enforces 2 decimal places. Save draft at any time — work is never lost.


### Step 7: Add Deductions

- **Action:** Priya adds standard deductions: CPF contributions (employer + employee portions), income tax withholding, and any loan repayments. She applies CPF bulk-calculation across all eligible employees.
- **System Response:** For each deduction line item: system recalculates net pay. Display: Gross $5,650 - CPF Employee $1,130 - Income Tax $250 = Net: $4,270. Net pay highlighted in green if positive, amber warning if zero, red warning if negative. Running totals update. System validates: Gross - Deductions = Net exactly (decimal-safe arithmetic ensures no rounding drift).
- **Decision Point:** Priya notices one employee has a net pay of -$50 (loan repayment exceeds remaining salary after CPF). System shows warning: "Net pay is negative for Li Wei (-$50). Review deductions." Priya adjusts the loan repayment to avoid negative pay.
- **Friction Risk:** Manual deduction entry for statutory contributions is tedious. In V2, templates or automatic statutory calculation could help. For V1, bulk-apply by percentage helps: "Apply 20% CPF to all full-time employees."
- **Error Recovery:** Negative net pay → warning (not blocking — may be intentional for advance recoupment, but flags for review). Decimal arithmetic ensures $5,650.00 - $1,130.00 - $250.00 = $4,270.00 exactly.

### Step 8: Save Draft and Review

- **Action:** Priya clicks "Save Draft" periodically throughout the process. Once all 78 records are complete, she clicks "Review Payroll" to see the period summary.
- **System Response:** System persists all records. Review summary shows: Period: January 2024, Employees: 78, Total Gross: $423,500, Total Deductions: $85,300, Total Net: $338,200, Currency: SGD. Breakdown by department available. Any warnings listed: "0 employees with missing earnings, 0 with negative net pay." Status remains Draft.
- **Decision Point:** Priya reviews totals against expected values. She compares with December: +$2,000 total (due to new hire + overtime). Satisfied, she prepares to submit for approval.
- **Friction Risk:** If the review page doesn't show a comparison to previous period, Priya has no benchmark to spot anomalies. "vs. Previous Period" column helps: "+5% vs Dec."
- **Error Recovery:** Spot an error → navigate back to the specific record and edit (period is still Draft). "Save Draft" is non-destructive and allows unlimited revisions.

### Step 9: Submit for Approval

- **Action:** Priya clicks "Submit for Approval" — this changes the period status to "Under Review" and locks records from further editing (by Priya).
- **System Response:** System validates all records are complete (every employee has at least one earning line item). Validation passes. Status changes to "Under Review." System sends notification to Sarah (Owner): "Payroll for January 2024 is ready for your approval. Total: $338,200 net across 78 employees." Priya sees: "Submitted for approval. Awaiting Owner sign-off."
- **Decision Point:** None — Priya has completed her work. Ball is in Sarah's court.
- **Friction Risk:** If the submission validation fails (e.g., 2 employees have no earnings), Priya must go back and fix. The system should pre-validate and show errors before the submit button becomes active: "Cannot submit: 2 records incomplete."
- **Error Recovery:** Validation failure → clear list of incomplete records with links. "3 employees have no earnings: [Alex], [Jun], [Maya] — add earnings before submitting."


### Step 10: Owner Reviews and Approves Payroll

- **Action:** Sarah (Owner) receives the notification, opens the payroll period, reviews the summary, and clicks "Approve."
- **System Response:** System displays the same summary Priya reviewed (read-only for Owner at this stage): totals, per-department breakdown, any warnings. Owner clicks "Approve" → system validates: period is Under Review, actor is Owner. Status changes to "Approved." All records are locked. Notification sent to Priya: "January payroll has been approved by Sarah." Audit event: `payroll_period.approved` with totals.
- **Decision Point:** Sarah reviews totals and compares to budget. If she spots an issue, she can "Reopen" (returns to Draft for Priya to edit). Otherwise, approves.
- **Friction Risk:** If Owner is unavailable (vacation, busy), payroll approval is blocked. V1 can allow HR Admin approval via org setting (`hr_admin_payroll_approve`). Separation of duties: the person who prepared shouldn't approve (enforced if multiple admins exist).
- **Error Recovery:** Owner clicks "Reopen" → period returns to Draft, Priya is notified: "Payroll reopened by Sarah. Reason: [please check Li Wei's overtime]." Priya corrects and resubmits.

### Step 11: Process External Payment

- **Action:** Priya processes the actual bank transfers outside HR Daddy (via banking portal, batch transfer, etc.). Once disbursement is confirmed, she returns to HR Daddy.
- **System Response:** N/A — this step happens outside the system. HR Daddy does not process actual payments in V1.
- **Decision Point:** Priya confirms all transfers completed successfully via her banking system.
- **Friction Risk:** Gap between "approved in system" and "actually paid" creates confusion. Clear status communication: "Approved" means locked but not yet disbursed. "Paid" means disbursement confirmed.
- **Error Recovery:** Payment fails for some employees (external) → Priya does not mark as paid yet; handles with banking team.

### Step 12: Mark Payroll as Paid

- **Action:** Priya returns to HR Daddy, opens the January period, and clicks "Mark as Paid." She enters payment date: February 3, 2024.
- **System Response:** System validates period is Approved. Updates status to "Paid." Records payment date. Displays: "January 2024 payroll marked as paid (Feb 3, 2024)." Audit event created.
- **Decision Point:** None — administrative confirmation.
- **Friction Risk:** If Priya forgets to mark as paid, the period stays in "Approved" forever. A reminder system: "January payroll approved 3 days ago — have payments been processed?" could help in V2.
- **Error Recovery:** Period not yet approved → "Period must be approved before marking as paid." Accidentally marked → no undo in V1 (but status is informational at this point; payslips not yet published).


### Step 13: Publish Payslips to Employees

- **Action:** Priya clicks "Publish Payslips" on the paid period.
- **System Response:** System generates an immutable Payslip record for each of the 78 employees. Each payslip contains: period dates, earnings breakdown (base + overtime + bonus + allowances), deductions breakdown (CPF + tax + loan), gross pay, net pay, currency (SGD), and organisation branding (Northstar Studios logo). Period status changes to "Published." System sends bulk notification to all 78 employees: "Your payslip for January 2024 is available." Displays confirmation: "78 payslips published and employees notified." Audit event: `payslips.published`.
- **Decision Point:** Priya confirms she's ready to publish (this is irreversible — published payslips are immutable). System shows a confirmation dialog: "Publish payslips to 78 employees? This cannot be undone."
- **Friction Risk:** Irreversibility creates anxiety. Clear confirmation with summary ("78 payslips, $338,200 total net") helps Priya confirm accuracy before committing. If she discovers an error post-publication, an adjustment period must be created (not editing published slips).
- **Error Recovery:** Publication partially fails (e.g., 75/78 generated before error) → atomic transaction: all or nothing. Either all 78 publish or none do. Retry if failed. Already published → "Payslips have already been published for this period."

### Step 14: Verify Employee Access and Close the Cycle

- **Action:** Priya checks that employees can access their payslips by viewing Alex's record (or by asking a colleague to confirm they received the notification and can view the payslip).
- **System Response:** Priya navigates to Employees > Alex > Payroll tab and sees January 2024 payslip available. She can view it as Alex would see it (respecting the same content — earnings, deductions, net). The payslip shows the Northstar Studios branding and is downloadable as PDF.
- **Decision Point:** Priya is satisfied the cycle is complete. She notes the completion time and plans for next month.
- **Friction Risk:** If an employee reports they can't see their payslip, Priya needs a way to verify from the admin side. The admin view of "Published Payslips" with a per-employee list and "View as Employee" option helps debug issues.
- **Error Recovery:** Employee can't access payslip (their account was deactivated between payment and publication — edge case) → Priya notes this and re-activates if needed, or provides a PDF directly via email.

---

### Success State

Priya has completed the full monthly cycle:
- January attendance finalized (all corrections applied, summary exported)
- Payroll period created with all 78 employees
- Earnings and deductions entered for every employee with decimal-safe calculations
- Payroll submitted and approved by Owner
- External payments processed and marked as paid
- Payslips published to all 78 employees (immutable records)
- Complete audit trail from start to finish
- Zero discrepancies: Gross - Deductions = Net for every employee
- All employees notified and can view their January payslip

### Related Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Attendance finalization time | < 1 day | Time from month-end to all attendance issues resolved |
| Payroll preparation time | < 2 days | Time from period creation to submission for approval |
| Approval turnaround | < 24 hours | Time from submission to Owner approval |
| Payslip publication date | By 5th of month | Consistent monthly publication deadline met |
| Calculation accuracy | 100% | Zero decimal rounding errors across all records |
| Employee payslip access rate | > 95% | Percentage of employees who view their payslip within 48 hours |
| Payroll cycle total time | < 5 days | End-to-end from month close to payslip publication |

---


## Cross-Journey Design Principles

The following principles apply across all user journeys:

### 1. Context on the Decision Screen
Every decision point should present all necessary context on a single screen. Managers shouldn't need to navigate away to check team calendars. HR shouldn't need to open separate tabs for attendance records while doing payroll.

### 2. Progressive Disclosure
Start with essential information and allow drilling deeper. Dashboard shows counts; clicking reveals lists; clicking items reveals details. Never overwhelm on first view.

### 3. Immediate Feedback
Every action provides immediate visual confirmation. Approvals show green success. Rejections show amber with the reason saved. Errors show inline red with specific guidance.

### 4. Recoverable Errors
Where possible, allow undo or correction. Where actions are irreversible (payslip publication, employee deactivation), require explicit confirmation with impact summary.

### 5. Audit Awareness
Users should feel confident that their actions are recorded. Not in an intimidating "Big Brother" way, but as professional accountability. "Your approval is recorded" builds trust.

### 6. Mobile-Ready Core Actions
Clock in/out, leave submission, task completion, and notification review must work on mobile. Complex operations (payroll entry, org settings) can be desktop-oriented.

### 7. Empty States Guide
First-time users and zero-data states never show blank pages. Every empty state includes: what would normally appear here, why it's empty, and what to do next.

### 8. Notification Actionability
Every notification should link to the relevant action. "Alex submitted leave" links directly to the approval screen. "Payslip available" links to the payslip view. Dead-end notifications that require manual navigation are a friction failure.
