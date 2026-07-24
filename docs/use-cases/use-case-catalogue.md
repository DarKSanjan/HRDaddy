# Use-Case Catalogue

This document catalogues all V1 use cases for HR Daddy across the Authentication, Organisation, and Employee modules. Each use case is specified with full detail including flows, business rules, permissions, notifications, audit events, and acceptance criteria.

---

## Authentication Module

---

### AUTH-001: Register Account

- **ID:** AUTH-001
- **Name:** Register Account
- **Goal:** A new user creates a platform account to access HR Daddy
- **Primary Actor:** Unregistered User
- **Supporting Actors:** Email Service
- **Preconditions:**
  - User does not have an existing account with the same email
  - Registration is not disabled at platform level
- **Trigger:** User navigates to the registration page and submits the registration form

**Main Success Flow:**

1. User navigates to the registration page
2. User enters full name, email address, and password
3. System validates email format and uniqueness
4. System validates password meets complexity requirements (BR-AUTH-007)
5. System creates User record with status "unverified"
6. System generates a verification token with 24-hour expiry
7. System sends verification email to the provided address
8. System displays confirmation message directing user to check email
9. System logs registration event to audit trail

**Alternative Flows:**

- **AF-1: User already has account** — At step 3, if email exists, system displays "An account with this email already exists" and offers sign-in link
- **AF-2: User registers via invitation** — Redirected to AUTH-006 flow instead; registration pre-fills email from invitation

**Failure Flows:**

- **FF-1: Invalid email format** — System displays inline validation error; form is not submitted
- **FF-2: Password too weak** — System displays password requirements; form is not submitted
- **FF-3: Email delivery failure** — User record is still created; system allows resending verification email
- **FF-4: Duplicate registration attempt** — Idempotent; system informs user that account exists

**Business Rules:** BR-AUTH-007
**Required Permissions:** None (public endpoint)
**Data Created/Modified:** User record (status: unverified), Verification token
**Notifications:** Verification email sent to user
**Audit Events:** `user.registered` — actor: system, target: new user ID
**Security Considerations:**
- Rate-limit registration endpoint (max 5 per IP per hour)
- Do not reveal whether an email is already registered in error messages visible to enumeration attacks (use generic message)
- Hash password with bcrypt before storage
- Verification token must be cryptographically random

**Acceptance Criteria:**
1. User can submit registration form with valid name, email, password
2. Verification email is sent within 30 seconds
3. Duplicate email returns appropriate error
4. Weak passwords are rejected with clear guidance
5. User record exists in database with unverified status after registration

**Priority:** P0
**Related Use Cases:** AUTH-002, AUTH-003, AUTH-006

---


### AUTH-002: Verify Email

- **ID:** AUTH-002
- **Name:** Verify Email
- **Goal:** User confirms ownership of their email address to activate their account
- **Primary Actor:** Unverified User
- **Supporting Actors:** None
- **Preconditions:**
  - User has registered an account (AUTH-001)
  - User has received a verification email with a valid token
  - Token has not expired (24-hour window)
- **Trigger:** User clicks the verification link in their email

**Main Success Flow:**

1. User clicks verification link containing the token
2. System validates the token exists and has not expired
3. System validates the token has not already been consumed
4. System marks User status as "verified"
5. System invalidates the verification token (single-use)
6. System redirects user to the sign-in page with success message
7. System logs email verification event

**Alternative Flows:**

- **AF-1: Token expired** — System displays "Verification link has expired" and offers a "Resend verification email" button
- **AF-2: User requests new verification email** — System generates a new token, invalidates old one, sends new email

**Failure Flows:**

- **FF-1: Invalid/malformed token** — System displays generic error "Invalid verification link"
- **FF-2: Token already used** — System displays "Email already verified" and offers sign-in link
- **FF-3: User account deleted** — Token lookup fails; display generic error

**Business Rules:** BR-AUTH-008 (single-use token)
**Required Permissions:** None (public endpoint with token-based auth)
**Data Created/Modified:** User.status updated to "verified", Token marked as consumed
**Notifications:** None
**Audit Events:** `user.email_verified` — actor: user, target: user ID
**Security Considerations:**
- Token must be cryptographically random (min 32 bytes, URL-safe encoding)
- Token is single-use; prevent replay attacks
- Do not reveal user existence if token is invalid
- Rate-limit resend verification (max 3 per hour per email)

**Acceptance Criteria:**
1. Valid token successfully verifies the account
2. User status changes from "unverified" to "verified"
3. Expired tokens show clear error with resend option
4. Used tokens cannot be reused
5. After verification, user can sign in

**Priority:** P0
**Related Use Cases:** AUTH-001, AUTH-003

---


### AUTH-003: Sign In

- **ID:** AUTH-003
- **Name:** Sign In
- **Goal:** Authenticated user gains access to their organisation context
- **Primary Actor:** Registered User
- **Supporting Actors:** None
- **Preconditions:**
  - User has a verified account
  - User is not currently locked out
- **Trigger:** User submits credentials on the sign-in page

**Main Success Flow:**

1. User navigates to the sign-in page
2. User enters email and password
3. System validates email format (client-side pre-check)
4. System looks up User by email
5. System verifies password hash matches stored hash
6. System checks account is not locked (BR-AUTH-004)
7. System checks account is verified
8. System resets failed login attempt counter
9. System creates a new session with secure cookie
10. System determines the user's default organisation context (most recently accessed or first membership)
11. System redirects user to the appropriate dashboard based on role

**Alternative Flows:**

- **AF-1: User belongs to multiple organisations** — After step 10, if user has multiple memberships, system uses last-accessed org or presents org selector
- **AF-2: User has no active memberships** — System displays "No active organisations" and suggests creating one or contacting administrator
- **AF-3: Remember me** — If selected, session expiry is extended to 30 days (vs default 24 hours)

**Failure Flows:**

- **FF-1: Invalid credentials** — System displays "Invalid email or password" (generic to prevent enumeration). Increments failed attempt counter.
- **FF-2: Account locked** — After 5 failed attempts (BR-AUTH-004), system displays "Account temporarily locked. Try again in 15 minutes."
- **FF-3: Account unverified** — System displays "Please verify your email first" with resend option
- **FF-4: All memberships deactivated** — System allows login but shows no org context; displays message to contact admin

**Business Rules:** BR-AUTH-004, BR-AUTH-005, BR-AUTH-001
**Required Permissions:** None (public endpoint)
**Data Created/Modified:** Session record, User.lastLoginAt, failed_attempts counter (reset on success)
**Notifications:** None (optional: "New sign-in from [device/location]" for security-conscious orgs — V2)
**Audit Events:** `user.signed_in` — actor: user, target: user ID, metadata: IP, user-agent
**Security Considerations:**
- Constant-time password comparison to prevent timing attacks
- Generic error messages prevent user enumeration
- Session token stored in HttpOnly, Secure, SameSite=Lax cookie
- Rate-limit login endpoint (max 10 per minute per IP)
- Log failed attempts for security monitoring

**Acceptance Criteria:**
1. Valid credentials grant access and redirect to dashboard
2. Invalid credentials show generic error
3. Account locks after 5 consecutive failures
4. Locked account unlocks after 15 minutes
5. Session persists across page refreshes
6. Unverified accounts cannot sign in

**Priority:** P0
**Related Use Cases:** AUTH-001, AUTH-002, AUTH-004, AUTH-007, AUTH-009

---


### AUTH-004: Sign Out

- **ID:** AUTH-004
- **Name:** Sign Out
- **Goal:** User terminates their active session securely
- **Primary Actor:** Authenticated User
- **Supporting Actors:** None
- **Preconditions:**
  - User has an active session
- **Trigger:** User clicks "Sign Out" from any page

**Main Success Flow:**

1. User clicks the "Sign Out" button in the profile/navigation menu
2. System invalidates the current session token server-side
3. System clears the session cookie from the browser
4. System redirects user to the sign-in page
5. System displays "You have been signed out" confirmation message

**Alternative Flows:**

- **AF-1: Sign out from all devices** — User selects "Sign out everywhere"; system invalidates all sessions for this user across all devices

**Failure Flows:**

- **FF-1: Session already expired** — System clears cookie and redirects to sign-in (no error shown)
- **FF-2: Network error during sign-out** — Client clears local session state; server session may remain until TTL expires

**Business Rules:** None specific
**Required Permissions:** Authenticated session required
**Data Created/Modified:** Session record invalidated
**Notifications:** None
**Audit Events:** `user.signed_out` — actor: user, target: user ID
**Security Considerations:**
- Server-side session invalidation is mandatory (not just cookie deletion)
- Clear all session-related cookies and local storage
- CSRF protection on sign-out endpoint (POST request, not GET)

**Acceptance Criteria:**
1. After sign-out, accessing protected pages redirects to sign-in
2. Session cookie is removed from browser
3. Previously valid session token returns 401 after sign-out
4. User sees confirmation message on sign-in page

**Priority:** P0
**Related Use Cases:** AUTH-003, AUTH-011

---

### AUTH-005: Reset Password

- **ID:** AUTH-005
- **Name:** Reset Password
- **Goal:** User who has forgotten their password can securely set a new one
- **Primary Actor:** Registered User (may not be signed in)
- **Supporting Actors:** Email Service
- **Preconditions:**
  - User has a registered account (verified or unverified)
- **Trigger:** User clicks "Forgot Password" on the sign-in page

**Main Success Flow:**

1. User clicks "Forgot Password" link on sign-in page
2. System displays password reset form requesting email address
3. User enters their email and submits
4. System validates email format
5. System generates a password reset token (1-hour expiry)
6. System sends password reset email with secure link
7. System displays "If an account exists, a reset email has been sent" (prevents enumeration)
8. User clicks the reset link in their email
9. System validates token exists, is not expired, and is not consumed
10. System displays new password form
11. User enters and confirms new password
12. System validates password complexity (BR-AUTH-007)
13. System updates password hash
14. System invalidates all existing sessions for this user (BR-AUTH-002)
15. System invalidates the reset token
16. System redirects to sign-in with success message

**Alternative Flows:**

- **AF-1: Email not found** — System still displays generic success message (step 7) but sends no email
- **AF-2: User requests multiple resets** — Each new request invalidates previous tokens; only latest token works

**Failure Flows:**

- **FF-1: Expired token** — System displays "Reset link has expired" with option to request new one
- **FF-2: Already-used token** — System displays "This link has already been used"
- **FF-3: New password same as old** — System rejects and asks for a different password
- **FF-4: Password too weak** — System displays requirements and rejects

**Business Rules:** BR-AUTH-002, BR-AUTH-007
**Required Permissions:** None (public endpoint with token-based auth)
**Data Created/Modified:** User.passwordHash updated, all sessions invalidated, reset token consumed
**Notifications:** Password reset email sent; optional confirmation email after successful reset
**Audit Events:** `user.password_reset_requested` (on request), `user.password_reset_completed` (on success)
**Security Considerations:**
- Generic response prevents email enumeration
- Token expires after 1 hour
- Token is single-use
- All sessions invalidated on password change
- Rate-limit reset requests (max 3 per hour per email, max 10 per hour per IP)
- Do not include email or user details in the reset URL (only token)

**Acceptance Criteria:**
1. User can request a password reset for any email without revealing account existence
2. Valid token allows setting a new password
3. Expired tokens are rejected with clear message
4. All active sessions are terminated after password reset
5. New password must meet complexity requirements
6. User can sign in with new password immediately after reset

**Priority:** P0
**Related Use Cases:** AUTH-003, AUTH-011

---


### AUTH-006: Accept Invitation

- **ID:** AUTH-006
- **Name:** Accept Invitation
- **Goal:** A person invited to an organisation completes account setup and gains access
- **Primary Actor:** Invited Person
- **Supporting Actors:** Inviting User (Owner/HR Admin), Email Service
- **Preconditions:**
  - An invitation has been created by an authorised user (ORG-010 or EMP-002)
  - Invitation has not expired (7-day window per BR-AUTH-003)
  - Invitation has not been revoked
- **Trigger:** Invited person clicks the invitation link in their email

**Main Success Flow:**

1. Invited person clicks invitation link containing the invitation token
2. System validates token exists, is not expired, and is not consumed
3. System extracts invitation metadata (target email, target role, target organisation)
4. System checks if user already has an account with this email
5. **New user path:** System displays registration form pre-filled with email (locked)
6. User enters full name and creates a password
7. System creates User record (status: verified — email ownership implied by invitation receipt)
8. System creates Membership record linking User to Organisation with the specified role
9. System creates session and redirects to organisation dashboard
10. System marks invitation as accepted

**Alternative Flows:**

- **AF-1: Existing user** — At step 4, if user already has account, system creates Membership only (no registration needed). If user is signed in, membership is added immediately. If not signed in, user is prompted to sign in first.
- **AF-2: User already a member** — If the user is already a member of the target organisation, system displays "You are already a member of this organisation" and redirects to dashboard

**Failure Flows:**

- **FF-1: Token expired** — System displays "This invitation has expired" with message to contact their administrator
- **FF-2: Token already used** — System displays "This invitation has already been accepted" (BR-AUTH-008)
- **FF-3: Token revoked** — System displays "This invitation is no longer valid"
- **FF-4: Password too weak** — Validation error; user must choose a stronger password
- **FF-5: Organisation deleted/archived** — System displays "This organisation is no longer active"

**Business Rules:** BR-AUTH-003, BR-AUTH-008, BR-AUTH-007
**Required Permissions:** None (public endpoint with token-based auth)
**Data Created/Modified:** User record (if new), Membership record, Invitation.status → accepted
**Notifications:** In-app notification to inviter: "X has accepted your invitation"
**Audit Events:** `invitation.accepted` — actor: new user, target: organisation, metadata: role granted
**Security Considerations:**
- Invitation token is single-use (prevents link sharing)
- Token must be cryptographically secure (min 32 bytes)
- Email pre-filled and locked prevents token misuse for different email
- Rate-limit invitation acceptance attempts

**Acceptance Criteria:**
1. New user can complete registration and gain immediate access
2. Existing user gains membership without re-registering
3. Expired invitations are clearly rejected
4. Used invitations cannot be reused
5. Correct role is assigned as specified in invitation
6. Inviter receives notification of acceptance

**Priority:** P0
**Related Use Cases:** AUTH-001, AUTH-008, ORG-010, EMP-002

---

### AUTH-007: Switch Organisation

- **ID:** AUTH-007
- **Name:** Switch Organisation
- **Goal:** A user with multiple organisation memberships changes their active organisation context
- **Primary Actor:** Multi-org User
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated
  - User has active memberships in more than one organisation
- **Trigger:** User selects a different organisation from the organisation switcher dropdown

**Main Success Flow:**

1. User opens the organisation switcher in the navigation
2. System displays list of organisations where user has active memberships
3. User selects a different organisation
4. System validates the membership is still active
5. System updates the session's active organisation context (BR-AUTH-006)
6. System invalidates any cached data from the previous organisation context
7. System redirects to the dashboard appropriate for the user's role in the new organisation
8. System updates the "last accessed" timestamp for this membership

**Alternative Flows:**

- **AF-1: Only one organisation** — Organisation switcher is not displayed
- **AF-2: Membership revoked since page load** — At step 4, validation fails; system removes the org from the list and displays error

**Failure Flows:**

- **FF-1: Target organisation deactivated** — System displays error and removes org from available list
- **FF-2: Membership deactivated between list load and selection** — System displays "You no longer have access to this organisation"

**Business Rules:** BR-AUTH-006, BR-PERM-002
**Required Permissions:** Active membership in target organisation
**Data Created/Modified:** Session.activeOrganisationId updated, Membership.lastAccessedAt updated
**Notifications:** None
**Audit Events:** `user.org_context_switched` — actor: user, target: new organisation ID
**Security Considerations:**
- Previous organisation context is fully invalidated (no data leakage)
- Role is re-resolved from the target organisation's membership
- All permission checks use the new organisation context immediately
- Client-side cache must be cleared on switch

**Acceptance Criteria:**
1. User can switch between organisations seamlessly
2. Dashboard reflects the correct organisation's data after switch
3. Role and permissions reflect the user's role in the new organisation
4. Previous organisation data is not visible after switch
5. Invalid memberships are handled gracefully

**Priority:** P1
**Related Use Cases:** AUTH-003, ORG-001

---


### AUTH-008: Handle Expired Invitation

- **ID:** AUTH-008
- **Name:** Handle Expired Invitation
- **Goal:** System gracefully handles attempts to use an expired invitation
- **Primary Actor:** Invited Person
- **Supporting Actors:** Inviting User (Owner/HR Admin)
- **Preconditions:**
  - An invitation was created but the 7-day window has passed
- **Trigger:** Person clicks an expired invitation link

**Main Success Flow:**

1. Person clicks the invitation link
2. System looks up the invitation token
3. System detects the invitation has expired (created_at + 7 days < now)
4. System displays a clear message: "This invitation has expired"
5. System provides guidance: "Please contact your organisation administrator to receive a new invitation"
6. System provides a link to the sign-in page (in case they already have access)

**Alternative Flows:**

- **AF-1: Inviter resends invitation** — A new invitation is created with a fresh 7-day window (handled by ORG-010)

**Failure Flows:**

- **FF-1: Token does not exist** — System displays generic "Invalid invitation link" (no distinction from expired for security)

**Business Rules:** BR-AUTH-003
**Required Permissions:** None (public endpoint)
**Data Created/Modified:** None
**Notifications:** Optional: system could notify the inviter that their invitation expired (V2)
**Audit Events:** `invitation.expired_attempt` — target: invitation ID, metadata: attempting IP
**Security Considerations:**
- Do not differentiate between "expired" and "non-existent" tokens in production (prevent enumeration)
- Do not reveal organisation details for expired tokens
- Log attempts for security monitoring

**Acceptance Criteria:**
1. Expired invitation link shows clear user-friendly message
2. User is guided toward getting a new invitation
3. No access is granted
4. Sign-in link is provided for users who may already have accounts

**Priority:** P1
**Related Use Cases:** AUTH-006, ORG-010

---

### AUTH-009: Handle Disabled Account

- **ID:** AUTH-009
- **Name:** Handle Disabled Account
- **Goal:** System prevents access for users whose accounts have been administratively disabled
- **Primary Actor:** Disabled User
- **Supporting Actors:** System Administrator (future), Owner
- **Preconditions:**
  - User account has been disabled at the platform level (distinct from org-level deactivation)
- **Trigger:** Disabled user attempts to sign in

**Main Success Flow:**

1. User enters credentials on sign-in page
2. System validates credentials (password is correct)
3. System checks account status — finds account is disabled
4. System does NOT create a session
5. System displays: "Your account has been suspended. Please contact support."
6. System logs the attempt

**Alternative Flows:**

- **AF-1: Account disabled while session active** — On next request, middleware detects disabled account, invalidates session, redirects to sign-in with message

**Failure Flows:**

- **FF-1: Wrong password + disabled** — System still shows generic "Invalid email or password" (does not reveal disabled status to incorrect credentials)

**Business Rules:** BR-AUTH-005
**Required Permissions:** None (this is an access denial flow)
**Data Created/Modified:** None (no session created)
**Notifications:** None to user; admin may receive notification of repeated attempts (V2)
**Audit Events:** `user.disabled_login_attempt` — target: user ID, metadata: IP, timestamp
**Security Considerations:**
- Only reveal "suspended" status after successful credential validation
- If credentials are wrong, show generic error (prevents enumeration of disabled accounts)
- All sessions are invalidated when an account is disabled
- Do not distinguish between "disabled" and "deleted" to external parties

**Acceptance Criteria:**
1. Disabled user with correct credentials sees suspension message
2. Disabled user with wrong credentials sees generic login error
3. No session is created for disabled accounts
4. Active sessions are terminated when account is disabled
5. The message directs user to appropriate support channel

**Priority:** P1
**Related Use Cases:** AUTH-003, AUTH-010, EMP-013

---

### AUTH-010: Handle Deactivated Employee

- **ID:** AUTH-010
- **Name:** Handle Deactivated Employee
- **Goal:** System prevents organisation access when an employee record is deactivated, while allowing the User to access other organisations
- **Primary Actor:** User with deactivated Employee record
- **Supporting Actors:** HR Administrator
- **Preconditions:**
  - User has a valid account and verified email
  - User's Employee record in one or more organisations has been deactivated
  - User may still have active memberships in other organisations
- **Trigger:** User attempts to access an organisation where their employee record is deactivated

**Main Success Flow:**

1. User signs in with valid credentials
2. System authenticates successfully (User account is not disabled)
3. System resolves available organisation contexts
4. System filters out organisations where Employee status is Deactivated
5. If user has other active memberships, system redirects to an active organisation
6. If user has NO active memberships, system displays "You do not currently have access to any organisations"
7. System provides guidance to contact administrator

**Alternative Flows:**

- **AF-1: User switches to deactivated org** — System prevents switch and displays "Your access to this organisation has been revoked"
- **AF-2: Session active when deactivation occurs** — On next API request, middleware detects deactivation, returns 403, client redirects to org selector or sign-in

**Failure Flows:**

- **FF-1: All organisations deactivated** — User can sign in but has no usable context; system shows "no access" state

**Business Rules:** BR-AUTH-005, BR-AUTH-001
**Required Permissions:** None (this is an access enforcement flow)
**Data Created/Modified:** None
**Notifications:** Notification to user when deactivation occurs: "Your access to [Org Name] has been revoked"
**Audit Events:** Covered by EMP-013 deactivation audit event
**Security Considerations:**
- Deactivation takes effect immediately on next request (no delay)
- User can still access other organisations where they are active
- Do not delete User account — only revoke membership/access
- Cached permissions must be invalidated immediately

**Acceptance Criteria:**
1. Deactivated employee cannot access the organisation's data
2. User can still access other organisations where they are active
3. Real-time enforcement — no stale session access
4. Clear messaging about what happened
5. User account remains intact for other organisations

**Priority:** P0
**Related Use Cases:** AUTH-003, AUTH-009, EMP-013, EMP-014

---


### AUTH-011: Handle Expired Session

- **ID:** AUTH-011
- **Name:** Handle Expired Session
- **Goal:** System gracefully handles requests from users whose session has expired
- **Primary Actor:** User with expired session
- **Supporting Actors:** None
- **Preconditions:**
  - User previously had an active session
  - Session has expired due to inactivity timeout or absolute expiry
- **Trigger:** User makes a request (page navigation or API call) with an expired session

**Main Success Flow:**

1. User performs an action (clicks link, submits form, navigates)
2. System checks session validity — finds session expired
3. System clears the invalid session cookie
4. System redirects user to sign-in page
5. System displays: "Your session has expired. Please sign in again."
6. System preserves the intended destination URL as a redirect parameter
7. After successful re-authentication, system redirects to the originally intended page

**Alternative Flows:**

- **AF-1: AJAX/API request with expired session** — System returns 401 with JSON body `{"code": "SESSION_EXPIRED"}`; client handles redirect
- **AF-2: Form submission with expired session** — System redirects to sign-in; form data is lost (acceptable; warn users to save work periodically)
- **AF-3: Remember me session** — Extended sessions (30-day) still expire eventually; same flow applies

**Failure Flows:**

- **FF-1: Redirect URL is external** — System ignores the redirect parameter (open redirect prevention) and sends to dashboard
- **FF-2: Original page no longer accessible** — After re-auth, if permission has changed, show appropriate error

**Business Rules:** None specific (standard session management)
**Required Permissions:** None (this is an authentication enforcement flow)
**Data Created/Modified:** Session record removed/expired
**Notifications:** None
**Audit Events:** `session.expired` — target: session ID, user ID (informational, low priority)
**Security Considerations:**
- Session expiry: 24 hours (default) or 30 days (remember me)
- Absolute expiry regardless of activity (prevent infinite sessions)
- Redirect URL must be validated as internal (prevent open redirect attacks)
- Clear all session-related state on expiry
- Sliding window not used for security (absolute timeout only)

**Acceptance Criteria:**
1. Expired session redirects to sign-in with clear message
2. Originally requested URL is preserved for post-login redirect
3. API calls return proper 401 status for client handling
4. No stale data is accessible with expired session
5. Redirect parameter cannot be exploited for open redirect
6. User can seamlessly continue work after re-authentication

**Priority:** P0
**Related Use Cases:** AUTH-003, AUTH-004, AUTH-005

---

## Organisation Module

---

### ORG-001: Create Organisation

- **ID:** ORG-001
- **Name:** Create Organisation
- **Goal:** A user creates a new organisation on the platform and becomes its Owner
- **Primary Actor:** Authenticated User
- **Supporting Actors:** None
- **Preconditions:**
  - User has a verified account
  - User is authenticated
- **Trigger:** User clicks "Create Organisation" from the organisation selector or onboarding flow

**Main Success Flow:**

1. User selects "Create New Organisation" option
2. System displays organisation creation form
3. User enters organisation name (required) and optional details (industry, size range)
4. System validates organisation name (min 2 chars, max 100 chars)
5. System creates Organisation record with default settings
6. System creates Membership record linking User as Owner role
7. System seeds default configuration: timezone (UTC), currency (USD), working days (Mon-Fri), working hours (9:00-17:00), date format (DD/MM/YYYY), leave year (January)
8. System creates default leave types (Annual Leave, Sick Leave, Unpaid Leave)
9. System sets active organisation context to the new organisation
10. System redirects to organisation setup wizard (or dashboard)

**Alternative Flows:**

- **AF-1: User's first organisation** — System presents the setup as an onboarding wizard with guided steps
- **AF-2: User already owns organisations** — No limit on organisations per user; new org is added to switcher

**Failure Flows:**

- **FF-1: Validation error** — Name too short/long; display inline error
- **FF-2: Database error** — Transaction rollback; display "Something went wrong, please try again"
- **FF-3: User session expired** — Redirect to sign-in (AUTH-011)

**Business Rules:** BR-ORG-001, BR-ORG-003
**Required Permissions:** Authenticated user (any verified user can create an organisation)
**Data Created/Modified:** Organisation record, Membership (Owner), OrganisationSettings (defaults), default LeaveTypes
**Notifications:** None
**Audit Events:** `organisation.created` — actor: user, target: new organisation ID
**Security Considerations:**
- Rate-limit org creation (max 5 per user per day)
- Org ID generated server-side (UUID), never from client
- Default settings are secure (no open permissions by default)
- Transaction must be atomic (org + membership + settings all or nothing)

**Acceptance Criteria:**
1. Organisation is created with valid name
2. Creating user becomes Owner automatically
3. Default settings are applied correctly
4. User is redirected to the new organisation context
5. Organisation appears in the organisation switcher
6. Default leave types are seeded

**Priority:** P0
**Related Use Cases:** AUTH-007, ORG-002, ORG-003, ORG-004, ORG-005

---


### ORG-002: Update Organisation Details

- **ID:** ORG-002
- **Name:** Update Organisation Details
- **Goal:** Owner updates the organisation's basic information (name, industry, size, contact details)
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner of the organisation
  - Organisation exists and is active
- **Trigger:** Owner navigates to Organisation Settings > General and edits details

**Main Success Flow:**

1. Owner navigates to Settings > Organisation Details
2. System displays current organisation details in an editable form
3. Owner modifies desired fields (name, industry, address, phone, website)
4. Owner clicks "Save Changes"
5. System validates all fields (name required, URL format for website, etc.)
6. System updates Organisation record
7. System displays success confirmation
8. System logs the change with before/after values

**Alternative Flows:**

- **AF-1: No changes made** — Save button remains disabled until a field is modified
- **AF-2: Partial update** — Only changed fields are persisted; unchanged fields remain

**Failure Flows:**

- **FF-1: Name empty** — Validation error: "Organisation name is required"
- **FF-2: Concurrent edit** — Optimistic lock detects conflict; display "Settings were updated by another user. Please refresh and try again."
- **FF-3: Permission denied** — Non-owner attempting edit; 403 returned

**Business Rules:** BR-ORG-005
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** Organisation record updated
**Notifications:** None
**Audit Events:** `organisation.details_updated` — actor: Owner, changes: {field: {before, after}}
**Security Considerations:**
- Only Owner can modify (server-side enforcement)
- Validate all input server-side (XSS prevention)
- Optimistic locking prevents lost updates
- Audit trail captures all changes

**Acceptance Criteria:**
1. Owner can update all organisation fields
2. Changes are persisted and visible immediately
3. Non-owners cannot access the edit form or submit changes
4. Audit log captures the change with before/after values
5. Concurrent edits are handled gracefully

**Priority:** P1
**Related Use Cases:** ORG-001, ORG-003, ORG-009

---

### ORG-003: Configure Timezone

- **ID:** ORG-003
- **Name:** Configure Timezone
- **Goal:** Owner sets the organisation's primary timezone for attendance and scheduling
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Organisation exists
- **Trigger:** Owner navigates to Settings > Date & Time and selects a timezone

**Main Success Flow:**

1. Owner navigates to Settings > Date & Time
2. System displays current timezone configuration
3. Owner selects a new timezone from a searchable dropdown (IANA timezone database)
4. System displays preview: "Attendance and scheduling will use [timezone]. All historical records remain in UTC."
5. Owner confirms the change
6. System updates OrganisationSettings.timezone
7. System displays success message
8. All subsequent attendance displays and calculations use the new timezone

**Alternative Flows:**

- **AF-1: Owner searches for timezone** — Dropdown supports search by city name, region, or UTC offset

**Failure Flows:**

- **FF-1: Invalid timezone value** — Server rejects; display error
- **FF-2: Permission denied** — Non-owner gets 403

**Business Rules:** BR-ORG-005, BR-ATT-002
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** OrganisationSettings.timezone updated
**Notifications:** None (consider notifying all members of timezone change — V2)
**Audit Events:** `organisation.timezone_changed` — before: old timezone, after: new timezone
**Security Considerations:**
- Timezone is used for display only; all storage remains UTC
- Validate against IANA timezone database (prevent injection)
- Only Owner can change

**Acceptance Criteria:**
1. Owner can select any valid IANA timezone
2. Change takes effect immediately for all displays
3. Historical records are displayed correctly in new timezone
4. Attendance calculations use new timezone going forward
5. Audit log records the timezone change

**Priority:** P1
**Related Use Cases:** ORG-001, ORG-005, ORG-006

---

### ORG-004: Configure Currency

- **ID:** ORG-004
- **Name:** Configure Currency
- **Goal:** Owner sets the organisation's default currency for payroll and compensation display
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Organisation exists
- **Trigger:** Owner navigates to Settings > Regional and selects a currency

**Main Success Flow:**

1. Owner navigates to Settings > Regional
2. System displays current currency setting
3. Owner selects a new currency from a dropdown (ISO 4217 currency codes)
4. System displays preview: "Payroll and compensation will display in [currency symbol]"
5. Owner confirms the change
6. System updates OrganisationSettings.currency
7. System displays success message

**Alternative Flows:**

- **AF-1: Currency with different decimal places** — System adapts display formatting (e.g., JPY has 0 decimals, USD has 2)

**Failure Flows:**

- **FF-1: Invalid currency code** — Server rejects
- **FF-2: Currency change with existing payroll** — System warns "Existing payroll records will not be converted. This affects display only."

**Business Rules:** BR-ORG-005, BR-PAY-001
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** OrganisationSettings.currency updated
**Notifications:** None
**Audit Events:** `organisation.currency_changed` — before: old currency, after: new currency
**Security Considerations:**
- Validate against ISO 4217 list
- No automatic currency conversion of existing data
- Only affects display formatting, not stored values

**Acceptance Criteria:**
1. Owner can select any valid ISO 4217 currency
2. All monetary displays update to new currency symbol
3. Existing payroll values are not altered
4. Warning displayed if payroll records exist
5. Audit log records the change

**Priority:** P1
**Related Use Cases:** ORG-001, ORG-002

---


### ORG-005: Configure Working Days

- **ID:** ORG-005
- **Name:** Configure Working Days
- **Goal:** Owner defines which days of the week are working days for the organisation
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Organisation exists
- **Trigger:** Owner navigates to Settings > Working Schedule

**Main Success Flow:**

1. Owner navigates to Settings > Working Schedule
2. System displays the 7 days of the week with current working day selections
3. Owner toggles days on/off (e.g., Mon-Fri selected, Sat-Sun unselected)
4. System validates at least 1 working day is selected
5. Owner clicks "Save"
6. System updates OrganisationSettings.workingDays
7. System displays success message
8. Leave calculations and attendance expectations update to reflect new working days

**Alternative Flows:**

- **AF-1: Non-standard work week** — Organisation uses Sun-Thu (Middle East pattern); system supports any combination
- **AF-2: Change with pending leave** — System warns "Pending leave requests may need recalculation"

**Failure Flows:**

- **FF-1: No days selected** — Validation error: "At least one working day must be selected"
- **FF-2: Permission denied** — Non-owner gets 403

**Business Rules:** BR-ORG-005, BR-LEAVE-005, BR-CROSS-005
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** OrganisationSettings.workingDays updated
**Notifications:** None
**Audit Events:** `organisation.working_days_changed` — before: [Mon,Tue,Wed,Thu,Fri], after: [Sun,Mon,Tue,Wed,Thu]
**Security Considerations:**
- Validate input is an array of valid day identifiers
- Changes affect leave balance calculations going forward
- Consider warning about impact on existing leave requests

**Acceptance Criteria:**
1. Owner can select any combination of days (minimum 1)
2. Leave day calculations respect the new working days
3. Attendance expectations align with configured days
4. Audit log captures the change
5. Non-standard work weeks are fully supported

**Priority:** P1
**Related Use Cases:** ORG-003, ORG-006

---

### ORG-006: Configure Working Hours

- **ID:** ORG-006
- **Name:** Configure Working Hours
- **Goal:** Owner defines the standard working hours for the organisation
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Organisation exists
- **Trigger:** Owner navigates to Settings > Working Schedule and edits hours

**Main Success Flow:**

1. Owner navigates to Settings > Working Schedule
2. System displays current working hours (start time and end time)
3. Owner modifies start time and/or end time using time pickers
4. System validates end time is after start time
5. System calculates and displays expected daily hours (e.g., "8 hours")
6. Owner clicks "Save"
7. System updates OrganisationSettings.workingHoursStart and workingHoursEnd
8. System displays success message

**Alternative Flows:**

- **AF-1: Overnight shifts** — If end time < start time, system interprets as overnight (e.g., 22:00-06:00 = 8 hours crossing midnight)
- **AF-2: Half-hour increments** — Time picker snaps to 30-minute intervals

**Failure Flows:**

- **FF-1: Start equals end** — Validation error: "Start and end times cannot be the same"
- **FF-2: Invalid time format** — Server-side validation rejects

**Business Rules:** BR-ORG-005, BR-ATT-005
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** OrganisationSettings.workingHoursStart, workingHoursEnd updated
**Notifications:** None
**Audit Events:** `organisation.working_hours_changed` — before/after hours
**Security Considerations:**
- Validate time format server-side
- Working hours affect "missing clock-out" detection threshold
- Only Owner can modify

**Acceptance Criteria:**
1. Owner can set any valid start and end time
2. Overnight shift patterns are supported
3. Expected daily hours are calculated and displayed
4. Missing clock-out detection uses configured end time + buffer
5. Audit log records the change

**Priority:** P1
**Related Use Cases:** ORG-005, ORG-003

---

### ORG-007: Configure Date Format

- **ID:** ORG-007
- **Name:** Configure Date Format
- **Goal:** Owner sets the organisation's preferred date display format
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Organisation exists
- **Trigger:** Owner navigates to Settings > Regional and selects date format

**Main Success Flow:**

1. Owner navigates to Settings > Regional
2. System displays current date format with a live preview
3. Owner selects from supported formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
4. System shows a preview with today's date in the selected format
5. Owner clicks "Save"
6. System updates OrganisationSettings.dateFormat
7. System displays success message
8. All date displays across the application use the new format

**Alternative Flows:**

- **AF-1: Custom format** — V1 supports only the three standard formats; custom formats are V2

**Failure Flows:**

- **FF-1: Invalid format string** — Server rejects value not in allowed list
- **FF-2: Permission denied** — Non-owner gets 403

**Business Rules:** BR-ORG-005
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** OrganisationSettings.dateFormat updated
**Notifications:** None
**Audit Events:** `organisation.date_format_changed` — before/after format
**Security Considerations:**
- Validate against allowed format list (prevent format string injection)
- Date storage always uses ISO 8601; format is display-only

**Acceptance Criteria:**
1. Owner can select from supported date formats
2. Live preview shows the format correctly
3. All dates across the application reflect the new format
4. Stored dates remain in ISO 8601
5. Audit log records the change

**Priority:** P2
**Related Use Cases:** ORG-003, ORG-004

---


### ORG-008: Configure Leave Year

- **ID:** ORG-008
- **Name:** Configure Leave Year
- **Goal:** Owner sets when the organisation's leave year starts (for balance resets and accruals)
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Organisation exists
- **Trigger:** Owner navigates to Settings > Leave and configures leave year start

**Main Success Flow:**

1. Owner navigates to Settings > Leave Configuration
2. System displays current leave year start month (default: January)
3. Owner selects a different start month from dropdown (January through December)
4. System displays explanation: "Leave balances will reset on the 1st of [selected month] each year"
5. System shows warning if current leave year is mid-cycle: "Changing the leave year may require manual balance adjustments for the current period"
6. Owner confirms the change
7. System updates OrganisationSettings.leaveYearStartMonth
8. System displays success message

**Alternative Flows:**

- **AF-1: First-time setup** — No warning about mid-cycle change; clean start
- **AF-2: Change during active leave year** — System does not automatically recalculate existing balances; HR must manually adjust if needed

**Failure Flows:**

- **FF-1: Invalid month value** — Server rejects
- **FF-2: Permission denied** — Non-owner gets 403

**Business Rules:** BR-ORG-005, BR-LEAVE-003
**Required Permissions:** org.settings.write (Owner only)
**Data Created/Modified:** OrganisationSettings.leaveYearStartMonth updated
**Notifications:** None (HR Admin should be informed manually)
**Audit Events:** `organisation.leave_year_changed` — before: January, after: April
**Security Considerations:**
- Validate month is 1-12
- Does not retroactively modify existing leave balances or approvals
- Important change that should be communicated to HR team

**Acceptance Criteria:**
1. Owner can set leave year to start in any month
2. Warning is shown for mid-cycle changes
3. Existing balances are not automatically modified
4. Future balance resets align with new leave year
5. Audit log records the change

**Priority:** P1
**Related Use Cases:** ORG-001, ORG-005

---

### ORG-009: Configure Company Branding

- **ID:** ORG-009
- **Name:** Configure Company Branding
- **Goal:** Owner or HR Admin customises the application appearance with company logo and colours
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
  - Organisation exists
- **Trigger:** User navigates to Settings > Branding

**Main Success Flow:**

1. User navigates to Settings > Branding
2. System displays current branding: logo, primary colour, organisation display name
3. User uploads a new logo image
4. System validates file: type (PNG, JPG, SVG), size (max 2MB), dimensions (min 64x64, max 1024x1024)
5. User selects primary brand colour using a colour picker
6. User optionally updates the display name (shown in navigation header)
7. User clicks "Save"
8. System stores logo in tenant-scoped storage path
9. System updates branding settings
10. System displays live preview and success message

**Alternative Flows:**

- **AF-1: Remove logo** — User clicks "Remove" to revert to default (organisation initials)
- **AF-2: Reset to defaults** — System provides a "Reset branding" option

**Failure Flows:**

- **FF-1: Invalid file type** — "Please upload a PNG, JPG, or SVG image"
- **FF-2: File too large** — "Logo must be under 2MB"
- **FF-3: Upload storage failure** — "Failed to upload logo. Please try again."
- **FF-4: Permission denied** — 403 for non-Owner/HR Admin

**Business Rules:** BR-ORG-005, BR-DOC-001 (file validation principles)
**Required Permissions:** org.branding.write (Owner, HR Administrator)
**Data Created/Modified:** OrganisationSettings.logoUrl, primaryColour, displayName updated; logo file stored
**Notifications:** None
**Audit Events:** `organisation.branding_updated` — actor, changes
**Security Considerations:**
- Validate image file magic bytes (not just extension)
- Store in tenant-scoped path to prevent cross-tenant access
- Sanitize SVG content (prevent XSS via SVG)
- Serve images with appropriate content-type headers
- Strip EXIF data from uploaded images

**Acceptance Criteria:**
1. Logo appears in navigation header after upload
2. Brand colour is applied to UI accent elements
3. Invalid files are rejected with clear messages
4. Previous logo is replaced (not accumulated)
5. Branding is visible to all organisation members
6. SVG uploads are sanitized

**Priority:** P2
**Related Use Cases:** ORG-002

---

### ORG-010: Invite Organisation Member

- **ID:** ORG-010
- **Name:** Invite Organisation Member
- **Goal:** Owner or HR Admin invites a new user to join the organisation with a specified role
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** Email Service, Invited Person
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
  - Organisation exists and is active
- **Trigger:** User navigates to Settings > Members and clicks "Invite Member"

**Main Success Flow:**

1. User clicks "Invite Member" button
2. System displays invitation form: email, role selection
3. User enters the invitee's email address
4. User selects the role to assign (Employee, Manager, HR Administrator)
5. System validates email format
6. System checks if email already has an active membership in this organisation
7. System creates Invitation record (token, email, role, org_id, expiry: 7 days)
8. System sends invitation email with unique link
9. System displays success: "Invitation sent to [email]"
10. Invitation appears in pending invitations list

**Alternative Flows:**

- **AF-1: HR Admin inviting HR Admin** — Permission denied; only Owner can invite HR Admin role
- **AF-2: Resend expired invitation** — User can "Resend" which creates a new invitation (old one auto-invalidated)
- **AF-3: Revoke pending invitation** — User can cancel a pending invitation before acceptance
- **AF-4: Invitee already has User account** — Invitation still sent; on acceptance, only Membership is created (no registration)

**Failure Flows:**

- **FF-1: Email already a member** — "This email is already a member of your organisation"
- **FF-2: Invalid email** — Validation error
- **FF-3: Email delivery failure** — Invitation record created; system allows resend
- **FF-4: HR Admin attempting to invite HR Admin** — 403: "Only the Owner can invite HR Administrators"
- **FF-5: Rate limit** — Max 20 invitations per hour per organisation

**Business Rules:** BR-AUTH-003, BR-AUTH-008
**Required Permissions:** org.members.invite (Owner: all roles; HR Admin: Employee and Manager only)
**Data Created/Modified:** Invitation record created
**Notifications:** Invitation email to invitee; in-app notification to inviter on acceptance
**Audit Events:** `member.invited` — actor: inviter, target: invitee email, metadata: role
**Security Considerations:**
- Invitation token is cryptographically random (32+ bytes)
- Token expires after 7 days
- Token is single-use
- HR Admin cannot escalate by inviting higher roles
- Rate-limit to prevent invitation spam
- Do not include sensitive org details in invitation email body

**Acceptance Criteria:**
1. Owner can invite any role; HR Admin can invite Employee and Manager only
2. Invitation email is sent with valid link
3. Pending invitations are listed in members section
4. Duplicate member invitations are rejected
5. Expired invitations can be resent
6. Invitation can be revoked before acceptance

**Priority:** P0
**Related Use Cases:** AUTH-006, AUTH-008, ORG-011, ORG-012, EMP-002

---


### ORG-011: Change Member Role

- **ID:** ORG-011
- **Name:** Change Member Role
- **Goal:** Owner changes an existing member's role within the organisation
- **Primary Actor:** Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner
  - Target member exists and has active membership
  - Target member is not the Owner (cannot change own role)
- **Trigger:** Owner navigates to Settings > Members, selects a member, and changes their role

**Main Success Flow:**

1. Owner navigates to Settings > Members
2. System displays list of current members with their roles
3. Owner selects a member and clicks "Change Role"
4. System displays role selection dropdown (Employee, Manager, HR Administrator)
5. Owner selects the new role
6. System validates the change is not self-referential (cannot change own role)
7. System updates Membership.role
8. System displays success: "[Name]'s role changed to [new role]"
9. Member's permissions are effective immediately on their next request
10. System logs the role change

**Alternative Flows:**

- **AF-1: Demoting HR Admin to Employee** — System warns about permission loss; requires confirmation
- **AF-2: Promoting to Manager** — No immediate reporting relationships; those must be configured separately (EMP-011)

**Failure Flows:**

- **FF-1: Self-role change** — "You cannot change your own role. Use ownership transfer instead."
- **FF-2: Target is Owner** — N/A (only one Owner; this shouldn't be possible in UI)
- **FF-3: Permission denied** — Non-Owner gets 403
- **FF-4: Concurrent modification** — Optimistic lock conflict; retry

**Business Rules:** BR-ORG-003, BR-PERM-002
**Required Permissions:** org.members.role.change (Owner only)
**Data Created/Modified:** Membership.role updated
**Notifications:** In-app notification to affected member: "Your role has been changed to [role]"
**Audit Events:** `member.role_changed` — actor: Owner, target: member, before: old role, after: new role
**Security Considerations:**
- Server-side enforcement: only Owner can change roles
- Permission change takes effect immediately (no cached stale permissions)
- Audit trail is mandatory for all role changes
- Cannot promote self or create second Owner via this endpoint

**Acceptance Criteria:**
1. Owner can change any member's role (except their own)
2. New permissions take effect immediately
3. Affected member receives notification
4. Demotion shows confirmation warning
5. Audit log records before and after roles
6. Non-owners cannot access this function

**Priority:** P0
**Related Use Cases:** ORG-010, ORG-012, ORG-013

---

### ORG-012: Remove Organisation Member

- **ID:** ORG-012
- **Name:** Remove Organisation Member
- **Goal:** Owner or HR Admin revokes a member's access to the organisation
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
  - Target member exists and has active membership
  - Target member is not the Owner
- **Trigger:** User navigates to Members and clicks "Remove" on a member

**Main Success Flow:**

1. User selects a member and clicks "Remove Member"
2. System displays confirmation dialog: "Remove [Name] from [Org]? They will lose access immediately. Their employee records and history will be preserved."
3. User confirms removal
4. System validates target is not the Owner (BR-ORG-003)
5. System validates HR Admin cannot remove another HR Admin (only Owner can)
6. System deactivates the Membership record (soft-delete with revoked_at timestamp)
7. System invalidates any active sessions for this user in this organisation
8. System preserves all employee data, leave history, attendance, documents (BR-ORG-006)
9. System displays success message
10. Removed member can no longer access the organisation

**Alternative Flows:**

- **AF-1: Member has pending approvals** — System reassigns pending leave approvals to HR (BR-CROSS-002)
- **AF-2: Member is a manager** — System flags their direct reports as manager-less; warns admin
- **AF-3: HR Admin removing an Employee/Manager** — Allowed per permission matrix

**Failure Flows:**

- **FF-1: Cannot remove Owner** — "The organisation owner cannot be removed. Transfer ownership first."
- **FF-2: HR Admin removing HR Admin** — 403: "Only the Owner can remove HR Administrators"
- **FF-3: Removing self** — Allowed for non-Owner members (voluntary departure); confirm with extra warning
- **FF-4: Permission denied** — Employees/Managers get 403

**Business Rules:** BR-ORG-003, BR-ORG-006, BR-CROSS-002
**Required Permissions:** org.members.remove (Owner: any non-Owner; HR Admin: Employee and Manager only)
**Data Created/Modified:** Membership.status → revoked, Membership.revokedAt set; active sessions invalidated
**Notifications:** Notification to removed member (if they have another org): "Your access to [Org] has been revoked"
**Audit Events:** `member.removed` — actor: remover, target: removed member, metadata: previous role
**Security Considerations:**
- Session invalidation is immediate (no grace period)
- Data is preserved for legal/compliance (BR-ORG-006)
- Cannot be used to remove the sole Owner
- HR Admin escalation prevention (cannot remove equal/higher roles)

**Acceptance Criteria:**
1. Owner can remove any non-Owner member
2. HR Admin can remove Employees and Managers only
3. Removed member loses access immediately
4. Employee records and history are preserved
5. Active sessions are terminated
6. Owner cannot be removed
7. Audit log records the removal

**Priority:** P0
**Related Use Cases:** ORG-010, ORG-011, ORG-013, EMP-013

---

### ORG-013: Transfer Ownership

- **ID:** ORG-013
- **Name:** Transfer Ownership
- **Goal:** Current Owner transfers organisation ownership to another active member
- **Primary Actor:** Owner
- **Supporting Actors:** New Owner (target member)
- **Preconditions:**
  - User is authenticated as Owner
  - Target member has an active membership in the organisation
  - Target member is not already the Owner
- **Trigger:** Owner navigates to Settings > Danger Zone and initiates ownership transfer

**Main Success Flow:**

1. Owner navigates to Settings > Organisation > Danger Zone
2. Owner clicks "Transfer Ownership"
3. System displays warning: "This action will transfer full control of [Org] to another member. You will be demoted to HR Administrator. This cannot be undone without the new owner's cooperation."
4. Owner selects the target member from a dropdown of active members
5. System requires re-authentication (password confirmation) for security
6. Owner enters password and confirms
7. System validates password
8. System executes atomic transaction (BR-ORG-004):
   a. Updates target member's role to Owner
   b. Updates current user's role to HR Administrator
9. System invalidates permission cache for both users
10. System displays success: "Ownership transferred to [Name]. You are now HR Administrator."

**Alternative Flows:**

- **AF-1: Target declines** — N/A; transfer is immediate and doesn't require target acceptance in V1
- **AF-2: Owner wants to remain as Manager instead of HR Admin** — Not supported in V1; Owner always becomes HR Admin

**Failure Flows:**

- **FF-1: Wrong password** — "Incorrect password. Ownership not transferred."
- **FF-2: Target no longer active** — "This member is no longer active. Please select another."
- **FF-3: Transaction failure** — System rolls back; original Owner retained (BR-ORG-004)
- **FF-4: Concurrent transfer** — Optimistic lock prevents; error displayed
- **FF-5: Target is self** — "Cannot transfer ownership to yourself"

**Business Rules:** BR-ORG-003, BR-ORG-004
**Required Permissions:** org.ownership.transfer (Owner only)
**Data Created/Modified:** Two Membership records updated atomically (roles swapped)
**Notifications:** In-app + email to new Owner: "You are now the owner of [Org]"; notification to previous owner confirming demotion
**Audit Events:** `organisation.ownership_transferred` — actor: previous Owner, target: new Owner, severity: HIGH
**Security Considerations:**
- Requires re-authentication (password confirmation)
- Atomic transaction prevents inconsistent state
- Irreversible without new owner's cooperation
- High-severity audit event
- Both parties notified
- Email notification ensures awareness even if in-app is missed

**Acceptance Criteria:**
1. Only the current Owner can initiate transfer
2. Re-authentication is required
3. Transfer is atomic (both role changes succeed or neither does)
4. Previous Owner becomes HR Administrator
5. New Owner has full control immediately
6. Both parties receive notifications
7. High-severity audit event is created
8. Self-transfer is prevented

**Priority:** P1
**Related Use Cases:** ORG-011, ORG-012

---


## Employee Module

---

### EMP-001: Add Employee

- **ID:** EMP-001
- **Name:** Add Employee
- **Goal:** HR Admin or Owner creates a new employee record in the organisation
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
  - Organisation exists and is active
- **Trigger:** User navigates to Employees and clicks "Add Employee"

**Main Success Flow:**

1. User clicks "Add Employee" in the employee directory
2. System displays the employee creation form with sections: Personal Details, Employment Details
3. User enters required fields: first name, last name, work email
4. User enters optional fields: personal email, phone, date of birth, gender, address
5. User selects employment details: start date, employment type, department (optional), job title (optional), work location (optional)
6. System validates work email uniqueness within organisation (BR-EMP-002)
7. System validates all field formats (email, phone, date)
8. System creates Employee record with status "Draft"
9. System displays success: "Employee [Name] has been created"
10. System redirects to the new employee's profile page

**Alternative Flows:**

- **AF-1: Add and invite** — User can check "Send login invitation" to immediately trigger EMP-002 after creation
- **AF-2: Bulk import** — V2 feature; not supported in V1
- **AF-3: Assign manager during creation** — Optional manager field can be set during creation (EMP-011 flow embedded)
- **AF-4: Set to Active immediately** — If start date is today or past, system asks if employee should be marked Active

**Failure Flows:**

- **FF-1: Duplicate work email** — "An employee with this email already exists in your organisation" (BR-EMP-002)
- **FF-2: Invalid date format** — Validation error with expected format
- **FF-3: Required fields missing** — Inline validation errors on submit
- **FF-4: Permission denied** — Employee/Manager role gets 403
- **FF-5: Invalid employment type** — Must be one of the configured types

**Business Rules:** BR-EMP-001, BR-EMP-002, BR-EMP-007
**Required Permissions:** employee.write (Owner, HR Administrator)
**Data Created/Modified:** Employee record created (status: Draft)
**Notifications:** None (unless invitation is sent — see EMP-002)
**Audit Events:** `employee.created` — actor: creator, target: new employee ID, metadata: fields set
**Security Considerations:**
- Server-side validation of all fields (prevent XSS in name fields)
- Work email uniqueness enforced at database level
- Organisation ID comes from session, not request body (BR-ORG-002)
- Sensitive fields (national ID, bank details) are NOT set during creation — separate flow

**Acceptance Criteria:**
1. Owner and HR Admin can create employees
2. Work email uniqueness is enforced within the organisation
3. Employee is created with Draft status
4. All required fields are validated
5. Employee appears in directory after creation
6. Audit log records the creation
7. Optional fields can be left blank

**Priority:** P0
**Related Use Cases:** EMP-002, EMP-006, EMP-007, EMP-008, EMP-009, EMP-010, EMP-011

---

### EMP-002: Invite Employee

- **ID:** EMP-002
- **Name:** Invite Employee
- **Goal:** Send a login invitation to an employee so they can access the platform
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** Email Service, Employee
- **Preconditions:**
  - Employee record exists
  - Employee does not already have a linked User account
  - Employee has a valid email address
- **Trigger:** User clicks "Send Invitation" on an employee profile, or checks "Send invitation" during employee creation

**Main Success Flow:**

1. User clicks "Invite to Platform" on the employee's profile
2. System validates employee has a work email configured
3. System validates no existing User account is linked to this employee
4. System validates no pending invitation exists for this email in this org
5. System creates Invitation record (token, email, role: Employee, org_id, employee_id, expiry: 7 days)
6. System sends invitation email to the employee's work email
7. System updates Employee status from "Draft" to "Invited"
8. System displays success: "Invitation sent to [email]"
9. Employee receives email and can accept via AUTH-006 flow
10. On acceptance, system links the new/existing User to the Employee record

**Alternative Flows:**

- **AF-1: Employee already has User (different org)** — On acceptance, Membership + Employee link created; no registration needed
- **AF-2: Resend invitation** — If previous invitation expired, user can resend (creates new token)
- **AF-3: Cancel invitation** — User can revoke before acceptance
- **AF-4: Invite with Manager role** — If employee will be a manager, role can be specified

**Failure Flows:**

- **FF-1: No email on record** — "Employee must have a work email to receive an invitation"
- **FF-2: Already has login** — "This employee already has platform access"
- **FF-3: Active invitation pending** — "An invitation is already pending. Revoke it first or wait for expiry."
- **FF-4: Email delivery failure** — Invitation created; resend available
- **FF-5: Permission denied** — 403 for non-Owner/HR Admin

**Business Rules:** BR-EMP-001, BR-AUTH-003, BR-AUTH-008, BR-EMP-003
**Required Permissions:** employee.write + org.members.invite
**Data Created/Modified:** Invitation record created, Employee.status → Invited
**Notifications:** Invitation email to employee; in-app notification to inviter on acceptance
**Audit Events:** `employee.invited` — actor: inviter, target: employee ID
**Security Considerations:**
- Invitation token is single-use and expires in 7 days
- Employee.userId is set only upon successful acceptance
- Cannot invite to a role higher than Employee without appropriate permission
- Rate-limit invitations

**Acceptance Criteria:**
1. HR Admin can send login invitation to any employee without existing access
2. Employee status changes to "Invited"
3. Invitation email is delivered
4. On acceptance, User and Employee records are linked
5. Duplicate invitations are prevented
6. Expired invitations can be resent

**Priority:** P0
**Related Use Cases:** EMP-001, AUTH-006, AUTH-008, ORG-010

---


### EMP-003: View Employee Directory

- **ID:** EMP-003
- **Name:** View Employee Directory
- **Goal:** User views a list of all employees in the organisation
- **Primary Actor:** Any authenticated member (Owner, HR Admin, Manager, Employee)
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated with active membership
- **Trigger:** User navigates to the Employees section

**Main Success Flow:**

1. User navigates to Employees in the main navigation
2. System queries employees for the current organisation (tenant-scoped)
3. System applies default filters: excludes Archived status, sorts by name
4. System renders employee directory as a paginated table/grid
5. Each entry shows: name, profile photo, job title, department, work email, status badge
6. User can see total employee count and pagination controls
7. System loads first page (default 25 per page)

**Alternative Flows:**

- **AF-1: Empty organisation** — Display empty state: "No employees yet. Add your first employee."
- **AF-2: Employee role view** — Employees see limited fields (no personal contact details of others)
- **AF-3: Grid/List toggle** — User can switch between table view and card grid view
- **AF-4: Large dataset** — Server-side pagination for organisations with 100+ employees

**Failure Flows:**

- **FF-1: Permission denied** — Should not occur (all members can view directory); 403 only if membership invalid
- **FF-2: Network error** — Show error state with retry button
- **FF-3: Session expired** — Redirect to sign-in (AUTH-011)

**Business Rules:** BR-EMP-008, BR-ORG-001
**Required Permissions:** employee.read (all roles)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None (directory view is not audited; individual profile access may be)
**Security Considerations:**
- Query MUST be scoped to organisation_id from session (BR-ORG-001)
- Employee role sees limited field set (no personal email, personal phone)
- Deactivated employees visible to Owner/HR Admin; hidden from Employee role by default
- Archived employees excluded from default view for all roles

**Acceptance Criteria:**
1. All authenticated members can view the employee directory
2. Directory is scoped to current organisation only
3. Pagination works for large datasets
4. Employee role sees limited information
5. Archived employees are hidden by default
6. Empty state is shown when no employees exist
7. Directory loads within 2 seconds for up to 500 employees

**Priority:** P0
**Related Use Cases:** EMP-004, EMP-005, EMP-006

---

### EMP-004: Search Employees

- **ID:** EMP-004
- **Name:** Search Employees
- **Goal:** User finds specific employees by searching name, email, or employee ID
- **Primary Actor:** Any authenticated member
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated
  - Employees exist in the organisation
- **Trigger:** User types in the search box on the employee directory page

**Main Success Flow:**

1. User clicks the search input on the employee directory
2. User types a search query (minimum 2 characters)
3. System debounces input (300ms delay)
4. System searches across: first name, last name, work email, employee number
5. System returns matching results (still respecting organisation scope and role-based filtering)
6. Results update in real-time as user types
7. Matching text is highlighted in results
8. Result count is displayed

**Alternative Flows:**

- **AF-1: No results** — Display "No employees match your search" with suggestion to adjust query
- **AF-2: Single character** — Search does not trigger until 2+ characters (prevents excessive queries)
- **AF-3: Clear search** — User clicks X to clear search and return to full directory

**Failure Flows:**

- **FF-1: Search timeout** — Display "Search took too long. Please try a more specific query."
- **FF-2: Special characters** — System sanitizes input; no SQL injection possible

**Business Rules:** BR-ORG-001 (tenant scoping)
**Required Permissions:** employee.read (all roles)
**Data Created/Modified:** None
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Search input must be sanitized (prevent injection)
- Results must be tenant-scoped (cannot search across organisations)
- Role-based field restrictions still apply to search results
- Debounce prevents excessive database queries

**Acceptance Criteria:**
1. Search returns results matching name, email, or employee number
2. Results appear within 500ms of typing pause
3. Search is scoped to current organisation
4. Minimum 2 characters required
5. Special characters do not cause errors
6. Empty results show helpful message

**Priority:** P0
**Related Use Cases:** EMP-003, EMP-005, EMP-006

---

### EMP-005: Filter Employees

- **ID:** EMP-005
- **Name:** Filter Employees
- **Goal:** User narrows the employee directory by department, status, employment type, or location
- **Primary Actor:** Any authenticated member
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated
  - Employee directory is displayed
- **Trigger:** User selects filter criteria from filter controls

**Main Success Flow:**

1. User opens filter panel/dropdown on the employee directory
2. System displays available filters: Department, Status, Employment Type, Location, Job Title
3. User selects one or more filter values (e.g., Department: Engineering, Status: Active)
4. System applies filters server-side and returns filtered results
5. Active filter badges are displayed showing current filters
6. Result count updates to reflect filtered set
7. Pagination resets to page 1

**Alternative Flows:**

- **AF-1: Multiple filters combined** — Filters are AND-combined (e.g., Engineering AND Active)
- **AF-2: Clear individual filter** — User can remove one filter while keeping others
- **AF-3: Clear all filters** — "Reset Filters" button clears all
- **AF-4: Save filter preset** — V2 feature
- **AF-5: Filter includes archived** — HR Admin can toggle "Show Archived" to include archived employees

**Failure Flows:**

- **FF-1: No results for filter combination** — "No employees match the selected filters"
- **FF-2: Invalid filter value** — Silently ignored; filter dropdown only shows valid options

**Business Rules:** BR-EMP-008 (archived exclusion), BR-ORG-001 (tenant scoping)
**Required Permissions:** employee.read (all roles)
**Data Created/Modified:** None
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Filter values must be validated against actual org data (prevent injection via URL params)
- Archived filter only available to Owner/HR Admin
- Filters are applied server-side (not client-only)

**Acceptance Criteria:**
1. Users can filter by department, status, type, location, job title
2. Multiple filters can be combined
3. Filters persist during pagination
4. Filter state is reflected in URL (for bookmarking/sharing)
5. Active filters are clearly visible
6. Clear all filters returns to default view

**Priority:** P1
**Related Use Cases:** EMP-003, EMP-004

---


### EMP-006: View Employee Profile

- **ID:** EMP-006
- **Name:** View Employee Profile
- **Goal:** User views detailed information about a specific employee
- **Primary Actor:** Any authenticated member (with scope restrictions)
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated
  - Target employee exists in the current organisation
  - User has appropriate permission/scope to view the employee
- **Trigger:** User clicks on an employee name in the directory or navigates to their profile URL

**Main Success Flow:**

1. User clicks an employee name or navigates to /employees/[id]
2. System validates the employee belongs to the current organisation
3. System validates user has permission to view this employee (scope check)
4. System loads employee profile data with role-based field filtering
5. System displays profile sections: Personal Info, Employment Details, Department, Manager, Status
6. Owner/HR Admin sees full profile including all fields
7. Manager sees profile of direct reports with limited personal fields
8. Employee sees their own full profile

**Alternative Flows:**

- **AF-1: Employee viewing own profile** — Full access to own data (except compensation requires separate section/permission)
- **AF-2: Manager viewing non-report** — Can see basic directory info only (name, title, department); not full profile
- **AF-3: Profile tabs** — Profile has tabs: Overview, Personal, Employment, Documents, Leave, Attendance
- **AF-4: Compensation section** — Only visible to Owner, HR Admin, and self (employee.compensation.read)

**Failure Flows:**

- **FF-1: Employee not found** — 404 "Employee not found"
- **FF-2: Cross-tenant attempt** — 404 (not 403, to prevent information leakage)
- **FF-3: Insufficient scope** — Manager viewing non-report: limited view or 403 depending on implementation
- **FF-4: Archived employee** — Owner/HR Admin can view; others see 404

**Business Rules:** BR-EMP-005, BR-PERM-004, BR-PERM-005, BR-ORG-001
**Required Permissions:** employee.read.full (Owner/HR Admin: all; Manager: direct reports; Employee: self only)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** Access to sensitive fields (compensation, national ID) logged if viewed
**Security Considerations:**
- Sensitive fields stripped from response based on role (server-side filtering)
- Cross-tenant access returns 404 (not 403)
- Manager scope validated against reporting_relationships table
- Compensation data requires separate permission check
- Profile URL should not be enumerable (use UUID, not sequential ID)

**Acceptance Criteria:**
1. Owner/HR Admin can view any employee's full profile
2. Manager can view direct reports' profiles (limited personal fields)
3. Employee can view their own full profile
4. Sensitive fields (compensation, national ID) are hidden based on role
5. Cross-tenant access is denied silently (404)
6. Profile loads within 1 second
7. All profile sections are accessible via tabs

**Priority:** P0
**Related Use Cases:** EMP-003, EMP-007, EMP-008, EMP-016

---

### EMP-007: Edit Personal Details

- **ID:** EMP-007
- **Name:** Edit Personal Details
- **Goal:** Authorised user updates an employee's personal information
- **Primary Actor:** Owner, HR Administrator, or Employee (self)
- **Supporting Actors:** None
- **Preconditions:**
  - Target employee exists
  - User has permission to edit personal details for this employee
- **Trigger:** User clicks "Edit" on the Personal Details section of an employee profile

**Main Success Flow:**

1. User navigates to employee profile > Personal Details tab
2. User clicks "Edit" button
3. System displays editable form with current values: first name, last name, date of birth, gender, personal email, personal phone, emergency contacts, address
4. User modifies desired fields
5. User clicks "Save Changes"
6. System validates all field formats
7. System saves changes with audit trail (before/after values)
8. System displays success message
9. Profile reflects updated information immediately

**Alternative Flows:**

- **AF-1: Employee editing own profile** — Limited fields editable: personal phone, emergency contacts, address. DOB/gender changes require HR in V1.
- **AF-2: Partial update** — Only modified fields are saved; unchanged fields ignored
- **AF-3: Cancel edit** — User discards changes and returns to view mode

**Failure Flows:**

- **FF-1: Invalid email format** — Inline validation error
- **FF-2: Invalid phone format** — Inline validation error
- **FF-3: Permission denied** — Employee trying to edit non-self profile: 403
- **FF-4: Concurrent edit** — Optimistic lock conflict: "This profile was updated by someone else. Please refresh."
- **FF-5: Employee archived** — Cannot edit archived employee details

**Business Rules:** BR-PERM-005, BR-DATA-004
**Required Permissions:** employee.personal.write (Owner/HR Admin: any; Employee: own only — limited fields)
**Data Created/Modified:** Employee personal fields updated
**Notifications:** None
**Audit Events:** `employee.personal_updated` — actor, target, changes: {field: {before, after}}
**Security Considerations:**
- Server-side validation of all fields (XSS prevention)
- Employee self-edit limited to safe fields only
- Audit trail captures all changes including who made them
- Optimistic locking prevents lost updates
- Input sanitized before storage

**Acceptance Criteria:**
1. Owner/HR Admin can edit any employee's personal details
2. Employee can edit their own limited personal details
3. All changes are captured in audit trail with before/after values
4. Field validation prevents invalid data
5. Concurrent edits are detected and reported
6. Archived employees cannot be edited

**Priority:** P0
**Related Use Cases:** EMP-006, EMP-008, EMP-016

---

### EMP-008: Edit Employment Details

- **ID:** EMP-008
- **Name:** Edit Employment Details
- **Goal:** HR Admin or Owner updates an employee's employment-related information
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Target employee exists and is not archived
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User clicks "Edit" on Employment Details section of employee profile

**Main Success Flow:**

1. User navigates to employee profile > Employment tab
2. User clicks "Edit" button
3. System displays editable form: employment type, start date, probation end date, department, job title, work location, employee number
4. User modifies desired fields
5. User clicks "Save Changes"
6. System validates employee number uniqueness if changed
7. System validates department/job title/location exist in org
8. System creates employment history record for significant changes (department, job title)
9. System updates Employee record
10. System displays success message

**Alternative Flows:**

- **AF-1: Department change** — Creates a department assignment history entry with effective date
- **AF-2: Job title change** — Creates a title history entry
- **AF-3: Employee number generation** — System can auto-generate sequential employee numbers if field left blank

**Failure Flows:**

- **FF-1: Duplicate employee number** — "Employee number already in use"
- **FF-2: Invalid department/title** — "Selected department does not exist" (data out of sync)
- **FF-3: Permission denied** — Employees/Managers get 403
- **FF-4: Archived employee** — "Cannot modify archived employee records"

**Business Rules:** BR-EMP-007, BR-ORG-001
**Required Permissions:** employee.employment.write (Owner, HR Administrator)
**Data Created/Modified:** Employee record updated, EmploymentHistory records (if dept/title changed)
**Notifications:** None
**Audit Events:** `employee.employment_updated` — actor, target, changes: {field: {before, after}}
**Security Considerations:**
- Only Owner/HR Admin can modify employment details
- Employee number uniqueness at database level
- History tracking prevents data loss on changes
- Org ID from session, never from request

**Acceptance Criteria:**
1. Owner/HR Admin can edit all employment fields
2. Department and job title changes create history entries
3. Employee number uniqueness is enforced
4. Invalid references (non-existent dept) are rejected
5. Audit trail records all changes
6. Archived employees cannot be modified

**Priority:** P0
**Related Use Cases:** EMP-001, EMP-009, EMP-010

---


### EMP-009: Assign Department

- **ID:** EMP-009
- **Name:** Assign Department
- **Goal:** Assign or change an employee's department within the organisation
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Target employee exists and is active (not archived)
  - Target department exists and is active (not archived) in the organisation
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User selects a department from the department field on the employee profile or via a dedicated "Assign Department" action

**Main Success Flow:**

1. User opens employee profile > Employment Details
2. User clicks on the Department field or "Change Department" action
3. System displays dropdown of active departments in the organisation
4. User selects the target department
5. User optionally sets an effective date (defaults to today)
6. System validates the department belongs to the same organisation
7. System updates Employee.departmentId
8. System creates DepartmentAssignment history record (employee, from_dept, to_dept, effective_date)
9. System displays success: "[Name] assigned to [Department]"
10. Employee profile reflects the new department

**Alternative Flows:**

- **AF-1: First assignment (from null)** — No "from" department in history; only "to"
- **AF-2: Remove from department** — Set department to null; employee becomes "Unassigned"
- **AF-3: Department has a manager** — Employee now appears in that manager's team view

**Failure Flows:**

- **FF-1: Department archived** — "Cannot assign to an archived department"
- **FF-2: Department from different org** — Server-side check prevents (cross-tenant)
- **FF-3: Employee archived** — "Cannot modify archived employee"
- **FF-4: Permission denied** — 403 for Employee/Manager

**Business Rules:** BR-EMP-007, BR-ORG-001, BR-CROSS-001
**Required Permissions:** employee.employment.write (Owner, HR Administrator)
**Data Created/Modified:** Employee.departmentId updated, DepartmentAssignment history created
**Notifications:** None (V2: notify the new department manager)
**Audit Events:** `employee.department_changed` — actor, target, before: old dept, after: new dept, effective_date
**Security Considerations:**
- Department must belong to the same organisation (server-side validation)
- History record ensures audit trail of all department changes
- Cannot assign to archived departments

**Acceptance Criteria:**
1. HR Admin can assign employee to any active department
2. Department change creates history record with effective date
3. Employee appears in new department's team view
4. Previous department assignment is preserved in history
5. Assigning to archived department is prevented
6. Removing department assignment (unassign) is supported

**Priority:** P0
**Related Use Cases:** EMP-008, EMP-010, EMP-011

---

### EMP-010: Assign Job Title

- **ID:** EMP-010
- **Name:** Assign Job Title
- **Goal:** Assign or change an employee's job title within the organisation
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Target employee exists and is active (not archived)
  - Target job title exists in the organisation's configured titles
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User edits the Job Title field on the employee profile

**Main Success Flow:**

1. User opens employee profile > Employment Details
2. User clicks on the Job Title field or "Change Title" action
3. System displays dropdown of configured job titles in the organisation
4. User selects the new job title
5. User optionally sets an effective date (defaults to today)
6. System validates job title belongs to the organisation
7. System updates Employee.jobTitleId
8. System creates TitleAssignment history record (employee, from_title, to_title, effective_date)
9. System displays success: "[Name] is now [Job Title]"
10. Employee profile and directory reflect the new title

**Alternative Flows:**

- **AF-1: First title assignment** — No previous title; history shows "assigned" rather than "changed"
- **AF-2: Title not in list** — User must first create the title via job title management (requires separate permission)
- **AF-3: Promotion/demotion context** — The system records the change; semantics (promotion vs lateral) are not tracked in V1

**Failure Flows:**

- **FF-1: Job title archived** — "Cannot assign an archived job title"
- **FF-2: Job title from different org** — Prevented by scoped query
- **FF-3: Employee archived** — "Cannot modify archived employee"
- **FF-4: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** employee.employment.write (Owner, HR Administrator)
**Data Created/Modified:** Employee.jobTitleId updated, TitleAssignment history created
**Notifications:** None
**Audit Events:** `employee.title_changed` — actor, target, before: old title, after: new title, effective_date
**Security Considerations:**
- Job title must belong to same organisation
- History preserves complete title progression
- Only HR Admin/Owner can change titles

**Acceptance Criteria:**
1. HR Admin can assign any active job title to an employee
2. Title change creates history record
3. Directory view reflects new title immediately
4. Archived job titles cannot be assigned
5. Audit log records the change with before/after values

**Priority:** P0
**Related Use Cases:** EMP-008, EMP-009

---

### EMP-011: Assign Manager

- **ID:** EMP-011
- **Name:** Assign Manager
- **Goal:** Establish or change the reporting relationship for an employee
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Target employee exists and is active
  - Target manager exists and is active
  - User is authenticated as Owner or HR Administrator
  - Target manager is not the same person as the employee
- **Trigger:** User sets or changes the "Reports To" field on an employee profile

**Main Success Flow:**

1. User opens employee profile > Employment Details
2. User clicks on "Reports To" field or "Assign Manager" action
3. System displays searchable dropdown of active employees who could be managers
4. User selects the target manager
5. System validates the assignment does not create a circular reference (BR-EMP-006)
6. System validates target manager is an active employee
7. System creates/updates ReportingRelationship record
8. System displays success: "[Employee] now reports to [Manager]"
9. Employee appears in the manager's "Direct Reports" view
10. Leave approval chain is updated to route through new manager

**Alternative Flows:**

- **AF-1: Remove manager** — User clicks "Remove Manager"; employee becomes manager-less (leave routes to HR per BR-LEAVE-010)
- **AF-2: Manager reassignment with pending leave** — Pending leave requests remain with original approver; new requests go to new manager
- **AF-3: First manager assignment** — New reporting relationship created
- **AF-4: Change manager** — Previous relationship is ended (effective_date set), new one created

**Failure Flows:**

- **FF-1: Circular reference detected** — "Cannot assign [Manager] as they already report to [Employee] (directly or indirectly)" (BR-EMP-006)
- **FF-2: Self-assignment** — "An employee cannot report to themselves"
- **FF-3: Inactive manager** — "Selected manager is not active"
- **FF-4: Employee archived** — Cannot modify
- **FF-5: Permission denied** — 403

**Business Rules:** BR-EMP-006, BR-LEAVE-010, BR-CROSS-002
**Required Permissions:** reporting.write (Owner, HR Administrator)
**Data Created/Modified:** ReportingRelationship created/updated
**Notifications:** Notification to new manager: "[Employee] has been assigned as your direct report"
**Audit Events:** `employee.manager_assigned` — actor, target: employee, metadata: {previous_manager, new_manager}
**Security Considerations:**
- Circular reference detection must traverse full chain (graph cycle detection)
- Reporting relationships affect permission scopes (manager visibility)
- Leave approval routing is immediately affected
- Only HR Admin/Owner can modify reporting chains

**Acceptance Criteria:**
1. HR Admin can assign any active employee as a manager
2. Circular references are detected and prevented
3. Self-assignment is prevented
4. New manager receives notification
5. Employee appears in new manager's team view
6. Leave approval routes to new manager for future requests
7. Removing manager designation is supported
8. Audit log records the change

**Priority:** P0
**Related Use Cases:** EMP-008, EMP-009, EMP-012, EMP-013

---


### EMP-012: Change Employment Status

- **ID:** EMP-012
- **Name:** Change Employment Status
- **Goal:** HR Admin or Owner transitions an employee through valid lifecycle states
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Target employee exists
  - Requested transition is valid per the state machine (BR-EMP-003)
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User selects a new status from the status management interface on the employee profile

**Main Success Flow:**

1. User opens employee profile > Status section
2. User clicks "Change Status" button
3. System displays only the valid target states based on current state (BR-EMP-003)
4. User selects the target status
5. System requires a reason for status changes (mandatory for Suspended, optional for Active)
6. User enters reason (if required) and confirms
7. System validates the transition is permitted
8. System updates Employee.status
9. System executes side effects based on target status (see Alternative Flows)
10. System displays success: "[Name] status changed to [new status]"

**Alternative Flows:**

- **AF-1: Draft → Active** — Employee becomes fully active; appears in all operational views
- **AF-2: Active → Suspended** — Reason required; login access remains but operational features restricted (V2 detail)
- **AF-3: Active → Deactivated** — Triggers EMP-013 full deactivation flow
- **AF-4: Suspended → Active** — Restrictions lifted; normal access restored
- **AF-5: Deactivated → Active** — Triggers EMP-014 reactivation flow

**Failure Flows:**

- **FF-1: Invalid transition** — "Cannot change status from [current] to [target]" with valid options shown
- **FF-2: Missing reason for suspension** — "A reason is required for employee suspension"
- **FF-3: Employee archived** — "Archived employees cannot have their status changed. Unarchive first."
- **FF-4: Permission denied** — 403
- **FF-5: Concurrent modification** — Optimistic lock conflict

**Business Rules:** BR-EMP-003, BR-EMP-004
**Required Permissions:** employee.status.change (Owner, HR Administrator)
**Data Created/Modified:** Employee.status updated, StatusHistory record created
**Notifications:** Depends on transition (see EMP-013, EMP-014)
**Audit Events:** `employee.status_changed` — actor, target, before: old status, after: new status, reason
**Security Considerations:**
- State machine validation is mandatory (prevent arbitrary transitions)
- Only Owner/HR Admin can change status
- Deactivation has significant side effects (session termination, cascading cancellations)
- Reason provides accountability for sensitive transitions

**Acceptance Criteria:**
1. Only valid transitions are offered to the user
2. Invalid transitions are rejected server-side
3. Reason is required for suspension
4. Status history is maintained
5. Side effects execute correctly per target status
6. Audit log captures transition with reason
7. Concurrent modifications are prevented

**Priority:** P0
**Related Use Cases:** EMP-013, EMP-014, EMP-015

---

### EMP-013: Deactivate Employee

- **ID:** EMP-013
- **Name:** Deactivate Employee
- **Goal:** HR Admin or Owner terminates an employee's active employment, revoking access and cleaning up operational state
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** System (for cascading operations)
- **Preconditions:**
  - Employee is currently in Active or Suspended status
  - User is authenticated as Owner or HR Administrator
  - Employee is not the organisation Owner's own record
- **Trigger:** User changes employee status to "Deactivated" via EMP-012

**Main Success Flow:**

1. User initiates status change to "Deactivated" (via EMP-012 flow)
2. System requires a reason (e.g., "Resignation", "Termination", "End of Contract")
3. User optionally sets an effective date (last working day)
4. System executes deactivation within a database transaction:
   a. Updates Employee.status to "Deactivated"
   b. Sets Employee.deactivatedAt timestamp
   c. Cancels all pending leave requests for this employee (BR-EMP-004)
   d. Closes any open attendance session (records system-generated clock-out)
   e. Cancels active onboarding tasks (BR-ONB-005)
   f. Removes employee from manager approval routing (BR-CROSS-002)
   g. Flags direct reports as manager-less (if this employee was a manager)
5. System invalidates user's session for this organisation (if they have a User account)
6. System revokes organisation membership access
7. System preserves all historical data (leave history, attendance, documents)
8. System displays success: "[Name] has been deactivated"

**Alternative Flows:**

- **AF-1: Employee is a manager** — System warns about direct reports becoming manager-less; lists affected employees
- **AF-2: Employee has pending leave approvals (as manager)** — Those pending requests route to HR
- **AF-3: Effective date in future** — System schedules deactivation (V2); in V1, deactivation is immediate only

**Failure Flows:**

- **FF-1: Cannot deactivate Owner** — "The organisation owner cannot be deactivated"
- **FF-2: Employee already deactivated** — "Employee is already deactivated"
- **FF-3: Transaction failure** — Full rollback; employee remains active
- **FF-4: Permission denied** — 403

**Business Rules:** BR-EMP-004, BR-AUTH-005, BR-CROSS-002, BR-ONB-005
**Required Permissions:** employee.deactivate (Owner, HR Administrator)
**Data Created/Modified:** Employee.status → Deactivated, pending leave cancelled, attendance closed, onboarding cancelled, reporting flags set
**Notifications:** In-app notification to the employee (if they have another org): "Your employment at [Org] has been deactivated"
**Audit Events:** `employee.deactivated` — actor, target, reason, effective_date, cascading_actions: [leave_cancelled: N, attendance_closed: Y/N, onboarding_cancelled: Y/N]
**Security Considerations:**
- Session invalidation is immediate (no grace period)
- All cascading operations within single transaction (consistency)
- Historical data preserved (legal requirement)
- Cannot deactivate self if Owner
- Deactivated employee cannot sign into this org

**Acceptance Criteria:**
1. Employee status changes to Deactivated
2. All pending leave requests are cancelled
3. Open attendance session is closed
4. Active onboarding is cancelled
5. Session is invalidated immediately
6. Direct reports are flagged as manager-less (if applicable)
7. Historical data is preserved
8. Organisation Owner cannot be deactivated
9. Audit log records deactivation with full details

**Priority:** P0
**Related Use Cases:** EMP-012, EMP-014, EMP-015, AUTH-010

---


### EMP-014: Reactivate Employee

- **ID:** EMP-014
- **Name:** Reactivate Employee
- **Goal:** HR Admin or Owner restores a deactivated employee to active status
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Employee is currently in "Deactivated" status
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User changes employee status from "Deactivated" to "Active" via EMP-012

**Main Success Flow:**

1. User initiates status change to "Active" for a deactivated employee
2. System displays confirmation: "Reactivating [Name]. This starts a fresh active period — previously cancelled leave, attendance, and onboarding will NOT be restored."
3. User confirms and optionally sets a new start date
4. System validates the transition (Deactivated → Active is valid per BR-EMP-003)
5. System updates Employee.status to "Active"
6. System sets Employee.reactivatedAt timestamp
7. System resets leave balances for current leave year (fresh allocation per policy)
8. System restores login access (if User account linked and membership exists)
9. System displays success: "[Name] has been reactivated"
10. Employee appears in active directory views

**Alternative Flows:**

- **AF-1: Reactivate and re-invite** — If user account was removed, HR can also trigger EMP-002 to send new invitation
- **AF-2: Reassign manager** — Reactivated employee has no manager; HR should assign one (EMP-011)
- **AF-3: Reassign department** — Previous department may have changed; HR should verify assignment

**Failure Flows:**

- **FF-1: Invalid transition** — Employee must be "Deactivated" to reactivate (not Archived)
- **FF-2: Archived employee** — "Archived employees must be unarchived before reactivation"
- **FF-3: Permission denied** — 403
- **FF-4: Leave policy no longer exists** — System allocates 0 balance; HR must manually assign

**Business Rules:** BR-EMP-003, BR-CROSS-004
**Required Permissions:** employee.status.change (Owner, HR Administrator)
**Data Created/Modified:** Employee.status → Active, fresh leave balances created, reactivatedAt set
**Notifications:** Notification to employee (if they have login): "Your account at [Org] has been reactivated"
**Audit Events:** `employee.reactivated` — actor, target, new_start_date
**Security Considerations:**
- Reactivation is a NEW employment period (BR-CROSS-004)
- Previous cancelled data is NOT restored
- Login access is restored only if User account and Membership exist
- Fresh leave balance prevents gaming of deactivation/reactivation

**Acceptance Criteria:**
1. Deactivated employee can be reactivated
2. Reactivation creates a fresh state (no restoration of old data)
3. Leave balances are freshly allocated
4. Employee appears in directory again
5. Login access is restored if User account exists
6. Archived employees must be unarchived first
7. Audit log records reactivation

**Priority:** P1
**Related Use Cases:** EMP-012, EMP-013, EMP-015

---

### EMP-015: Archive Employee

- **ID:** EMP-015
- **Name:** Archive Employee
- **Goal:** Move a deactivated employee record to archived state, removing them from all operational views
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Employee is currently in "Deactivated" status (cannot archive directly from Active)
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User clicks "Archive" on a deactivated employee's profile

**Main Success Flow:**

1. User opens a deactivated employee's profile
2. User clicks "Archive Employee"
3. System displays confirmation: "Archive [Name]? They will be removed from the employee directory and all reports. Records are preserved for compliance."
4. User confirms
5. System validates employee is in Deactivated status (BR-EMP-003)
6. System updates Employee.status to "Archived"
7. System sets Employee.archivedAt timestamp
8. System excludes employee from default directory queries (BR-EMP-008)
9. System displays success: "[Name] has been archived"
10. Employee is only visible in the dedicated archive view

**Alternative Flows:**

- **AF-1: Unarchive** — Owner/HR Admin can reverse archiving: status returns to "Deactivated" (then can optionally reactivate)
- **AF-2: Bulk archive** — V2 feature; V1 is individual only

**Failure Flows:**

- **FF-1: Employee not deactivated** — "Employee must be deactivated before archiving" (BR-EMP-003)
- **FF-2: Employee already archived** — "Employee is already archived"
- **FF-3: Permission denied** — 403

**Business Rules:** BR-EMP-003, BR-EMP-008
**Required Permissions:** employee.archive (Owner, HR Administrator)
**Data Created/Modified:** Employee.status → Archived, archivedAt set
**Notifications:** None
**Audit Events:** `employee.archived` — actor, target
**Security Considerations:**
- Archiving is soft-state; no data is deleted
- Archived records retained for legal compliance
- Only accessible via explicit archive query
- Cannot archive active employees (must deactivate first)

**Acceptance Criteria:**
1. Only deactivated employees can be archived
2. Archived employees disappear from directory and reports
3. Archive view shows archived employees for HR review
4. Data is preserved (not deleted)
5. Unarchive option is available
6. Active employees cannot be archived directly
7. Audit log records the archiving

**Priority:** P1
**Related Use Cases:** EMP-012, EMP-013, EMP-014

---

### EMP-016: Restrict Sensitive Fields

- **ID:** EMP-016
- **Name:** Restrict Sensitive Fields
- **Goal:** System enforces field-level access control to protect sensitive employee data (compensation, national ID, bank details)
- **Primary Actor:** System (enforcement), with various user actors attempting access
- **Supporting Actors:** Owner (configuration)
- **Preconditions:**
  - Employee record exists with sensitive fields populated
  - User is authenticated and attempting to view or modify the employee
- **Trigger:** Any read or write operation on an employee profile that includes sensitive fields

**Main Success Flow:**

1. User requests employee profile data (via EMP-006 or similar)
2. System identifies which fields in the response are classified as sensitive
3. System checks user's permissions against field-level requirements:
   - `employee.compensation.read` — salary, allowances, pay frequency
   - `employee.sensitive.read` — national ID, bank details, passport number
4. System strips fields the user is not permitted to see from the response
5. UI renders the profile with restricted sections showing "[No access]" or hidden entirely
6. If user attempts to write to a sensitive field without permission, system returns 403
7. Access to sensitive fields by authorised users is logged to audit trail

**Alternative Flows:**

- **AF-1: Owner views all** — Owner sees all fields unconditionally
- **AF-2: HR Admin with restricted access** — If org setting `hr_admin_sensitive_access` is disabled, HR Admin cannot see national ID/bank details
- **AF-3: Employee views own sensitive data** — Employees can always view their own compensation and sensitive fields
- **AF-4: Manager views report** — Manager never sees compensation or sensitive fields for direct reports
- **AF-5: API access** — Same field restrictions apply to programmatic access

**Failure Flows:**

- **FF-1: Attempt to update sensitive field without permission** — 403 "Insufficient permissions to modify this field"
- **FF-2: Attempt to read sensitive field without permission** — Field excluded from response (not an error; graceful degradation)
- **FF-3: Org setting changed** — Permission changes take effect on next request (no cached sensitive data)

**Business Rules:** BR-PERM-004, BR-PERM-005
**Required Permissions:** employee.compensation.read, employee.sensitive.read (see permissions matrix)
**Data Created/Modified:** None (access control mechanism, not a data operation)
**Notifications:** None
**Audit Events:** `employee.sensitive_field_accessed` — actor, target, fields_accessed (for authorised access to sensitive data)
**Security Considerations:**
- Field-level permissions are enforced server-side (not just UI hiding)
- Sensitive field access is audited even for authorised users
- Organisation settings can further restrict HR Admin access
- Response serialization must exclude restricted fields (not just hide in UI)
- Sensitive data encrypted at rest in database
- API responses never leak sensitive data to unauthorized roles

**Acceptance Criteria:**
1. Manager cannot see compensation data for any employee
2. Employee can see their own compensation and sensitive data
3. HR Admin access to sensitive fields is configurable per org setting
4. Owner always has full access
5. Sensitive field access is logged to audit trail
6. API responses exclude restricted fields (not just UI)
7. Attempt to write restricted fields returns 403
8. Field restrictions work consistently across all access paths (profile view, export, API)

**Priority:** P0
**Related Use Cases:** EMP-006, EMP-007, EMP-008




## Department & Structure Module

---

### DEPT-001: Create Department

- **ID:** DEPT-001
- **Name:** Create Department
- **Goal:** HR Admin or Owner creates a new department in the organisation structure
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
  - Organisation exists and is active
- **Trigger:** User navigates to Departments and clicks "Create Department"

**Main Success Flow:**

1. User clicks "Create Department"
2. System displays creation form with fields: name, description, parent department (optional)
3. User enters department name (required) and optional description
4. User optionally selects a parent department for hierarchy
5. System validates name uniqueness within organisation
6. System creates Department record with status "Active"
7. System displays success: "Department [Name] created"
8. Department appears in the department list and org chart

**Alternative Flows:**

- **AF-1: Nested department** — User selects a parent department; new dept appears as child in hierarchy
- **AF-2: Assign manager during creation** — User optionally assigns a department manager (DEPT-004 flow embedded)

**Failure Flows:**

- **FF-1: Duplicate name** — "A department with this name already exists"
- **FF-2: Parent department archived** — "Cannot nest under an archived department"
- **FF-3: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** department.write (Owner, HR Administrator)
**Data Created/Modified:** Department record created
**Notifications:** None
**Audit Events:** `department.created` — actor, target: new department ID
**Security Considerations:**
- Name uniqueness enforced at database level
- Organisation ID from session, not request

**Acceptance Criteria:**
1. Department is created with valid unique name
2. Department appears in listings immediately
3. Nested departments are supported
4. Duplicate names are rejected
5. Audit log records creation

**Priority:** P0
**Related Use Cases:** DEPT-002, DEPT-004, EMP-009

---


### DEPT-002: Edit Department

- **ID:** DEPT-002
- **Name:** Edit Department
- **Goal:** Update a department's name, description, or parent assignment
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Department exists and is not archived
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User clicks "Edit" on a department

**Main Success Flow:**

1. User navigates to department details
2. User clicks "Edit"
3. System displays form with current values
4. User modifies name, description, or parent department
5. System validates name uniqueness (if changed)
6. System validates no circular parent reference
7. System updates Department record
8. System displays success message

**Alternative Flows:**

- **AF-1: Change parent** — Moves department in hierarchy; all child departments move with it
- **AF-2: Remove parent** — Department becomes top-level

**Failure Flows:**

- **FF-1: Duplicate name** — Validation error
- **FF-2: Circular reference** — "Cannot set parent to a child department"
- **FF-3: Department archived** — "Cannot edit archived department"

**Business Rules:** BR-ORG-001
**Required Permissions:** department.write (Owner, HR Administrator)
**Data Created/Modified:** Department record updated
**Notifications:** None
**Audit Events:** `department.updated` — actor, changes: {field: {before, after}}
**Security Considerations:**
- Circular reference detection for parent hierarchy
- Optimistic locking for concurrent edits

**Acceptance Criteria:**
1. Name, description, and parent can be edited
2. Circular parent references are prevented
3. Archived departments cannot be edited
4. Audit log records changes

**Priority:** P1
**Related Use Cases:** DEPT-001, DEPT-003

---


### DEPT-003: Archive Department

- **ID:** DEPT-003
- **Name:** Archive Department
- **Goal:** Remove a department from active use without deleting historical data
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Department exists and is active
  - Department has no active employees assigned (BR-CROSS-001)
- **Trigger:** User clicks "Archive" on a department

**Main Success Flow:**

1. User selects a department and clicks "Archive"
2. System checks for active employees assigned to this department
3. System finds no active employees
4. System displays confirmation: "Archive [Name]? It will be removed from active lists."
5. User confirms
6. System sets Department.archivedAt timestamp
7. Department is excluded from dropdowns and active lists
8. System displays success message

**Alternative Flows:**

- **AF-1: Unarchive** — HR can restore an archived department to active status
- **AF-2: Has child departments** — System warns about child departments; they must be moved or archived first

**Failure Flows:**

- **FF-1: Active employees exist** — "Cannot archive department with active employees. Reassign them first." (BR-CROSS-001)
- **FF-2: Has active child departments** — "Archive or reassign child departments first"
- **FF-3: Permission denied** — 403

**Business Rules:** BR-CROSS-001, BR-DATA-001
**Required Permissions:** department.archive (Owner, HR Administrator)
**Data Created/Modified:** Department.archivedAt set
**Notifications:** None
**Audit Events:** `department.archived` — actor, target
**Security Considerations:**
- Soft-delete only; data preserved
- Cannot archive with active members

**Acceptance Criteria:**
1. Empty departments can be archived
2. Departments with employees cannot be archived
3. Archived departments disappear from active dropdowns
4. Unarchive is available
5. Historical references remain intact

**Priority:** P1
**Related Use Cases:** DEPT-001, DEPT-006

---


### DEPT-004: Assign Department Manager

- **ID:** DEPT-004
- **Name:** Assign Department Manager
- **Goal:** Designate an employee as the head/manager of a department
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Department exists and is active
  - Target employee is active
- **Trigger:** User edits department manager field

**Main Success Flow:**

1. User opens department details
2. User clicks "Assign Manager" or edits the manager field
3. System displays searchable dropdown of active employees
4. User selects an employee
5. System validates employee is active and belongs to the organisation
6. System updates Department.managerId
7. System displays success: "[Name] is now manager of [Department]"
8. Manager gains team-level visibility for employees in this department

**Alternative Flows:**

- **AF-1: Replace existing manager** — Previous manager loses department head designation
- **AF-2: Remove manager** — Set manager to null; department has no designated head

**Failure Flows:**

- **FF-1: Employee inactive** — "Cannot assign an inactive employee as department manager"
- **FF-2: Employee from different org** — Prevented by scoped query
- **FF-3: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** department.write (Owner, HR Administrator)
**Data Created/Modified:** Department.managerId updated
**Notifications:** Notification to new manager: "You have been assigned as manager of [Department]"
**Audit Events:** `department.manager_assigned` — actor, target, before/after manager
**Security Considerations:**
- Manager assignment is distinct from reporting relationships (EMP-011)
- Only active org employees can be assigned

**Acceptance Criteria:**
1. Active employee can be assigned as department manager
2. Previous manager is replaced cleanly
3. New manager receives notification
4. Audit log records the assignment
5. Manager can be removed (set to none)

**Priority:** P1
**Related Use Cases:** DEPT-001, EMP-011

---


### DEPT-005: Move Employee Between Departments

- **ID:** DEPT-005
- **Name:** Move Employee Between Departments
- **Goal:** Transfer an employee from one department to another
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Employee exists and is active
  - Target department exists and is active
- **Trigger:** User changes an employee's department assignment

**Main Success Flow:**

1. User navigates to employee profile or department management
2. User initiates department change for an employee
3. System displays dropdown of active departments
4. User selects target department
5. User optionally sets effective date (defaults to today)
6. System validates target department is active and in same organisation
7. System updates Employee.departmentId
8. System creates DepartmentAssignment history record
9. System displays success: "[Name] moved to [Department]"
10. Employee appears in new department's member list

**Alternative Flows:**

- **AF-1: Bulk move** — Multiple employees moved at once (e.g., team restructure) — V2
- **AF-2: Move to unassigned** — Employee removed from department without new assignment

**Failure Flows:**

- **FF-1: Target department archived** — "Cannot assign to an archived department"
- **FF-2: Employee archived** — "Cannot modify archived employee"
- **FF-3: Permission denied** — 403

**Business Rules:** BR-ORG-001, BR-EMP-007
**Required Permissions:** employee.employment.write (Owner, HR Administrator)
**Data Created/Modified:** Employee.departmentId updated, DepartmentAssignment history created
**Notifications:** None (V2: notify department managers)
**Audit Events:** `employee.department_changed` — actor, target, from_dept, to_dept, effective_date
**Security Considerations:**
- Department must belong to same organisation
- History record preserves audit trail

**Acceptance Criteria:**
1. Employee can be moved to any active department
2. History record created with effective date
3. Employee appears in new department listing
4. Cannot move to archived department
5. Audit log records the transfer

**Priority:** P0
**Related Use Cases:** EMP-009, DEPT-006

---


### DEPT-006: Handle Archived Department Members

- **ID:** DEPT-006
- **Name:** Handle Archived Department Members
- **Goal:** System enforces that employees are reassigned before a department can be archived
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Department has active employees assigned
  - User wants to archive the department
- **Trigger:** User attempts to archive a department that still has members

**Main Success Flow:**

1. User attempts to archive a department (DEPT-003)
2. System detects active employees in the department
3. System displays: "This department has [N] active employees. Reassign them before archiving."
4. System lists the affected employees with links to their profiles
5. User navigates to each employee and reassigns their department (DEPT-005)
6. Once all employees are reassigned, user retries archive
7. System allows archive to proceed

**Alternative Flows:**

- **AF-1: Bulk reassign** — System offers "Move all to [department]" option to expedite
- **AF-2: Move to unassigned** — All employees set to no department

**Failure Flows:**

- **FF-1: User proceeds without reassigning** — Archive remains blocked
- **FF-2: New employees assigned during process** — System rechecks at archive time

**Business Rules:** BR-CROSS-001
**Required Permissions:** department.archive, employee.employment.write
**Data Created/Modified:** Employee.departmentId updated for moved employees
**Notifications:** None
**Audit Events:** Covered by individual DEPT-005/DEPT-003 events
**Security Considerations:**
- Atomic check at archive time prevents race condition
- Cannot bypass via direct API call

**Acceptance Criteria:**
1. Archive is blocked while employees remain
2. Clear list of affected employees is shown
3. After reassignment, archive succeeds
4. Bulk reassignment option is available
5. Race conditions are handled (re-check at commit)

**Priority:** P1
**Related Use Cases:** DEPT-003, DEPT-005

---


### DEPT-007: Create Job Title

- **ID:** DEPT-007
- **Name:** Create Job Title
- **Goal:** Add a new job title to the organisation's reference data
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Settings > Job Titles and clicks "Add"

**Main Success Flow:**

1. User clicks "Add Job Title"
2. System displays form: title name (required), description (optional)
3. User enters the job title name
4. System validates name uniqueness within organisation
5. System creates JobTitle record
6. System displays success message
7. Job title available in employee assignment dropdowns

**Alternative Flows:**

- **AF-1: Created during employee edit** — Quick-add inline without leaving employee form

**Failure Flows:**

- **FF-1: Duplicate name** — "A job title with this name already exists"
- **FF-2: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** job_title.write (Owner, HR Administrator)
**Data Created/Modified:** JobTitle record created
**Notifications:** None
**Audit Events:** `job_title.created` — actor, target
**Security Considerations:**
- Uniqueness enforced at DB level
- Tenant-scoped

**Acceptance Criteria:**
1. Job title created with unique name
2. Immediately available in dropdowns
3. Duplicates rejected
4. Audit log records creation

**Priority:** P1
**Related Use Cases:** EMP-010, DEPT-008

---

### DEPT-008: Create Work Location

- **ID:** DEPT-008
- **Name:** Create Work Location
- **Goal:** Add a new work location to the organisation's reference data
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Settings > Locations and clicks "Add"

**Main Success Flow:**

1. User clicks "Add Location"
2. System displays form: name (required), address (optional), type (office/remote/hybrid)
3. User enters location details
4. System validates name uniqueness within organisation
5. System creates WorkLocation record
6. System displays success message
7. Location available in employee assignment dropdowns

**Alternative Flows:**

- **AF-1: Remote location** — Type set to "Remote"; address optional

**Failure Flows:**

- **FF-1: Duplicate name** — "A location with this name already exists"
- **FF-2: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** location.write (Owner, HR Administrator)
**Data Created/Modified:** WorkLocation record created
**Notifications:** None
**Audit Events:** `location.created` — actor, target
**Security Considerations:**
- Tenant-scoped, uniqueness enforced

**Acceptance Criteria:**
1. Location created with unique name
2. Available in employee dropdowns immediately
3. Supports office/remote/hybrid types
4. Audit log records creation

**Priority:** P1
**Related Use Cases:** EMP-008, DEPT-007

---


### DEPT-009: Configure Employment Types

- **ID:** DEPT-009
- **Name:** Configure Employment Types
- **Goal:** Define the employment types available in the organisation (Full-time, Part-time, Contract, etc.)
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Settings > Employment Types

**Main Success Flow:**

1. User navigates to Settings > Employment Types
2. System displays current employment types (defaults: Full-time, Part-time, Contract)
3. User clicks "Add Type"
4. User enters name for new employment type
5. System validates uniqueness
6. System creates EmploymentType record
7. Type available for employee assignments

**Alternative Flows:**

- **AF-1: Edit existing type** — Rename an employment type; existing assignments update
- **AF-2: Archive type** — Soft-remove; cannot be assigned to new employees but existing assignments remain

**Failure Flows:**

- **FF-1: Duplicate name** — Validation error
- **FF-2: Archive type with employees** — Allowed (existing assignments stay; no new assignments)
- **FF-3: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** org.settings.write (Owner) or employee.employment.write (HR Administrator)
**Data Created/Modified:** EmploymentType record created/updated
**Notifications:** None
**Audit Events:** `employment_type.created` / `employment_type.updated` — actor, changes
**Security Considerations:**
- Tenant-scoped reference data
- Cannot delete types with existing references

**Acceptance Criteria:**
1. Custom employment types can be created
2. Default types (Full-time, Part-time, Contract) are seeded
3. Types can be renamed
4. Archived types cannot be assigned to new employees
5. Existing assignments are preserved when type is archived

**Priority:** P2
**Related Use Cases:** EMP-001, EMP-008

---

### DEPT-010: Assign Reporting Relationship

- **ID:** DEPT-010
- **Name:** Assign Reporting Relationship
- **Goal:** Establish who an employee reports to for approval workflows
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Both employee and target manager are active
  - No circular reference would be created
- **Trigger:** User sets "Reports To" on employee profile

**Main Success Flow:**

1. User opens employee profile > Employment Details
2. User clicks "Reports To" field
3. System displays searchable list of active employees
4. User selects a manager
5. System validates no circular reference exists (BR-EMP-006)
6. System validates target is not self
7. System creates/updates ReportingRelationship record
8. Employee appears in manager's team view
9. Leave approvals route to new manager
10. System displays success message

**Alternative Flows:**

- **AF-1: Change existing manager** — Previous relationship ended, new one created
- **AF-2: Remove reporting relationship** — Employee becomes manager-less

**Failure Flows:**

- **FF-1: Circular reference** — "Cannot assign: would create circular reporting chain"
- **FF-2: Self-assignment** — "Employee cannot report to themselves"
- **FF-3: Inactive target** — "Selected manager is not active"

**Business Rules:** BR-EMP-006, BR-LEAVE-010
**Required Permissions:** reporting.write (Owner, HR Administrator)
**Data Created/Modified:** ReportingRelationship created/updated
**Notifications:** Notification to new manager: "[Name] now reports to you"
**Audit Events:** `reporting.assigned` — actor, employee, previous_manager, new_manager
**Security Considerations:**
- Graph cycle detection for full chain
- Affects leave approval routing immediately

**Acceptance Criteria:**
1. Reporting relationship can be established
2. Circular references detected and prevented
3. Leave approval routing updates immediately
4. Manager receives notification
5. Self-assignment prevented
6. Audit log records change

**Priority:** P0
**Related Use Cases:** EMP-011, DEPT-011

---


### DEPT-011: Remove/Reassign Manager

- **ID:** DEPT-011
- **Name:** Remove/Reassign Manager
- **Goal:** Handle scenarios where a manager is removed or leaves, ensuring direct reports have an approval path
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** System
- **Preconditions:**
  - Manager has direct reports
  - Manager is being deactivated, removed, or reassigned
- **Trigger:** Manager deactivation (EMP-013) or explicit manager removal

**Main Success Flow:**

1. System detects manager is being deactivated or removed
2. System identifies all direct reports of this manager
3. System flags direct reports as "manager-less"
4. System routes any pending leave approvals to HR (BR-CROSS-002)
5. System notifies HR: "[N] employees need manager reassignment"
6. HR navigates to the flagged employees
7. HR assigns new managers via DEPT-010
8. Flags are cleared as managers are assigned

**Alternative Flows:**

- **AF-1: Bulk reassign** — HR selects all affected employees and assigns same new manager
- **AF-2: Manager voluntarily changed** — Not a deactivation; just reporting line update via DEPT-010
- **AF-3: Temporary absence** — Manager on leave; leave approvals route to HR until return (LEAVE-018)

**Failure Flows:**

- **FF-1: No HR admin available** — Owner receives the notifications instead
- **FF-2: Reassignment to inactive employee** — Validation prevents it

**Business Rules:** BR-CROSS-002, BR-LEAVE-010
**Required Permissions:** reporting.write (Owner, HR Administrator)
**Data Created/Modified:** ReportingRelationship records updated, pending approvals rerouted
**Notifications:** HR notified of manager-less employees; affected employees notified of manager change
**Audit Events:** `reporting.manager_removed` — actor: system/HR, affected_employees: [list]
**Security Considerations:**
- Leave approvals must not be blocked; HR fallback is immediate
- Deactivation cascading handles this automatically

**Acceptance Criteria:**
1. Direct reports are flagged when manager is removed
2. Pending leave approvals route to HR immediately
3. HR is notified of employees needing reassignment
4. Bulk reassignment is supported
5. No approval workflows are blocked
6. Audit trail captures all changes

**Priority:** P0
**Related Use Cases:** EMP-013, DEPT-010, LEAVE-018

---

## Leave Module

---

### LEAVE-001: Create Leave Type

- **ID:** LEAVE-001
- **Name:** Create Leave Type
- **Goal:** HR Admin defines a new type of leave available in the organisation
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Leave Settings > Types and clicks "Add Leave Type"

**Main Success Flow:**

1. User clicks "Add Leave Type"
2. System displays form: name, colour code, requires approval (boolean), balance tracked (boolean), allows negative balance (boolean), requires document (boolean, with threshold days)
3. User enters leave type name (e.g., "Compassionate Leave")
4. User configures properties
5. System validates name uniqueness within organisation
6. System creates LeaveType record
7. System displays success message
8. Leave type available for policy assignment and employee requests

**Alternative Flows:**

- **AF-1: Non-balance-tracked type** — e.g., "Work From Home" — no balance deduction
- **AF-2: Document required after N days** — e.g., sick leave > 3 days requires medical cert

**Failure Flows:**

- **FF-1: Duplicate name** — Validation error
- **FF-2: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** leave.type.write (Owner, HR Administrator)
**Data Created/Modified:** LeaveType record created
**Notifications:** None
**Audit Events:** `leave_type.created` — actor, target, configuration
**Security Considerations:**
- Tenant-scoped
- Cannot delete types with existing requests (archive instead)

**Acceptance Criteria:**
1. Leave type created with unique name
2. Configurable approval, balance tracking, document requirements
3. Available for policy assignment immediately
4. Colour coding for calendar display
5. Audit log records creation

**Priority:** P0
**Related Use Cases:** LEAVE-002, LEAVE-005

---


### LEAVE-002: Configure Leave Policy

- **ID:** LEAVE-002
- **Name:** Configure Leave Policy
- **Goal:** Define entitlement rules for a leave type (days per year, accrual, carry-over)
- **Primary Actor:** Owner or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Leave type exists
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Leave Settings > Policies and creates/edits a policy

**Main Success Flow:**

1. User clicks "Create Policy" or edits existing
2. System displays form: leave type, annual entitlement (days), accrual method (annual/monthly/none), carry-over limit, pro-rata for mid-year joiners, applicability (all employees or by employment type)
3. User configures the policy
4. System validates entitlement is > 0 for balance-tracked types
5. System creates/updates LeavePolicy record
6. System displays success message
7. Policy applies to matching employees on next balance calculation

**Alternative Flows:**

- **AF-1: Multiple policies per type** — Different entitlements by employment type (e.g., full-time=20, part-time=12)
- **AF-2: Monthly accrual** — Balance accrues monthly (e.g., 1.67 days/month for 20 annual)

**Failure Flows:**

- **FF-1: No leave type selected** — Validation error
- **FF-2: Zero entitlement for tracked type** — Warning shown, allowed if intentional
- **FF-3: Permission denied** — 403

**Business Rules:** BR-LEAVE-003, BR-ORG-001
**Required Permissions:** leave.policy.write (Owner, HR Administrator)
**Data Created/Modified:** LeavePolicy record created/updated
**Notifications:** None
**Audit Events:** `leave_policy.configured` — actor, target, configuration details
**Security Considerations:**
- Policy changes affect future calculations, not retroactive
- Tenant-scoped

**Acceptance Criteria:**
1. Policy can be created linking leave type to entitlement
2. Accrual methods (annual, monthly) are supported
3. Carry-over limits can be configured
4. Pro-rata calculation for mid-year joiners
5. Multiple policies per leave type (by employment type)
6. Audit log records configuration

**Priority:** P0
**Related Use Cases:** LEAVE-001, LEAVE-003

---

### LEAVE-003: Assign Leave Allowance

- **ID:** LEAVE-003
- **Name:** Assign Leave Allowance
- **Goal:** Allocate leave balance to an employee based on policy or manual override
- **Primary Actor:** System (automatic) or HR Administrator (manual)
- **Supporting Actors:** None
- **Preconditions:**
  - Employee is active
  - Leave policy exists for the employee's employment type
- **Trigger:** Employee activation, leave year reset, or manual HR action

**Main Success Flow:**

1. System detects trigger (new active employee or leave year start)
2. System identifies applicable leave policies for the employee
3. System calculates entitlement (pro-rata if mid-year joiner)
4. System creates LeaveBalance records for each applicable leave type
5. System adds any carry-over from previous year (up to limit)
6. Balance is immediately available for the employee

**Alternative Flows:**

- **AF-1: Manual override** — HR manually sets a balance (e.g., contractual agreement)
- **AF-2: Mid-year joiner** — Pro-rata: (months remaining / 12) × annual entitlement
- **AF-3: Carry-over** — Previous year's unused balance carried (up to policy limit)

**Failure Flows:**

- **FF-1: No applicable policy** — Employee gets 0 balance; HR notified
- **FF-2: Employee inactive** — Balance not allocated

**Business Rules:** BR-LEAVE-003, BR-LEAVE-009
**Required Permissions:** leave.policy.write (for manual override)
**Data Created/Modified:** LeaveBalance records created/updated
**Notifications:** None (balance visible in self-service)
**Audit Events:** `leave_balance.allocated` — source: system/manual, employee, amounts by type
**Security Considerations:**
- Automatic allocation is system-triggered, not user-triggered
- Manual overrides require HR permission and are audited

**Acceptance Criteria:**
1. Balances auto-allocated when employee becomes active
2. Pro-rata calculation works for mid-year joiners
3. Carry-over respects policy limits
4. Manual override is available to HR
5. Balance immediately visible to employee
6. Audit records allocation source

**Priority:** P0
**Related Use Cases:** LEAVE-002, LEAVE-004, LEAVE-017

---


### LEAVE-004: View Leave Balance

- **ID:** LEAVE-004
- **Name:** View Leave Balance
- **Goal:** Employee views their available leave balance across all leave types
- **Primary Actor:** Employee (self), Manager (team), HR Admin (all)
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated
  - Employee has allocated leave balances
- **Trigger:** User navigates to Leave section or dashboard

**Main Success Flow:**

1. User navigates to Leave > My Balance (or team view for managers)
2. System retrieves leave balances for the relevant scope
3. System calculates: total entitlement, used, pending, available (entitlement - used - pending)
4. System displays balance per leave type with visual indicators
5. Balance reflects real-time state including pending requests (BR-LEAVE-009)

**Alternative Flows:**

- **AF-1: Manager views team** — Sees balances for all direct reports
- **AF-2: HR views all** — Organisation-wide balance report
- **AF-3: No balance allocated** — Shows 0 with message "No leave policy assigned"

**Failure Flows:**

- **FF-1: Permission denied for team view** — Employee attempting team view gets 403

**Business Rules:** BR-LEAVE-009, BR-PERM-005
**Required Permissions:** leave.balance.read.own (all), leave.balance.read.team (Manager), leave.balance.read.all (HR)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Balance calculation includes pending deductions
- Team/all views require appropriate permission
- Scoped to organisation

**Acceptance Criteria:**
1. Employee sees own balance per leave type
2. Balance shows entitlement, used, pending, available
3. Pending requests are reflected in available balance
4. Manager can view team balances
5. HR can view all balances
6. Real-time accuracy

**Priority:** P0
**Related Use Cases:** LEAVE-003, LEAVE-005

---

### LEAVE-005: Submit Leave Request

- **ID:** LEAVE-005
- **Name:** Submit Leave Request
- **Goal:** Employee submits a request for time off
- **Primary Actor:** Employee (any authenticated user submitting own leave)
- **Supporting Actors:** Manager (approver), System
- **Preconditions:**
  - Employee is active
  - Leave type exists and is available to employee
  - Sufficient balance (if balance-tracked)
- **Trigger:** Employee clicks "Request Leave" from leave section

**Main Success Flow:**

1. Employee clicks "Request Leave"
2. System displays form: leave type, start date, end date, half-day options, notes
3. Employee selects leave type and date range
4. System calculates working days (excluding weekends/holidays per BR-LEAVE-005)
5. System checks for overlapping requests (BR-LEAVE-001)
6. System checks sufficient balance (BR-LEAVE-002)
7. System determines approver (direct manager, or HR if no manager per BR-LEAVE-010)
8. System creates LeaveRequest with status "Pending"
9. System reserves balance (pending deduction per BR-LEAVE-009)
10. System sends notification to approver

**Alternative Flows:**

- **AF-1: Half-day request** — LEAVE-006 flow
- **AF-2: Non-balance-tracked type** — Skip balance check (step 6)
- **AF-3: No approval required** — Auto-approved; status set to "Approved" immediately
- **AF-4: Document required** — System flags that document upload is needed (LEAVE-007)

**Failure Flows:**

- **FF-1: Overlapping request** — "You already have leave during this period" (BR-LEAVE-001)
- **FF-2: Insufficient balance** — "Insufficient balance. Available: [N] days" (BR-LEAVE-002)
- **FF-3: Past dates** — "Cannot request leave for past dates" (HR override required)
- **FF-4: No approver found** — Routes to HR automatically (BR-LEAVE-010)

**Business Rules:** BR-LEAVE-001, BR-LEAVE-002, BR-LEAVE-005, BR-LEAVE-009, BR-LEAVE-010
**Required Permissions:** leave.request.create (all roles for own leave)
**Data Created/Modified:** LeaveRequest created (status: Pending), balance reserved
**Notifications:** Notification to approver: "[Name] has requested [N] days of [type]"
**Audit Events:** `leave_request.submitted` — actor: employee, target: request ID, days, type
**Security Considerations:**
- Employee can only submit own leave
- Balance check prevents over-use
- Overlap check prevents double-booking
- Organisation ID from session

**Acceptance Criteria:**
1. Employee can submit leave request with valid dates
2. Working days calculated correctly (excludes weekends/holidays)
3. Overlap detection prevents double-booking
4. Insufficient balance blocks submission
5. Approver receives notification
6. Pending balance is reserved
7. Request appears in employee's leave history

**Priority:** P0
**Related Use Cases:** LEAVE-004, LEAVE-006, LEAVE-008, LEAVE-009, LEAVE-011

---


### LEAVE-006: Request Half-Day Leave

- **ID:** LEAVE-006
- **Name:** Request Half-Day Leave
- **Goal:** Employee requests a half-day (morning or afternoon) off
- **Primary Actor:** Employee
- **Supporting Actors:** Manager (approver)
- **Preconditions:**
  - Leave type supports half-day requests
  - Employee has at least 0.5 day balance
- **Trigger:** Employee selects half-day option during leave request

**Main Success Flow:**

1. Employee initiates leave request (LEAVE-005 steps 1-2)
2. Employee checks "Half Day" option
3. Employee selects "Morning" or "Afternoon"
4. System calculates deduction as 0.5 working day (BR-LEAVE-011)
5. System validates 0.5 balance available
6. System checks no full-day overlap exists for same date
7. System creates LeaveRequest with halfDay flag and period indicator
8. System reserves 0.5 from balance
9. Notification sent to approver

**Alternative Flows:**

- **AF-1: Two half-days same date** — Allowed if morning + afternoon from different leave types
- **AF-2: Half-day combined with full days** — e.g., Mon-Wed full + Thu morning half

**Failure Flows:**

- **FF-1: Full-day leave already exists for date** — "Full day leave already booked for this date"
- **FF-2: Same-period half-day exists** — "Morning half-day already booked for this date"
- **FF-3: Balance < 0.5** — Insufficient balance error

**Business Rules:** BR-LEAVE-011, BR-LEAVE-001, BR-LEAVE-002
**Required Permissions:** leave.request.create
**Data Created/Modified:** LeaveRequest created with halfDay=true, period=morning/afternoon
**Notifications:** Notification to approver
**Audit Events:** `leave_request.submitted` — includes halfDay metadata
**Security Considerations:**
- Balance deduction must be exactly 0.5 (decimal-safe)
- Overlap check considers half-day periods

**Acceptance Criteria:**
1. Half-day leave deducts 0.5 from balance
2. Morning/afternoon selection is required
3. Cannot overlap with existing full-day or same-period half-day
4. Two different half-days on same date allowed
5. Approval flow same as full-day requests

**Priority:** P1
**Related Use Cases:** LEAVE-005, LEAVE-011

---

### LEAVE-007: Attach Document to Leave Request

- **ID:** LEAVE-007
- **Name:** Attach Document to Leave Request
- **Goal:** Employee uploads supporting documentation for a leave request
- **Primary Actor:** Employee
- **Supporting Actors:** None
- **Preconditions:**
  - Leave request exists (or is being created)
  - Leave type may require documentation
- **Trigger:** Employee attaches file during or after leave request submission

**Main Success Flow:**

1. During leave request (or editing pending request), employee clicks "Attach Document"
2. System displays file upload interface
3. Employee selects file (PDF, JPG, PNG — max 5MB)
4. System validates file type and size
5. System uploads file to tenant-scoped storage
6. System links document to the leave request
7. Document visible to approver during review
8. System displays success

**Alternative Flows:**

- **AF-1: Required document** — System blocks submission until document attached (if leave type requires it above threshold)
- **AF-2: Add document after submission** — Employee can add document to pending request
- **AF-3: Multiple documents** — Up to 3 attachments per request

**Failure Flows:**

- **FF-1: Invalid file type** — "Only PDF, JPG, and PNG files are accepted"
- **FF-2: File too large** — "Maximum file size is 5MB"
- **FF-3: Upload failure** — "Upload failed. Please try again."

**Business Rules:** BR-DOC-001, BR-DOC-002, BR-DOC-003
**Required Permissions:** leave.request.create (own)
**Data Created/Modified:** File stored, LeaveRequestDocument link created
**Notifications:** None
**Audit Events:** `leave_request.document_attached` — actor, request_id, file_name
**Security Considerations:**
- File type validation via magic bytes
- Tenant-scoped storage path
- Max 3 files, 5MB each
- Virus scanning if configured

**Acceptance Criteria:**
1. Documents can be attached during or after submission
2. File type and size validated
3. Document visible to approver
4. Required documents block submission when configured
5. Maximum 3 attachments enforced

**Priority:** P2
**Related Use Cases:** LEAVE-005, LEAVE-011

---


### LEAVE-008: Detect Overlapping Leave

- **ID:** LEAVE-008
- **Name:** Detect Overlapping Leave
- **Goal:** System prevents submission of leave that overlaps with existing approved or pending leave
- **Primary Actor:** System
- **Supporting Actors:** Employee (informed of conflict)
- **Preconditions:**
  - Employee has existing approved or pending leave requests
- **Trigger:** Employee submits a new leave request with dates overlapping existing

**Main Success Flow:**

1. Employee submits leave request with date range
2. System queries existing requests (Pending or Approved) for this employee
3. System detects date overlap between new request and existing
4. System blocks submission
5. System displays: "Conflict: You have [type] leave from [date] to [date]"
6. Employee adjusts dates and resubmits

**Alternative Flows:**

- **AF-1: Partial overlap** — Only overlapping dates are flagged; system suggests non-conflicting range
- **AF-2: Half-day no conflict** — Existing morning half-day, new afternoon half-day on same date = allowed
- **AF-3: Cancelled leave** — Cancelled requests do not count as conflicts

**Failure Flows:**

- **FF-1: Race condition** — Two requests submitted simultaneously; database constraint catches second

**Business Rules:** BR-LEAVE-001
**Required Permissions:** leave.request.create
**Data Created/Modified:** None (validation only)
**Notifications:** None
**Audit Events:** None (validation, not an action)
**Security Considerations:**
- Check runs server-side regardless of client validation
- Database-level constraint as fallback

**Acceptance Criteria:**
1. Overlapping full-day requests are blocked
2. Partial overlaps are detected
3. Half-day non-conflicts are allowed
4. Cancelled requests do not block
5. Clear error message identifies the conflicting request
6. Race conditions handled by DB constraint

**Priority:** P0
**Related Use Cases:** LEAVE-005, LEAVE-006

---

### LEAVE-009: Detect Insufficient Balance

- **ID:** LEAVE-009
- **Name:** Detect Insufficient Balance
- **Goal:** System prevents leave submission when balance is insufficient
- **Primary Actor:** System
- **Supporting Actors:** Employee (informed)
- **Preconditions:**
  - Leave type tracks balance
  - Employee's available balance < requested days
- **Trigger:** Employee submits leave request exceeding available balance

**Main Success Flow:**

1. Employee submits leave request for N working days
2. System calculates available balance (entitlement - used - pending)
3. System detects available < requested
4. System blocks submission
5. System displays: "Insufficient balance. Available: [X] days, Requested: [N] days"
6. Employee reduces request or selects different leave type

**Alternative Flows:**

- **AF-1: Negative balance allowed** — If leave type allows negative, request proceeds with warning
- **AF-2: Non-tracked leave** — Balance check skipped entirely
- **AF-3: HR override** — HR can submit on behalf with override flag (LEAVE-015)

**Failure Flows:**

- **FF-1: Balance calculation error** — System fails safe (blocks request); logs error

**Business Rules:** BR-LEAVE-002, BR-LEAVE-009
**Required Permissions:** leave.request.create
**Data Created/Modified:** None (validation only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Balance includes pending reservations to prevent overbooking
- Server-side enforcement regardless of client display

**Acceptance Criteria:**
1. Requests exceeding balance are blocked
2. Available balance shown (including pending deductions)
3. Negative-balance types bypass this check
4. Non-tracked types bypass this check
5. Clear message shows available vs requested

**Priority:** P0
**Related Use Cases:** LEAVE-005, LEAVE-004

---


### LEAVE-010: Review Leave Request

- **ID:** LEAVE-010
- **Name:** Review Leave Request
- **Goal:** Manager or HR reviews a pending leave request before making a decision
- **Primary Actor:** Manager or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Leave request exists in Pending status
  - User is the assigned approver or HR
- **Trigger:** Approver clicks on a pending leave notification or navigates to approvals queue

**Main Success Flow:**

1. Approver navigates to pending approvals list
2. System displays pending requests for their direct reports (or all, for HR)
3. Approver selects a request to review
4. System displays: employee name, leave type, dates, working days, notes, attached documents, team calendar for conflict awareness
5. Approver reviews team calendar to check coverage
6. Approver makes decision (approve or reject — see LEAVE-011, LEAVE-012)

**Alternative Flows:**

- **AF-1: HR reviewing** — Sees all pending requests organisation-wide
- **AF-2: Team calendar overlay** — Shows who else is off during same period

**Failure Flows:**

- **FF-1: Request already actioned** — "This request has already been [approved/rejected]"
- **FF-2: Permission denied** — Manager viewing non-report's request: 403

**Business Rules:** BR-LEAVE-004
**Required Permissions:** leave.request.approve (Manager: scoped; HR: all)
**Data Created/Modified:** None (read-only review)
**Notifications:** None
**Audit Events:** None (viewing is not audited)
**Security Considerations:**
- Manager can only see requests from direct reports
- HR sees all within organisation
- Team calendar shows only basic info (no personal details)

**Acceptance Criteria:**
1. Approver sees all pending requests for their scope
2. Request details include dates, type, days, notes, documents
3. Team calendar overlay shows potential conflicts
4. Already-actioned requests show appropriate message
5. Non-reports are hidden from manager view

**Priority:** P0
**Related Use Cases:** LEAVE-005, LEAVE-011, LEAVE-012

---

### LEAVE-011: Approve Leave Request

- **ID:** LEAVE-011
- **Name:** Approve Leave Request
- **Goal:** Approver grants a leave request, confirming the employee may take time off
- **Primary Actor:** Manager (for direct reports) or HR Administrator
- **Supporting Actors:** System
- **Preconditions:**
  - Leave request is in Pending status
  - User is assigned approver or HR
- **Trigger:** Approver clicks "Approve" on a pending request

**Main Success Flow:**

1. Approver reviews request (LEAVE-010)
2. Approver clicks "Approve"
3. System validates request is still Pending (optimistic lock)
4. System validates approver has permission for this employee (BR-LEAVE-004)
5. System updates LeaveRequest.status to "Approved"
6. System confirms balance deduction (pending → confirmed per BR-LEAVE-003)
7. System records approver and timestamp
8. System sends notification to employee: "Your [type] leave has been approved"
9. Leave appears on team calendar
10. System logs audit event

**Alternative Flows:**

- **AF-1: HR approving non-report** — Allowed via override permission
- **AF-2: Self-approval prevention** — Cannot approve own request

**Failure Flows:**

- **FF-1: Request no longer pending** — "This request has already been actioned"
- **FF-2: Concurrent approval** — Optimistic lock prevents duplicate (BR-DATA-004)
- **FF-3: Self-approval** — "Cannot approve your own leave request"

**Business Rules:** BR-LEAVE-003, BR-LEAVE-004, BR-DATA-004
**Required Permissions:** leave.request.approve (Manager: scoped; HR/Owner: all)
**Data Created/Modified:** LeaveRequest.status → Approved, balance confirmed
**Notifications:** Employee notified of approval
**Audit Events:** `leave_request.approved` — actor: approver, target: request, employee
**Security Considerations:**
- Self-approval prevented
- Optimistic locking prevents race conditions
- Only scoped approvers can approve

**Acceptance Criteria:**
1. Approved request changes status
2. Balance deduction is confirmed
3. Employee receives notification
4. Leave shows on team calendar
5. Self-approval is prevented
6. Concurrent approvals handled gracefully
7. Audit log records approver

**Priority:** P0
**Related Use Cases:** LEAVE-010, LEAVE-012, LEAVE-013

---


### LEAVE-012: Reject Leave Request

- **ID:** LEAVE-012
- **Name:** Reject Leave Request
- **Goal:** Approver denies a leave request with a mandatory reason
- **Primary Actor:** Manager or HR Administrator
- **Supporting Actors:** None
- **Preconditions:**
  - Leave request is in Pending status
  - User is assigned approver or HR
- **Trigger:** Approver clicks "Reject" on a pending request

**Main Success Flow:**

1. Approver reviews request (LEAVE-010)
2. Approver clicks "Reject"
3. System prompts for rejection reason (mandatory)
4. Approver enters reason
5. System validates reason is non-empty
6. System updates LeaveRequest.status to "Rejected"
7. System releases reserved balance (pending → available)
8. System records rejector, reason, and timestamp
9. System sends notification to employee with reason
10. System logs audit event

**Alternative Flows:**

- **AF-1: HR rejecting any request** — Allowed via override permission

**Failure Flows:**

- **FF-1: Empty reason** — "A reason is required when rejecting leave"
- **FF-2: Request no longer pending** — "This request has already been actioned"
- **FF-3: Self-rejection** — Prevented (use Cancel instead)

**Business Rules:** BR-LEAVE-004, BR-LEAVE-009
**Required Permissions:** leave.request.reject (Manager: scoped; HR/Owner: all)
**Data Created/Modified:** LeaveRequest.status → Rejected, balance released
**Notifications:** Employee notified with rejection reason
**Audit Events:** `leave_request.rejected` — actor, target, reason
**Security Considerations:**
- Reason is mandatory (accountability)
- Balance must be released to prevent stuck deductions

**Acceptance Criteria:**
1. Rejection requires a reason
2. Balance is released (available increases)
3. Employee receives notification with reason
4. Request status changes to Rejected
5. Audit log captures rejection with reason

**Priority:** P0
**Related Use Cases:** LEAVE-010, LEAVE-011, LEAVE-015

---

### LEAVE-013: Cancel Approved Leave

- **ID:** LEAVE-013
- **Name:** Cancel Approved Leave
- **Goal:** Employee or HR cancels an approved leave request before it starts
- **Primary Actor:** Employee (own) or HR Administrator
- **Supporting Actors:** System
- **Preconditions:**
  - Leave request is in Approved status
  - Leave start date is in the future (for employee cancellation)
- **Trigger:** Employee clicks "Cancel" on an approved future leave request

**Main Success Flow:**

1. Employee navigates to their leave history
2. Employee selects an approved request with future start date
3. Employee clicks "Cancel"
4. System validates leave has not yet started (start_date > today) per BR-LEAVE-007
5. System prompts for optional cancellation reason
6. System updates LeaveRequest.status to "Cancelled"
7. System restores balance (BR-LEAVE-006)
8. System notifies original approver of cancellation
9. Leave removed from team calendar

**Alternative Flows:**

- **AF-1: HR cancelling past/current leave** — HR can cancel regardless of date (BR-LEAVE-008)
- **AF-2: Partial cancellation** — V2 feature; V1 is all-or-nothing

**Failure Flows:**

- **FF-1: Leave already started** — Employee: "Cannot cancel leave that has already started. Contact HR."
- **FF-2: Leave already past** — Same as above (BR-LEAVE-007)
- **FF-3: Already cancelled** — "This request is already cancelled"

**Business Rules:** BR-LEAVE-006, BR-LEAVE-007, BR-LEAVE-008
**Required Permissions:** leave.request.create (own future), leave.request.override (HR: any)
**Data Created/Modified:** LeaveRequest.status → Cancelled, balance restored
**Notifications:** Approver notified of cancellation
**Audit Events:** `leave_request.cancelled` — actor, target, reason
**Security Considerations:**
- Date check prevents retroactive manipulation
- HR override for exceptional cases
- Balance restoration must be atomic with status change

**Acceptance Criteria:**
1. Employee can cancel future approved leave
2. Balance is restored on cancellation
3. Cannot cancel leave that has started (employee)
4. HR can cancel any leave regardless of date
5. Approver is notified
6. Calendar updated immediately

**Priority:** P0
**Related Use Cases:** LEAVE-011, LEAVE-014, LEAVE-015

---


### LEAVE-014: Withdraw Pending Request

- **ID:** LEAVE-014
- **Name:** Withdraw Pending Request
- **Goal:** Employee withdraws a leave request that has not yet been actioned
- **Primary Actor:** Employee
- **Supporting Actors:** None
- **Preconditions:**
  - Leave request is in Pending status
- **Trigger:** Employee clicks "Withdraw" on a pending request

**Main Success Flow:**

1. Employee navigates to leave history
2. Employee selects a Pending request
3. Employee clicks "Withdraw"
4. System validates request is still Pending
5. System updates status to "Withdrawn"
6. System releases reserved balance
7. System notifies approver that request was withdrawn
8. System displays success message

**Alternative Flows:**

- **AF-1: Approver acts first** — If approved/rejected between click and submit, show "already actioned"

**Failure Flows:**

- **FF-1: No longer pending** — "This request has already been [approved/rejected]"

**Business Rules:** BR-LEAVE-009
**Required Permissions:** leave.request.create (own)
**Data Created/Modified:** LeaveRequest.status → Withdrawn, balance released
**Notifications:** Approver notified
**Audit Events:** `leave_request.withdrawn` — actor: employee
**Security Considerations:**
- Only own pending requests can be withdrawn
- Race condition handled by status check

**Acceptance Criteria:**
1. Employee can withdraw own pending requests
2. Balance is released
3. Approver is notified
4. Already-actioned requests cannot be withdrawn
5. Status changes to Withdrawn

**Priority:** P1
**Related Use Cases:** LEAVE-005, LEAVE-011

---

### LEAVE-015: HR Override Leave Decision

- **ID:** LEAVE-015
- **Name:** HR Override Leave Decision
- **Goal:** HR Administrator overrides a previous leave decision or bypasses normal constraints
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Leave request exists in any actionable state
  - User is authenticated as Owner or HR Administrator
- **Trigger:** HR clicks "Override" on a leave request

**Main Success Flow:**

1. HR navigates to a leave request (any status except Withdrawn)
2. HR clicks "Override"
3. System displays override options: Approve (if rejected/pending), Cancel (if approved), Force-approve (bypass balance)
4. HR selects action and provides mandatory reason
5. System validates reason is non-empty
6. System executes override action
7. System adjusts balance accordingly
8. System sends notification to employee
9. System creates high-severity audit event

**Alternative Flows:**

- **AF-1: Approve rejected request** — Balance deducted, status → Approved
- **AF-2: Cancel approved request** — Balance restored, status → Cancelled
- **AF-3: Force-approve beyond balance** — Allows negative balance (with flag)
- **AF-4: Cancel past leave** — HR-only action (BR-LEAVE-007)

**Failure Flows:**

- **FF-1: No reason provided** — "Override reason is required"
- **FF-2: Permission denied** — Only Owner/HR Admin can override

**Business Rules:** BR-LEAVE-008, BR-LEAVE-007
**Required Permissions:** leave.request.override (Owner, HR Administrator)
**Data Created/Modified:** LeaveRequest status updated, balance adjusted, override flag set
**Notifications:** Employee notified of override decision
**Audit Events:** `leave_request.overridden` — actor: HR, target, action, reason (high severity)
**Security Considerations:**
- Override creates distinct audit event type for compliance
- Reason is mandatory and stored permanently
- Only highest-privilege roles can override

**Acceptance Criteria:**
1. HR can approve previously rejected requests
2. HR can cancel approved/past leave
3. HR can force-approve beyond balance limits
4. Override reason is mandatory
5. High-severity audit event created
6. Employee is notified of any override

**Priority:** P1
**Related Use Cases:** LEAVE-011, LEAVE-012, LEAVE-013

---


### LEAVE-016: View Team Calendar

- **ID:** LEAVE-016
- **Name:** View Team Calendar
- **Goal:** Manager or HR views a calendar showing team/org leave for planning
- **Primary Actor:** Manager (team) or HR Administrator (all)
- **Supporting Actors:** None
- **Preconditions:**
  - User has team or all-org leave calendar permission
- **Trigger:** User navigates to Leave > Calendar

**Main Success Flow:**

1. User navigates to Leave Calendar
2. System determines scope (Manager: direct reports; HR: all)
3. System loads approved and pending leave for the visible date range
4. System renders calendar with colour-coded leave types
5. User can navigate between months
6. Each entry shows: employee name, leave type, dates
7. User can click an entry to view request details

**Alternative Flows:**

- **AF-1: Filter by department** — HR can filter calendar by department
- **AF-2: Filter by leave type** — Show only specific leave types
- **AF-3: Export calendar** — Download as PDF/CSV for planning

**Failure Flows:**

- **FF-1: No leave in period** — Empty calendar state
- **FF-2: Permission denied** — Employee role cannot view team calendar

**Business Rules:** BR-LEAVE-004
**Required Permissions:** leave.calendar.read.team (Manager), leave.calendar.read.all (HR/Owner)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Manager sees only direct reports
- No sensitive details on calendar (just name, type, dates)
- Scoped to organisation

**Acceptance Criteria:**
1. Manager sees direct reports' leave
2. HR sees organisation-wide leave
3. Colour-coded by leave type
4. Monthly navigation works
5. Department filtering available for HR
6. Click through to request details

**Priority:** P1
**Related Use Cases:** LEAVE-010, LEAVE-011

---

### LEAVE-017: Recalculate Leave Balance

- **ID:** LEAVE-017
- **Name:** Recalculate Leave Balance
- **Goal:** System recalculates leave balances after policy changes, carry-over, or corrections
- **Primary Actor:** System (automated) or HR Administrator (triggered)
- **Supporting Actors:** None
- **Preconditions:**
  - A trigger event occurs (policy change, year rollover, HR action)
- **Trigger:** Leave year start, policy modification, or manual HR trigger

**Main Success Flow:**

1. Trigger event occurs (e.g., leave year rolls over)
2. System identifies affected employees
3. For each employee, system:
   a. Calculates new entitlement from policy
   b. Determines carry-over from previous year (up to limit)
   c. Accounts for already-used days in current period
   d. Sets new available balance
4. System updates LeaveBalance records
5. System logs recalculation event
6. Updated balances visible to employees immediately

**Alternative Flows:**

- **AF-1: Manual trigger** — HR triggers recalculation for specific employee or all
- **AF-2: Policy change** — Recalculates affected employees only
- **AF-3: Mid-year holiday addition** — Recalculates pending leave that spans new holiday

**Failure Flows:**

- **FF-1: Calculation results in negative** — Flags for HR review (doesn't auto-correct)
- **FF-2: Missing policy** — Employee gets 0; HR notified

**Business Rules:** BR-LEAVE-003, BR-LEAVE-005, BR-CROSS-005
**Required Permissions:** leave.policy.write (for manual trigger)
**Data Created/Modified:** LeaveBalance records updated
**Notifications:** HR notified of anomalies (negative balances)
**Audit Events:** `leave_balance.recalculated` — trigger, affected_count, source
**Security Considerations:**
- Automated job runs with system context
- Cannot reduce balance below used amount without HR flag
- Idempotent recalculation

**Acceptance Criteria:**
1. Annual rollover recalculates all balances
2. Carry-over respects policy limits
3. Policy changes trigger recalculation
4. Negative results flagged for HR review
5. Already-used days preserved
6. Audit log records recalculation

**Priority:** P1
**Related Use Cases:** LEAVE-003, LEAVE-020

---


### LEAVE-018: Handle Manager Absence

- **ID:** LEAVE-018
- **Name:** Handle Manager Absence
- **Goal:** System ensures leave approvals are not blocked when the designated manager is unavailable
- **Primary Actor:** System
- **Supporting Actors:** HR Administrator
- **Preconditions:**
  - Employee's manager is on leave or deactivated
  - Employee submits a leave request
- **Trigger:** Leave request submitted when manager is unavailable

**Main Success Flow:**

1. Employee submits leave request
2. System identifies designated approver (direct manager)
3. System detects manager is currently on approved leave or deactivated
4. System escalates approval to HR Administrator (BR-LEAVE-010)
5. HR receives notification: "Leave request from [Employee] escalated — manager [Name] unavailable"
6. HR reviews and approves/rejects
7. Normal flow continues

**Alternative Flows:**

- **AF-1: Manager deactivated** — Permanent routing to HR until new manager assigned (DEPT-011)
- **AF-2: Manager returns before action** — HR can still action, or manager can on return
- **AF-3: No HR admin exists** — Routes to Owner

**Failure Flows:**

- **FF-1: No approver found** — Routes to Owner as last resort; system logs warning

**Business Rules:** BR-LEAVE-010, BR-CROSS-002
**Required Permissions:** leave.request.approve (HR/Owner as fallback)
**Data Created/Modified:** LeaveRequest.escalatedTo = HR, escalation_reason noted
**Notifications:** HR notified of escalated request
**Audit Events:** `leave_request.escalated` — reason: manager_unavailable, escalated_to: HR
**Security Considerations:**
- Approval authority is determined at request time
- Escalation is logged for transparency
- Employee's request is never blocked permanently

**Acceptance Criteria:**
1. Requests are never stuck without an approver
2. Manager absence causes automatic escalation to HR
3. HR receives clear notification explaining escalation
4. Escalation reason is recorded
5. Owner is ultimate fallback

**Priority:** P1
**Related Use Cases:** DEPT-011, LEAVE-005, LEAVE-019

---

### LEAVE-019: Handle No Manager Assigned

- **ID:** LEAVE-019
- **Name:** Handle No Manager Assigned
- **Goal:** System handles leave requests from employees who have no manager assigned
- **Primary Actor:** System
- **Supporting Actors:** HR Administrator
- **Preconditions:**
  - Employee has no reporting relationship (managerId is null)
  - Employee submits leave request
- **Trigger:** Leave request submitted by manager-less employee

**Main Success Flow:**

1. Employee submits leave request
2. System attempts to resolve approver via reporting relationship
3. System finds no manager assigned
4. System routes request directly to HR Administrator (BR-LEAVE-010)
5. HR receives notification
6. HR reviews and actions request
7. Normal flow continues

**Alternative Flows:**

- **AF-1: Multiple HR admins** — All HR admins notified; first to action completes it
- **AF-2: Owner is the employee** — Auto-approved or routed to HR admin

**Failure Flows:**

- **FF-1: No HR admin exists** — Routes to Owner
- **FF-2: No Owner or HR** — Should not occur (org must have Owner)

**Business Rules:** BR-LEAVE-010
**Required Permissions:** leave.request.approve (HR/Owner)
**Data Created/Modified:** LeaveRequest created with approver = HR
**Notifications:** HR notified of request requiring action
**Audit Events:** `leave_request.submitted` — includes no_manager_flag
**Security Considerations:**
- All employees must have an approval path
- System never creates orphaned requests

**Acceptance Criteria:**
1. Manager-less employees can still submit leave
2. Requests route directly to HR
3. HR is clearly notified
4. No requests are left without an approver
5. Works correctly with multiple HR admins

**Priority:** P0
**Related Use Cases:** LEAVE-018, LEAVE-005

---

### LEAVE-020: Handle Weekends and Holidays

- **ID:** LEAVE-020
- **Name:** Handle Weekends and Holidays
- **Goal:** System correctly excludes non-working days from leave duration calculations
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Organisation has configured working days (ORG-005)
  - Public holidays are configured (if any)
- **Trigger:** Leave request submitted or leave balance calculated

**Main Success Flow:**

1. Employee requests leave from Monday to Friday (5 calendar days)
2. System loads organisation working days configuration
3. System loads public holidays for the date range
4. System identifies non-working days (weekends per org config + holidays)
5. System calculates working days = calendar days - non-working days
6. System displays: "5 calendar days = 3 working days (excludes 1 weekend day + 1 holiday)"
7. Balance deduction uses working days figure

**Alternative Flows:**

- **AF-1: Non-standard work week** — Sun-Thu org: Friday/Saturday are weekends
- **AF-2: Holiday added after request** — Pending requests recalculated (LEAVE-017)
- **AF-3: Half-day on holiday** — Not counted; deduction = 0 for that day

**Failure Flows:**

- **FF-1: All days are non-working** — "Selected dates are all non-working days. No leave needed."
- **FF-2: No working days configured** — Should not occur (validation at org level)

**Business Rules:** BR-LEAVE-005, BR-CROSS-005
**Required Permissions:** None (system calculation)
**Data Created/Modified:** None (calculation logic)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Calculation must be consistent across all entry points
- Display clearly shows breakdown to employee
- Server-side calculation (client preview is advisory only)

**Acceptance Criteria:**
1. Weekends are excluded from working day count
2. Public holidays are excluded
3. Non-standard work weeks are supported
4. Clear breakdown shown to employee
5. Adding holidays recalculates pending requests
6. All-non-working-day ranges show appropriate message

**Priority:** P0
**Related Use Cases:** ORG-005, LEAVE-005, LEAVE-017

---

## Attendance Module

---

### ATT-001: Clock In

- **ID:** ATT-001
- **Name:** Clock In
- **Goal:** Employee records their start of work for the day
- **Primary Actor:** Employee (any authenticated user)
- **Supporting Actors:** System
- **Preconditions:**
  - Employee is active
  - No open attendance session exists (BR-ATT-001)
- **Trigger:** Employee clicks "Clock In" button

**Main Success Flow:**

1. Employee clicks "Clock In" on dashboard or attendance page
2. System validates no open session exists for this employee (BR-ATT-001)
3. System validates employee is active
4. System records clock-in timestamp in UTC
5. System creates AttendanceSession record (status: open, clockIn: now)
6. System displays confirmation: "Clocked in at [time in org timezone]"
7. Dashboard updates to show "Currently Working" state

**Alternative Flows:**

- **AF-1: Remote clock-in** — Employee selects "Remote" location type (ATT-008)
- **AF-2: Late clock-in** — System records actual time; no penalty logic in V1

**Failure Flows:**

- **FF-1: Already clocked in** — "You are already clocked in. Clock out first." (BR-ATT-001)
- **FF-2: On approved full-day leave** — "Cannot clock in: you have approved leave today" (BR-ATT-008)
- **FF-3: Employee deactivated** — 403

**Business Rules:** BR-ATT-001, BR-ATT-002, BR-ATT-008, BR-ATT-009
**Required Permissions:** attendance.clock (all roles)
**Data Created/Modified:** AttendanceSession created (status: open)
**Notifications:** None
**Audit Events:** None (routine operational action)
**Security Considerations:**
- Timestamp from server, never client-supplied
- UTC storage, org timezone display
- One open session per employee enforced

**Acceptance Criteria:**
1. Employee can clock in successfully
2. Duplicate clock-in is prevented
3. Clock-in blocked on full-day leave days
4. Timestamp recorded in UTC
5. Displayed in organisation timezone
6. Dashboard reflects clocked-in state

**Priority:** P0
**Related Use Cases:** ATT-002, ATT-003, ATT-010

---


### ATT-002: Clock Out

- **ID:** ATT-002
- **Name:** Clock Out
- **Goal:** Employee records their end of work for the day
- **Primary Actor:** Employee
- **Supporting Actors:** System
- **Preconditions:**
  - Employee has an open attendance session (BR-ATT-006)
- **Trigger:** Employee clicks "Clock Out"

**Main Success Flow:**

1. Employee clicks "Clock Out"
2. System validates an open session exists (BR-ATT-006)
3. System records clock-out timestamp in UTC
4. System calculates duration (clock-out - clock-in) per BR-ATT-009
5. System closes the AttendanceSession (status: closed)
6. System displays: "Clocked out at [time]. Duration: [hours]"
7. Dashboard updates to show "Not Working" state

**Alternative Flows:**

- **AF-1: Very short session** — Duration < 1 minute: system asks confirmation (mis-click prevention)

**Failure Flows:**

- **FF-1: No open session** — "You are not currently clocked in" (BR-ATT-006)
- **FF-2: Session already closed** — Same as above

**Business Rules:** BR-ATT-006, BR-ATT-002, BR-ATT-009
**Required Permissions:** attendance.clock (all roles)
**Data Created/Modified:** AttendanceSession updated (clockOut set, duration calculated, status: closed)
**Notifications:** None
**Audit Events:** None (routine)
**Security Considerations:**
- Timestamp from server only
- Duration auto-calculated, not user-supplied

**Acceptance Criteria:**
1. Employee can clock out from open session
2. Duration auto-calculated
3. Cannot clock out without open session
4. Very short sessions prompt confirmation
5. Dashboard reflects clocked-out state

**Priority:** P0
**Related Use Cases:** ATT-001, ATT-003, ATT-009

---

### ATT-003: View Current Attendance State

- **ID:** ATT-003
- **Name:** View Current Attendance State
- **Goal:** Employee sees whether they are currently clocked in or out
- **Primary Actor:** Employee
- **Supporting Actors:** None
- **Preconditions:**
  - Employee is active and authenticated
- **Trigger:** Employee views dashboard or attendance page

**Main Success Flow:**

1. Employee views dashboard
2. System checks for open attendance session
3. If clocked in: displays "Working since [time]" with elapsed duration
4. If not clocked in: displays "Not clocked in" with Clock In button
5. Shows today's total hours worked (sum of closed sessions)

**Alternative Flows:**

- **AF-1: Multiple sessions today** — Shows cumulative time
- **AF-2: Manager viewing team** — Shows team status (who's in/out)

**Failure Flows:**

- **FF-1: No attendance records** — "No attendance recorded today"

**Business Rules:** BR-PERM-005
**Required Permissions:** attendance.read.own (own), attendance.read.team (manager)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Own state only; team state requires manager permission

**Acceptance Criteria:**
1. Current state clearly displayed (in/out)
2. Elapsed time shown when clocked in
3. Today's total hours shown
4. Manager can see team status
5. Real-time updates

**Priority:** P0
**Related Use Cases:** ATT-001, ATT-002, ATT-004

---

### ATT-004: View Attendance History

- **ID:** ATT-004
- **Name:** View Attendance History
- **Goal:** User views past attendance records for a date range
- **Primary Actor:** Employee (own), Manager (team), HR (all)
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated with appropriate scope
- **Trigger:** User navigates to Attendance > History

**Main Success Flow:**

1. User navigates to Attendance History
2. System displays records for default range (current month)
3. Each record shows: date, clock-in time, clock-out time, duration, type (office/remote), status
4. User can change date range filter
5. Records paginated for large datasets
6. Status badges show: completed, missing-clock-out, corrected

**Alternative Flows:**

- **AF-1: Manager views team** — Sees all direct reports' attendance
- **AF-2: HR views all** — Organisation-wide attendance records
- **AF-3: Filter by status** — Show only missing clock-outs or corrections

**Failure Flows:**

- **FF-1: No records for period** — "No attendance records for selected period"

**Business Rules:** BR-PERM-005, BR-ATT-002
**Required Permissions:** attendance.read.own / attendance.read.team / attendance.read.all
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Scoped to appropriate permission level
- Times displayed in org timezone

**Acceptance Criteria:**
1. Employee sees own history
2. Manager sees team history
3. HR sees all history
4. Date range filter works
5. Status badges clearly indicate issues
6. Times in org timezone

**Priority:** P0
**Related Use Cases:** ATT-003, ATT-005

---


### ATT-005: View Monthly Summary

- **ID:** ATT-005
- **Name:** View Monthly Summary
- **Goal:** User views aggregated attendance statistics for a month
- **Primary Actor:** Employee (own), Manager (team), HR (all)
- **Supporting Actors:** None
- **Preconditions:**
  - Attendance records exist for the period
- **Trigger:** User navigates to Attendance > Summary

**Main Success Flow:**

1. User navigates to monthly summary view
2. System aggregates attendance for selected month
3. System displays: total days worked, total hours, average daily hours, days with missing clock-outs, days with corrections, late arrivals count
4. User can select different months
5. Comparison with expected working days shown

**Alternative Flows:**

- **AF-1: Manager views team summary** — Aggregated stats per team member
- **AF-2: HR export** — Download summary as CSV

**Failure Flows:**

- **FF-1: No data** — "No attendance data for this month"

**Business Rules:** BR-ATT-002
**Required Permissions:** attendance.read.own / attendance.read.team / attendance.read.all
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Same scope restrictions as history
- Calculations performed server-side

**Acceptance Criteria:**
1. Monthly totals calculated correctly
2. Expected vs actual working days shown
3. Missing clock-outs flagged
4. Manager sees per-team-member breakdown
5. Month selection works

**Priority:** P1
**Related Use Cases:** ATT-004, ATT-014

---

### ATT-006: Correct Attendance Record

- **ID:** ATT-006
- **Name:** Correct Attendance Record
- **Goal:** HR corrects an incorrect attendance record (wrong time, missing entry)
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Attendance record exists
  - User is authenticated as Owner or HR Administrator
  - Record is within correction window (30 days)
- **Trigger:** HR clicks "Correct" on an attendance record

**Main Success Flow:**

1. HR navigates to an attendance record
2. HR clicks "Correct"
3. System displays correction form: original clock-in, original clock-out, new clock-in, new clock-out
4. HR enters corrected times
5. HR enters mandatory reason (BR-ATT-003)
6. System validates new times are logical (out > in)
7. System preserves original record and creates correction record
8. System recalculates duration
9. System notifies affected employee
10. System creates audit event

**Alternative Flows:**

- **AF-1: Correct only clock-in** — Clock-out remains unchanged
- **AF-2: Correct only clock-out** — Clock-in remains unchanged

**Failure Flows:**

- **FF-1: No reason provided** — "Correction reason is required" (BR-ATT-003)
- **FF-2: Clock-out before clock-in** — "Clock-out must be after clock-in"
- **FF-3: Outside correction window** — "Record is outside the 30-day correction window"
- **FF-4: Permission denied** — Employee/Manager cannot correct

**Business Rules:** BR-ATT-003, BR-ATT-004
**Required Permissions:** attendance.correct (Owner, HR Administrator)
**Data Created/Modified:** Original preserved, correction record created, duration recalculated
**Notifications:** Employee notified: "Your attendance on [date] has been corrected"
**Audit Events:** `attendance.corrected` — actor: HR, target, original_values, new_values, reason
**Security Considerations:**
- Only HR can correct (BR-ATT-004)
- Original record preserved (never overwritten)
- Reason mandatory for accountability
- 30-day window limits retroactive changes

**Acceptance Criteria:**
1. HR can correct clock-in and/or clock-out times
2. Reason is mandatory
3. Original record preserved
4. Duration recalculated
5. Employee notified
6. Records outside 30-day window cannot be corrected
7. Audit log records correction with before/after

**Priority:** P0
**Related Use Cases:** ATT-001, ATT-002, ATT-007

---

### ATT-007: Manually Add Attendance Record

- **ID:** ATT-007
- **Name:** Manually Add Attendance Record
- **Goal:** HR manually creates an attendance record for an employee (missed clock-in/out, system downtime)
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - No existing record for the employee on that date
  - User is authenticated as Owner or HR Administrator
- **Trigger:** HR clicks "Add Manual Entry" in attendance management

**Main Success Flow:**

1. HR clicks "Add Manual Entry"
2. System displays form: employee, date, clock-in time, clock-out time, reason
3. HR selects employee and enters times
4. HR enters mandatory reason
5. System validates no duplicate record exists for that date
6. System validates times are logical
7. System creates AttendanceSession with source="manual"
8. System calculates duration
9. System notifies employee
10. System creates audit event

**Alternative Flows:**

- **AF-1: Clock-in only** — Clock-out can be added later or left for end-of-day
- **AF-2: Retroactive entry** — For past dates when system was unavailable

**Failure Flows:**

- **FF-1: Duplicate record** — "Attendance already exists for this employee on this date"
- **FF-2: No reason** — Validation error
- **FF-3: Invalid times** — "Clock-out must be after clock-in"

**Business Rules:** BR-ATT-003, BR-ATT-004
**Required Permissions:** attendance.manual.add (Owner, HR Administrator)
**Data Created/Modified:** AttendanceSession created (source: manual)
**Notifications:** Employee notified
**Audit Events:** `attendance.manual_added` — actor: HR, employee, date, times, reason
**Security Considerations:**
- Marked as manual entry (distinguishable from self-clock)
- Reason mandatory
- Only HR can add manual entries

**Acceptance Criteria:**
1. HR can add manual attendance for any active employee
2. Reason is mandatory
3. Duplicate date detection prevents conflicts
4. Marked as "manual" source
5. Employee notified
6. Audit trail records creation

**Priority:** P1
**Related Use Cases:** ATT-006, ATT-001

---


### ATT-008: Record Remote Attendance

- **ID:** ATT-008
- **Name:** Record Remote Attendance
- **Goal:** Employee records attendance while working remotely
- **Primary Actor:** Employee
- **Supporting Actors:** None
- **Preconditions:**
  - Employee is active
  - Organisation allows remote attendance tracking
- **Trigger:** Employee clocks in and selects "Remote" location

**Main Success Flow:**

1. Employee clicks "Clock In"
2. Employee selects location type: "Remote" (vs "Office")
3. System creates AttendanceSession with locationType="remote"
4. Normal clock-in flow continues (ATT-001)
5. Record flagged as remote in history and reports

**Alternative Flows:**

- **AF-1: Default to office** — If no selection, defaults to office
- **AF-2: Change location mid-session** — Not supported in V1 (clock out and back in)

**Failure Flows:**

- **FF-1: Same as ATT-001 failures** — Duplicate session, leave day, etc.

**Business Rules:** BR-ATT-001, BR-ATT-002
**Required Permissions:** attendance.clock (all roles)
**Data Created/Modified:** AttendanceSession with locationType field
**Notifications:** None
**Audit Events:** None (routine)
**Security Considerations:**
- No location verification in V1 (trust-based)
- Remote vs office is informational

**Acceptance Criteria:**
1. Employee can mark attendance as remote
2. Remote flag visible in history and reports
3. Defaults to office if not specified
4. No impact on hours calculation
5. Filterable in reports

**Priority:** P1
**Related Use Cases:** ATT-001, ATT-004

---

### ATT-009: Handle Missing Clock-Out

- **ID:** ATT-009
- **Name:** Handle Missing Clock-Out
- **Goal:** System detects and flags attendance sessions where employee forgot to clock out
- **Primary Actor:** System (automated)
- **Supporting Actors:** HR Administrator
- **Preconditions:**
  - Open attendance session exists
  - Current time exceeds working hours end + 2 hour buffer
- **Trigger:** Scheduled job runs (e.g., every hour or at end of working day + buffer)

**Main Success Flow:**

1. System runs end-of-day check
2. System identifies open sessions past threshold (end of working hours + 2h per BR-ATT-005)
3. System flags session as "missing_clock_out"
4. System does NOT auto-close the session (requires HR correction)
5. System notifies HR: "[N] employees have missing clock-outs"
6. System optionally notifies employee: "You forgot to clock out today"
7. HR corrects via ATT-006

**Alternative Flows:**

- **AF-1: Overnight shift** — System accounts for overnight working hours (BR-ATT-007)
- **AF-2: Employee clocks out late** — If employee clocks out before system check, no flag needed

**Failure Flows:**

- **FF-1: Working hours not configured** — Uses default 17:00 + 2h = 19:00

**Business Rules:** BR-ATT-005, BR-ATT-007
**Required Permissions:** System (automated)
**Data Created/Modified:** AttendanceSession.status → missing_clock_out
**Notifications:** HR notified of missing clock-outs; employee optionally notified
**Audit Events:** `attendance.missing_clockout_detected` — system, affected sessions
**Security Considerations:**
- Automated job cannot modify times, only flag
- HR must manually correct
- Does not auto-calculate duration

**Acceptance Criteria:**
1. Open sessions past threshold are flagged
2. HR is notified
3. Employee is optionally notified
4. Session is NOT auto-closed
5. Overnight shifts handled correctly
6. Flag visible in attendance views

**Priority:** P0
**Related Use Cases:** ATT-001, ATT-006, ATT-011

---

### ATT-010: Handle Duplicate Clock-In Attempt

- **ID:** ATT-010
- **Name:** Handle Duplicate Clock-In Attempt
- **Goal:** System prevents an employee from clocking in twice without clocking out
- **Primary Actor:** System
- **Supporting Actors:** Employee (informed)
- **Preconditions:**
  - Employee already has an open attendance session
- **Trigger:** Employee attempts to clock in again

**Main Success Flow:**

1. Employee clicks "Clock In"
2. System checks for existing open session
3. System finds open session
4. System blocks the action
5. System displays: "You are already clocked in since [time]. Clock out first."
6. UI shows current session state prominently

**Alternative Flows:**

- **AF-1: UI prevention** — Clock In button is disabled/hidden when clocked in (advisory)

**Failure Flows:**

- **FF-1: Race condition** — Database constraint prevents duplicate (unique index on employee + open status)

**Business Rules:** BR-ATT-001
**Required Permissions:** attendance.clock
**Data Created/Modified:** None (blocked action)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Server-side enforcement via database constraint
- Client-side button state is advisory only

**Acceptance Criteria:**
1. Second clock-in attempt is blocked
2. Clear message shown with current session time
3. Database constraint prevents race conditions
4. UI reflects current state
5. No partial records created

**Priority:** P0
**Related Use Cases:** ATT-001, ATT-002

---


### ATT-011: Handle Overnight Shift

- **ID:** ATT-011
- **Name:** Handle Overnight Shift
- **Goal:** System correctly handles attendance sessions that span midnight
- **Primary Actor:** System
- **Supporting Actors:** Employee
- **Preconditions:**
  - Employee clocks in before midnight and clocks out after midnight
- **Trigger:** Employee clocks out on a different calendar date than clock-in

**Main Success Flow:**

1. Employee clocks in at 22:00 on Jan 1
2. Employee clocks out at 06:00 on Jan 2
3. System detects clock-out date differs from clock-in date
4. System treats the session as belonging to the clock-in date (Jan 1) per BR-ATT-007
5. System calculates duration normally: 8 hours
6. Session appears under Jan 1 in attendance history
7. Jan 2 does not show a separate partial session

**Alternative Flows:**

- **AF-1: Multi-day session** — If session spans > 24 hours, flagged as anomaly for HR review
- **AF-2: Missing clock-out detection** — Overnight threshold accounts for org working hours config

**Failure Flows:**

- **FF-1: Session > 24 hours** — Flagged as potential missing clock-out

**Business Rules:** BR-ATT-007, BR-ATT-005
**Required Permissions:** attendance.clock
**Data Created/Modified:** AttendanceSession with cross-midnight timestamps
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Date assignment logic must be consistent
- Duration calculation handles midnight crossing

**Acceptance Criteria:**
1. Cross-midnight sessions are treated as single session
2. Session assigned to clock-in date
3. Duration calculated correctly across midnight
4. Sessions > 24h flagged as anomaly
5. Missing clock-out detection accounts for overnight patterns

**Priority:** P1
**Related Use Cases:** ATT-001, ATT-002, ATT-009

---

### ATT-012: Handle Timezone Display

- **ID:** ATT-012
- **Name:** Handle Timezone Display
- **Goal:** All attendance times stored in UTC but displayed in organisation timezone
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Organisation timezone is configured
- **Trigger:** Any attendance time is displayed to user

**Main Success Flow:**

1. System stores all timestamps in UTC (BR-ATT-002)
2. When displaying to user, system reads organisation timezone setting
3. System converts UTC timestamps to organisation timezone
4. User sees times in their org's local time
5. Exports include timezone indication

**Alternative Flows:**

- **AF-1: Timezone changed** — New display immediately; stored UTC unchanged
- **AF-2: Export** — Includes timezone label in header

**Failure Flows:**

- **FF-1: Invalid timezone config** — Fallback to UTC display

**Business Rules:** BR-ATT-002, BR-DATA-002
**Required Permissions:** None (display logic)
**Data Created/Modified:** None (display transformation)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- UTC storage prevents timezone bugs
- Conversion only at presentation layer
- Never store local times

**Acceptance Criteria:**
1. All stored times are UTC
2. Display converts to org timezone
3. Timezone change doesn't affect stored data
4. Exports include timezone indication
5. Consistent across all attendance views

**Priority:** P1
**Related Use Cases:** ORG-003, ATT-001

---

### ATT-013: Handle Leave/Holiday Conflict

- **ID:** ATT-013
- **Name:** Handle Leave/Holiday Conflict
- **Goal:** System prevents clock-in on days with approved full-day leave or public holidays
- **Primary Actor:** System
- **Supporting Actors:** Employee (informed)
- **Preconditions:**
  - Employee has approved full-day leave for today, or today is a public holiday
- **Trigger:** Employee attempts to clock in on a leave/holiday day

**Main Success Flow:**

1. Employee attempts to clock in
2. System checks approved leave for today
3. System finds full-day approved leave
4. System blocks clock-in
5. System displays: "Cannot clock in: you have approved [Leave Type] today"

**Alternative Flows:**

- **AF-1: Half-day leave** — Clock-in allowed (working other half)
- **AF-2: Public holiday** — Clock-in blocked: "Today is a public holiday ([Name])"
- **AF-3: Attendance exists when leave approved later** — Conflict flagged for HR (BR-CROSS-003)

**Failure Flows:**

- **FF-1: Leave approved after clock-in** — Existing session remains; conflict flagged for HR

**Business Rules:** BR-ATT-008, BR-CROSS-003
**Required Permissions:** attendance.clock
**Data Created/Modified:** None (blocked action)
**Notifications:** None
**Audit Events:** Conflict flag created if post-hoc conflict detected
**Security Considerations:**
- Prevents contradictory records
- Post-hoc conflicts require HR resolution

**Acceptance Criteria:**
1. Clock-in blocked on full-day leave days
2. Clock-in blocked on public holidays
3. Half-day leave allows clock-in
4. Clear message explains why blocked
5. Post-hoc conflicts flagged for HR

**Priority:** P0
**Related Use Cases:** ATT-001, LEAVE-011

---

### ATT-014: Export Attendance Data

- **ID:** ATT-014
- **Name:** Export Attendance Data
- **Goal:** HR or Manager exports attendance records for reporting or payroll processing
- **Primary Actor:** HR Administrator or Manager (team)
- **Supporting Actors:** None
- **Preconditions:**
  - User has export permission for the relevant scope
- **Trigger:** User clicks "Export" on attendance view

**Main Success Flow:**

1. User navigates to attendance history/summary
2. User clicks "Export"
3. System displays export options: date range, format (CSV/PDF), scope
4. User configures export parameters
5. System generates export file with attendance data
6. System includes metadata: generated by, date, filters applied, timezone
7. File downloaded to user's browser
8. System logs export event

**Alternative Flows:**

- **AF-1: Manager export** — Scoped to direct reports only
- **AF-2: HR export** — Organisation-wide
- **AF-3: PDF format** — Formatted report with summary statistics

**Failure Flows:**

- **FF-1: No data for range** — "No attendance records for selected criteria"
- **FF-2: Rate limit exceeded** — "Please wait before exporting again"

**Business Rules:** BR-ATT-002
**Required Permissions:** attendance.export (Manager: team; HR/Owner: all)
**Data Created/Modified:** None (export only)
**Notifications:** None
**Audit Events:** `attendance.exported` — actor, scope, date_range, format
**Security Considerations:**
- Rate-limited to prevent abuse
- Export logged for audit
- Manager scope enforced server-side
- Timezone included in export metadata

**Acceptance Criteria:**
1. CSV and PDF export formats available
2. Date range filter works
3. Manager export scoped to team
4. HR export covers all employees
5. Metadata included in export
6. Export action is audited
7. Rate limiting prevents abuse

**Priority:** P1
**Related Use Cases:** ATT-004, ATT-005

---

## Onboarding Module

---

### ONB-001: Create Onboarding Template

- **ID:** ONB-001
- **Name:** Create Onboarding Template
- **Goal:** HR creates a reusable onboarding template with tasks
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Onboarding > Templates and clicks "Create Template"

**Main Success Flow:**

1. User clicks "Create Template"
2. System displays form: template name, description
3. User enters template name
4. System validates name uniqueness
5. System creates OnboardingTemplate record
6. System redirects to template editor for adding tasks
7. Template is available for assignment

**Alternative Flows:**

- **AF-1: Duplicate template** — Clone existing template as starting point
- **AF-2: Add tasks inline** — Add tasks during creation (ONB-002)

**Failure Flows:**

- **FF-1: Duplicate name** — "Template name already exists"
- **FF-2: Permission denied** — 403

**Business Rules:** BR-ORG-001
**Required Permissions:** onboarding.template.write (Owner, HR Administrator)
**Data Created/Modified:** OnboardingTemplate record created
**Notifications:** None
**Audit Events:** `onboarding_template.created` — actor, target
**Security Considerations:**
- Tenant-scoped
- Templates are configuration, not sensitive data

**Acceptance Criteria:**
1. Template created with unique name
2. Available for task addition
3. Can be assigned to employees
4. Duplicates prevented
5. Audit log records creation

**Priority:** P0
**Related Use Cases:** ONB-002, ONB-005

---


### ONB-002: Add Task to Template

- **ID:** ONB-002
- **Name:** Add Task to Template
- **Goal:** HR adds individual tasks to an onboarding template
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Template exists
- **Trigger:** User clicks "Add Task" within template editor

**Main Success Flow:**

1. User opens template editor
2. User clicks "Add Task"
3. System displays form: task title, description, assigned role (employee/manager/HR), relative due day (e.g., Day 1, Day 7, Day 30)
4. User fills in task details
5. System adds task to template with order position
6. Task appears in template task list
7. User can reorder tasks via drag-and-drop

**Alternative Flows:**

- **AF-1: Multiple tasks** — User adds several tasks in sequence
- **AF-2: Reorder** — Drag-and-drop to change task order

**Failure Flows:**

- **FF-1: Missing title** — Validation error
- **FF-2: Invalid due day** — Must be positive integer

**Business Rules:** BR-ONB-001
**Required Permissions:** onboarding.template.write
**Data Created/Modified:** OnboardingTemplateTask record created
**Notifications:** None
**Audit Events:** `onboarding_template.task_added` — actor, template, task
**Security Considerations:**
- Tasks are part of template configuration
- Changes don't affect existing instances (BR-ONB-001)

**Acceptance Criteria:**
1. Tasks can be added with title, description, assignee role, due day
2. Tasks can be reordered
3. Multiple tasks supported per template
4. Changes don't affect existing onboarding instances
5. Validation enforced

**Priority:** P0
**Related Use Cases:** ONB-001, ONB-003

---

### ONB-003: Edit Onboarding Template

- **ID:** ONB-003
- **Name:** Edit Onboarding Template
- **Goal:** HR modifies an existing onboarding template (name, tasks, order)
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Template exists and is not archived
- **Trigger:** User clicks "Edit" on a template

**Main Success Flow:**

1. User opens template
2. User modifies name, description, or tasks
3. User can add/remove/reorder tasks
4. User saves changes
5. System validates and updates template
6. Changes apply to future assignments only (BR-ONB-001)

**Alternative Flows:**

- **AF-1: Remove task** — Task removed from template (existing instances unaffected)
- **AF-2: Edit task details** — Update description, due day, or assignee role

**Failure Flows:**

- **FF-1: Template archived** — "Cannot edit archived template"

**Business Rules:** BR-ONB-001
**Required Permissions:** onboarding.template.write
**Data Created/Modified:** OnboardingTemplate and/or tasks updated
**Notifications:** None
**Audit Events:** `onboarding_template.updated` — actor, changes
**Security Considerations:**
- Existing instances are snapshot-based (BR-ONB-001)
- Changes are forward-only

**Acceptance Criteria:**
1. Template name and tasks can be edited
2. Existing onboarding instances are unaffected
3. Task add/remove/reorder works
4. Archived templates cannot be edited
5. Audit records changes

**Priority:** P1
**Related Use Cases:** ONB-001, ONB-002

---

### ONB-004: Archive Onboarding Template

- **ID:** ONB-004
- **Name:** Archive Onboarding Template
- **Goal:** Remove template from active use without affecting existing instances
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Template exists
- **Trigger:** User clicks "Archive" on template

**Main Success Flow:**

1. User clicks "Archive" on template
2. System confirms: "Archive this template? It can no longer be assigned but existing onboarding will continue."
3. User confirms
4. System sets template.archivedAt
5. Template removed from assignment dropdowns
6. Existing active onboarding instances continue unaffected

**Alternative Flows:**

- **AF-1: Unarchive** — Restore template to active state

**Failure Flows:**

- **FF-1: Already archived** — "Template is already archived"

**Business Rules:** BR-ONB-001, BR-DATA-001
**Required Permissions:** onboarding.template.write
**Data Created/Modified:** Template.archivedAt set
**Notifications:** None
**Audit Events:** `onboarding_template.archived` — actor, target
**Security Considerations:**
- Soft-delete; data preserved
- Active instances continue

**Acceptance Criteria:**
1. Archived templates cannot be assigned
2. Existing instances continue
3. Unarchive is available
4. Removed from assignment dropdowns

**Priority:** P2
**Related Use Cases:** ONB-001, ONB-003

---

### ONB-005: Assign Onboarding to Employee

- **ID:** ONB-005
- **Name:** Assign Onboarding to Employee
- **Goal:** HR applies an onboarding template to a new employee, generating individual tasks
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** System
- **Preconditions:**
  - Employee is active or invited
  - Template exists and is not archived
  - Employee has no active onboarding (BR-ONB-006)
- **Trigger:** HR clicks "Assign Onboarding" on employee profile or during creation

**Main Success Flow:**

1. HR selects an employee and clicks "Assign Onboarding"
2. System displays available templates
3. HR selects a template
4. System validates employee has no active onboarding (BR-ONB-006)
5. System creates OnboardingInstance record linked to employee
6. System copies all template tasks as individual OnboardingTask records (BR-ONB-001)
7. System calculates due dates based on employee start date (BR-ONB-002)
8. System assigns tasks to appropriate users (employee, their manager, HR)
9. System sends notifications to all assignees
10. Onboarding progress visible on employee profile

**Alternative Flows:**

- **AF-1: Assign during employee creation** — Option to assign template in EMP-001 flow
- **AF-2: Custom start date** — Override joining date for due date calculation

**Failure Flows:**

- **FF-1: Active onboarding exists** — "Employee already has active onboarding" (BR-ONB-006)
- **FF-2: Template archived** — "Selected template is no longer active"
- **FF-3: No manager assigned** — Manager tasks assigned to HR as fallback

**Business Rules:** BR-ONB-001, BR-ONB-002, BR-ONB-006
**Required Permissions:** onboarding.assign (Owner, HR Administrator)
**Data Created/Modified:** OnboardingInstance + individual task records created
**Notifications:** All task assignees notified
**Audit Events:** `onboarding.assigned` — actor, employee, template, task_count
**Security Considerations:**
- Task snapshot is independent of template (BR-ONB-001)
- Due dates calculated server-side
- Cannot have overlapping active onboarding

**Acceptance Criteria:**
1. Template tasks are copied as individual records
2. Due dates calculated from employee start date
3. Tasks assigned to correct users
4. All assignees notified
5. Cannot assign if active onboarding exists
6. Progress tracking begins immediately

**Priority:** P0
**Related Use Cases:** ONB-001, ONB-009, EMP-001

---


### ONB-006: View Onboarding Progress

- **ID:** ONB-006
- **Name:** View Onboarding Progress
- **Goal:** User views the progress of an employee's onboarding
- **Primary Actor:** Employee (own), Manager (team), HR (all)
- **Supporting Actors:** None
- **Preconditions:**
  - Onboarding instance exists for the employee
- **Trigger:** User navigates to onboarding section

**Main Success Flow:**

1. User navigates to onboarding progress view
2. System displays task list with statuses: pending, in-progress, completed, overdue
3. Progress bar shows percentage complete
4. Overdue tasks highlighted
5. Each task shows: title, assignee, due date, status

**Alternative Flows:**

- **AF-1: Employee view** — Sees only own onboarding tasks
- **AF-2: HR dashboard** — Overview of all active onboarding across org
- **AF-3: Manager view** — Sees direct reports' onboarding progress

**Failure Flows:**

- **FF-1: No onboarding assigned** — "No onboarding in progress"

**Business Rules:** BR-ONB-002
**Required Permissions:** onboarding.task.read.own (employee), onboarding.task.read.all (HR)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Scoped visibility per role

**Acceptance Criteria:**
1. Progress percentage displayed
2. Overdue tasks highlighted
3. Task details visible (title, assignee, due, status)
4. Employee sees own tasks only
5. HR sees organisation-wide overview

**Priority:** P0
**Related Use Cases:** ONB-005, ONB-009

---

### ONB-007: View Overdue Tasks

- **ID:** ONB-007
- **Name:** View Overdue Tasks
- **Goal:** HR identifies onboarding tasks that are past their due date
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Active onboarding instances exist with overdue tasks
- **Trigger:** HR views onboarding dashboard or overdue filter

**Main Success Flow:**

1. HR navigates to Onboarding > Overdue
2. System queries all incomplete tasks where due_date < today
3. System displays: task title, employee, assignee, due date, days overdue
4. Sorted by most overdue first
5. HR can click through to task details

**Alternative Flows:**

- **AF-1: Dashboard widget** — Overdue count shown on admin dashboard
- **AF-2: Filter by assignee** — See overdue tasks by assignee type

**Failure Flows:**

- **FF-1: No overdue tasks** — "All onboarding tasks are on track"

**Business Rules:** BR-ONB-002
**Required Permissions:** onboarding.task.read.all (Owner, HR Administrator)
**Data Created/Modified:** None (read-only)
**Notifications:** None (separate notification for reminders)
**Audit Events:** None
**Security Considerations:**
- Only HR/Owner can see full overdue report

**Acceptance Criteria:**
1. All overdue tasks displayed
2. Days overdue calculated
3. Sortable and filterable
4. Click-through to task details
5. Dashboard widget shows count

**Priority:** P1
**Related Use Cases:** ONB-006, ONB-008

---

### ONB-008: Send Task Reminder

- **ID:** ONB-008
- **Name:** Send Task Reminder
- **Goal:** System sends reminders for upcoming or overdue onboarding tasks
- **Primary Actor:** System (automated)
- **Supporting Actors:** Task assignee
- **Preconditions:**
  - Task is pending/in-progress and approaching or past due date
- **Trigger:** Scheduled job (daily)

**Main Success Flow:**

1. System runs daily reminder check
2. System identifies tasks due tomorrow (upcoming) and tasks overdue
3. For upcoming tasks: sends reminder to assignee
4. For overdue tasks: sends reminder to assignee + notification to HR
5. Reminder includes: task title, employee name, due date

**Alternative Flows:**

- **AF-1: Task already completed** — No reminder sent
- **AF-2: Assignee has no user account** — No reminder possible; HR notified instead

**Failure Flows:**

- **FF-1: Notification delivery failure** — Retry on next job run

**Business Rules:** BR-NOTIF-001, BR-NOTIF-002
**Required Permissions:** System (automated)
**Data Created/Modified:** Notification records created
**Notifications:** Reminder to assignee; escalation to HR for overdue
**Audit Events:** None (routine system action)
**Security Considerations:**
- Respects notification deduplication (BR-NOTIF-002)
- Only sends to users with accounts (BR-NOTIF-001)

**Acceptance Criteria:**
1. Upcoming task reminders sent day before due
2. Overdue task reminders sent to assignee and HR
3. Completed tasks excluded
4. Deduplication prevents spam
5. Only users with accounts receive notifications

**Priority:** P2
**Related Use Cases:** ONB-007, NOTIF-001

---

### ONB-009: Complete Onboarding Task

- **ID:** ONB-009
- **Name:** Complete Onboarding Task
- **Goal:** Task assignee marks a task as completed
- **Primary Actor:** Task assignee (Employee, Manager, or HR)
- **Supporting Actors:** None
- **Preconditions:**
  - Task is in pending or in-progress state
  - User is the assigned owner (BR-ONB-003)
- **Trigger:** Assignee clicks "Complete" on a task

**Main Success Flow:**

1. Assignee views their onboarding tasks
2. Assignee clicks "Mark Complete" on a task
3. System validates user is the task assignee (BR-ONB-003)
4. System updates task status to "Completed"
5. System records completion timestamp and actor
6. System updates onboarding progress percentage
7. If all tasks completed: marks onboarding as "Completed"
8. System displays success message

**Alternative Flows:**

- **AF-1: HR completing any task** — HR can override ownership check
- **AF-2: All tasks complete** — Onboarding instance status → Completed; celebration notification
- **AF-3: Add notes on completion** — Optional completion notes

**Failure Flows:**

- **FF-1: Not the assignee** — "Only the assigned person can complete this task" (BR-ONB-003)
- **FF-2: Already completed** — "Task is already completed"

**Business Rules:** BR-ONB-003
**Required Permissions:** onboarding.task.complete.own / onboarding.task.complete.assigned
**Data Created/Modified:** Task status → Completed, completedAt, completedBy
**Notifications:** Progress update to HR if significant milestone
**Audit Events:** `onboarding_task.completed` — actor, task, onboarding instance
**Security Considerations:**
- Ownership validation prevents unauthorized completion
- HR override available for exceptional cases

**Acceptance Criteria:**
1. Only assigned user can complete task
2. Progress percentage updates
3. All-tasks-complete triggers onboarding completion
4. HR can override ownership
5. Completion timestamp recorded

**Priority:** P0
**Related Use Cases:** ONB-005, ONB-006, ONB-010

---


### ONB-010: Reopen Completed Task

- **ID:** ONB-010
- **Name:** Reopen Completed Task
- **Goal:** HR reopens a completed task that needs to be redone
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Task is in Completed status
  - User is HR or Owner (BR-ONB-004)
- **Trigger:** HR clicks "Reopen" on a completed task

**Main Success Flow:**

1. HR views a completed onboarding task
2. HR clicks "Reopen"
3. System validates user is HR/Owner (BR-ONB-004)
4. System resets task status to "Pending"
5. System clears completedAt and completedBy
6. System recalculates onboarding progress
7. If onboarding was Completed, reverts to In Progress
8. System notifies task assignee

**Alternative Flows:**

- **AF-1: Onboarding already completed** — Reopening a task reverts onboarding status

**Failure Flows:**

- **FF-1: Employee attempts reopen** — "Only HR can reopen completed tasks" (BR-ONB-004)

**Business Rules:** BR-ONB-004
**Required Permissions:** onboarding.task.complete.assigned (HR override)
**Data Created/Modified:** Task status → Pending, onboarding progress recalculated
**Notifications:** Assignee notified task was reopened
**Audit Events:** `onboarding_task.reopened` — actor: HR, task, reason
**Security Considerations:**
- Only HR can reopen (prevents gaming)
- Audit trail captures reopen

**Acceptance Criteria:**
1. Only HR/Owner can reopen completed tasks
2. Employee cannot reopen
3. Progress recalculated
4. Assignee notified
5. Onboarding status reverts if needed

**Priority:** P2
**Related Use Cases:** ONB-009

---

### ONB-011: View Employee Onboarding Checklist

- **ID:** ONB-011
- **Name:** View Employee Onboarding Checklist
- **Goal:** New employee views their personal onboarding checklist and progress
- **Primary Actor:** Employee
- **Supporting Actors:** None
- **Preconditions:**
  - Employee has active onboarding assigned
- **Trigger:** Employee navigates to Onboarding section

**Main Success Flow:**

1. Employee navigates to "My Onboarding" section
2. System retrieves their onboarding instance and tasks
3. System displays checklist with: task title, description, due date, status, assigned to
4. Employee sees which tasks are theirs to complete vs waiting on others
5. Progress bar shows overall completion
6. Overdue tasks highlighted

**Alternative Flows:**

- **AF-1: No onboarding** — "No onboarding tasks assigned"
- **AF-2: Completed onboarding** — Shows completed checklist with dates

**Failure Flows:**

- **FF-1: No active onboarding** — Empty state message

**Business Rules:** BR-PERM-005
**Required Permissions:** onboarding.task.read.own
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Employee sees only own tasks

**Acceptance Criteria:**
1. Employee sees full checklist
2. Own tasks distinguishable from others' tasks
3. Progress shown visually
4. Overdue tasks highlighted
5. Due dates displayed

**Priority:** P0
**Related Use Cases:** ONB-005, ONB-009

---

### ONB-012: Track Onboarding Completion

- **ID:** ONB-012
- **Name:** Track Onboarding Completion
- **Goal:** System automatically marks onboarding as complete when all tasks are done
- **Primary Actor:** System
- **Supporting Actors:** HR (notified)
- **Preconditions:**
  - All tasks in onboarding instance are marked Complete
- **Trigger:** Last task in an onboarding instance is completed

**Main Success Flow:**

1. Assignee completes the final remaining task
2. System detects all tasks in instance are now Complete
3. System updates OnboardingInstance.status to "Completed"
4. System sets completedAt timestamp
5. System notifies HR: "[Employee] has completed onboarding"
6. System notifies employee: "Congratulations! Your onboarding is complete"

**Alternative Flows:**

- **AF-1: Task reopened after completion** — Reverts instance back to In Progress

**Failure Flows:**

- **FF-1: Cancelled tasks** — Cancelled tasks are excluded from completion check

**Business Rules:** BR-ONB-005
**Required Permissions:** System (automated)
**Data Created/Modified:** OnboardingInstance.status → Completed
**Notifications:** HR and employee notified
**Audit Events:** `onboarding.completed` — employee, duration, task_count
**Security Considerations:**
- Automated state transition
- Cannot manually force-complete (all tasks must be done)

**Acceptance Criteria:**
1. Auto-completes when all tasks done
2. HR notified
3. Employee congratulated
4. Cancelled tasks excluded from check
5. Reopening a task reverts completion

**Priority:** P0
**Related Use Cases:** ONB-009, ONB-010

---

### ONB-013: Cancel Onboarding

- **ID:** ONB-013
- **Name:** Cancel Onboarding
- **Goal:** HR cancels an active onboarding (e.g., employee leaves before completing)
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** System
- **Preconditions:**
  - Active onboarding instance exists
  - Reason for cancellation
- **Trigger:** HR clicks "Cancel Onboarding" or employee is deactivated (EMP-013)

**Main Success Flow:**

1. HR clicks "Cancel Onboarding" on employee's onboarding or employee is deactivated
2. System prompts for reason (if manual)
3. System updates all incomplete tasks to "Cancelled" (BR-ONB-005)
4. Completed tasks remain as-is (historical record)
5. System updates OnboardingInstance.status to "Cancelled"
6. System notifies affected task assignees
7. System records audit event

**Alternative Flows:**

- **AF-1: Triggered by deactivation** — Automatic, no manual prompt (EMP-013)
- **AF-2: Partial completion** — Completed tasks preserved, only pending/in-progress cancelled

**Failure Flows:**

- **FF-1: Onboarding already completed** — "Cannot cancel completed onboarding"
- **FF-2: Already cancelled** — "Onboarding is already cancelled"

**Business Rules:** BR-ONB-005
**Required Permissions:** onboarding.cancel (Owner, HR Administrator)
**Data Created/Modified:** Instance status → Cancelled, incomplete tasks → Cancelled
**Notifications:** Task assignees notified
**Audit Events:** `onboarding.cancelled` — actor, employee, reason, tasks_cancelled_count
**Security Considerations:**
- Completed tasks preserved for history
- Cancellation reason recorded
- Cascading from deactivation is atomic

**Acceptance Criteria:**
1. All incomplete tasks cancelled
2. Completed tasks preserved
3. Reason recorded
4. Assignees notified
5. Cannot cancel already-completed onboarding
6. Deactivation triggers automatic cancellation

**Priority:** P0
**Related Use Cases:** EMP-013, ONB-005

---

### ONB-014: HR Dashboard Onboarding Overview

- **ID:** ONB-014
- **Name:** HR Dashboard Onboarding Overview
- **Goal:** HR views aggregate onboarding status across all employees
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Active onboarding instances exist
- **Trigger:** HR views admin dashboard or onboarding section

**Main Success Flow:**

1. HR navigates to Onboarding overview
2. System displays: active onboarding count, overdue tasks count, recently completed, average completion time
3. List of active instances with progress bars
4. Filter by status: active, completed, cancelled
5. Click through to individual employee onboarding

**Alternative Flows:**

- **AF-1: No active onboarding** — Empty state with "Assign onboarding" call-to-action

**Failure Flows:**

- **FF-1: Permission denied** — Only HR/Owner can view overview

**Business Rules:** None specific
**Required Permissions:** onboarding.task.read.all
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Only HR/Owner access

**Acceptance Criteria:**
1. Aggregate statistics displayed
2. Active instances listed with progress
3. Overdue tasks highlighted
4. Filterable by status
5. Click-through to details

**Priority:** P1
**Related Use Cases:** ONB-006, ONB-007

---

### ONB-015: Manager View New Hire Tasks

- **ID:** ONB-015
- **Name:** Manager View New Hire Tasks
- **Goal:** Manager sees onboarding tasks assigned to them for their new hire
- **Primary Actor:** Manager
- **Supporting Actors:** None
- **Preconditions:**
  - Manager has direct report with active onboarding
  - Tasks are assigned to manager role
- **Trigger:** Manager views their tasks or team section

**Main Success Flow:**

1. Manager navigates to "My Tasks" or team onboarding view
2. System retrieves tasks assigned to manager for their direct reports
3. System displays task list with: task title, employee name, due date, status
4. Manager can complete tasks assigned to them (ONB-009)
5. Manager can view overall progress of their new hire's onboarding

**Alternative Flows:**

- **AF-1: No assigned tasks** — "No onboarding tasks assigned to you"
- **AF-2: Multiple new hires** — Tasks grouped by employee

**Failure Flows:**

- **FF-1: Employee no longer reports to them** — Tasks remain assigned until reassigned

**Business Rules:** BR-ONB-003
**Required Permissions:** onboarding.task.read.own, onboarding.task.complete.assigned (S)
**Data Created/Modified:** None (read-only view)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Manager sees only tasks for their direct reports
- Scoped via reporting relationship

**Acceptance Criteria:**
1. Manager sees tasks assigned to them
2. Grouped by employee
3. Can complete assigned tasks
4. Due dates and status visible
5. Only direct reports' onboarding shown

**Priority:** P1
**Related Use Cases:** ONB-009, ONB-006

---

## Documents Module

---

### DOC-001: Create Document Category

- **ID:** DOC-001
- **Name:** Create Document Category
- **Goal:** HR creates a category for organizing employee documents
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
- **Trigger:** User navigates to Documents > Categories and clicks "Add Category"

**Main Success Flow:**

1. User clicks "Add Category"
2. System displays form: name, description, sensitivity level (normal/sensitive), default visibility (employee-visible/HR-only), retention period (optional)
3. User enters category details
4. System validates name uniqueness
5. System creates DocumentCategory record
6. Category available for document uploads

**Alternative Flows:**

- **AF-1: Sensitive category** — Documents in this category only visible to HR/Owner
- **AF-2: Employee-visible** — Employees can see their own documents in this category

**Failure Flows:**

- **FF-1: Duplicate name** — Validation error
- **FF-2: Permission denied** — 403

**Business Rules:** BR-DOC-004, BR-ORG-001
**Required Permissions:** document.category.write (Owner, HR Administrator)
**Data Created/Modified:** DocumentCategory record created
**Notifications:** None
**Audit Events:** `document_category.created` — actor, target, sensitivity_level
**Security Considerations:**
- Sensitivity level controls access (BR-DOC-004)
- Tenant-scoped

**Acceptance Criteria:**
1. Category created with unique name
2. Sensitivity level configurable
3. Visibility rules enforceable
4. Available for uploads immediately
5. Audit log records creation

**Priority:** P0
**Related Use Cases:** DOC-002, DOC-008

---


### DOC-002: Upload Document

- **ID:** DOC-002
- **Name:** Upload Document
- **Goal:** Upload a document and attach it to an employee record
- **Primary Actor:** HR Administrator, Owner, or Employee (own non-sensitive)
- **Supporting Actors:** System (file validation)
- **Preconditions:**
  - Target employee exists
  - Category exists
  - File meets validation requirements
- **Trigger:** User clicks "Upload" on employee documents section

**Main Success Flow:**

1. User clicks "Upload Document" on employee profile > Documents
2. System displays form: file, category, description, expiry date (optional)
3. User selects file and fills metadata
4. System validates file type via magic bytes (BR-DOC-001)
5. System validates file size ≤ 10MB (BR-DOC-002)
6. System uploads to tenant-scoped storage path (BR-DOC-003)
7. System creates Document metadata record
8. System displays success: "Document uploaded"
9. Document appears in employee's document list

**Alternative Flows:**

- **AF-1: Employee uploading own** — Limited to non-sensitive categories
- **AF-2: Document with expiry** — Triggers expiry monitoring (DOC-009)
- **AF-3: Upload failure cleanup** — If DB write fails, storage object removed (BR-DOC-007)

**Failure Flows:**

- **FF-1: Invalid file type** — "File type not allowed. Accepted: PDF, JPG, PNG, DOCX, XLSX"
- **FF-2: File too large** — "File exceeds 10MB limit"
- **FF-3: Storage failure** — "Upload failed. Please try again"
- **FF-4: Employee uploading to sensitive category** — 403
- **FF-5: Magic byte mismatch** — "File content does not match extension" (BR-DOC-001)

**Business Rules:** BR-DOC-001, BR-DOC-002, BR-DOC-003, BR-DOC-007
**Required Permissions:** document.upload (HR: any employee; Employee: own non-sensitive)
**Data Created/Modified:** File stored, Document record created
**Notifications:** None
**Audit Events:** `document.uploaded` — actor, employee, category, filename
**Security Considerations:**
- Magic byte validation prevents disguised malicious files
- Tenant-scoped storage prevents cross-tenant access
- Orphan cleanup on partial failure (BR-DOC-007)
- Max file size enforced server-side

**Acceptance Criteria:**
1. Valid files upload successfully
2. Invalid types/sizes rejected with clear messages
3. File stored in tenant-scoped path
4. Metadata record created
5. Employee self-upload limited to non-sensitive categories
6. Orphan cleanup on failure
7. Magic byte validation works

**Priority:** P0
**Related Use Cases:** DOC-001, DOC-003, DOC-009

---

### DOC-003: View Employee Documents

- **ID:** DOC-003
- **Name:** View Employee Documents
- **Goal:** View documents attached to an employee record
- **Primary Actor:** HR (all), Manager (team non-sensitive), Employee (own visible)
- **Supporting Actors:** None
- **Preconditions:**
  - Employee has documents uploaded
  - User has appropriate access scope
- **Trigger:** User navigates to employee profile > Documents tab

**Main Success Flow:**

1. User opens employee profile > Documents tab
2. System retrieves documents filtered by visibility rules (BR-DOC-004)
3. System displays: document name, category, upload date, expiry date, uploaded by
4. HR sees all documents including sensitive categories
5. Employee sees own documents in visible categories
6. Manager sees direct reports' non-sensitive documents

**Alternative Flows:**

- **AF-1: Filter by category** — User filters document list by category
- **AF-2: Expired documents** — Highlighted with expiry badge
- **AF-3: No documents** — "No documents uploaded for this employee"

**Failure Flows:**

- **FF-1: Permission denied** — 403 for unauthorized access

**Business Rules:** BR-DOC-004, BR-PERM-005
**Required Permissions:** document.read.own (employee), document.read.all (HR), document.read.sensitive (HR conditional)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** Sensitive document access logged
**Security Considerations:**
- Visibility rules enforce category-level access
- Sensitive categories hidden from employees
- Scoped access per role

**Acceptance Criteria:**
1. HR sees all documents
2. Employee sees own non-sensitive documents
3. Category filtering works
4. Expired documents flagged
5. Sensitive access logged

**Priority:** P0
**Related Use Cases:** DOC-002, DOC-004

---

### DOC-004: Download Document

- **ID:** DOC-004
- **Name:** Download Document
- **Goal:** User downloads a document file
- **Primary Actor:** Any authorized user
- **Supporting Actors:** System (signed URL generation)
- **Preconditions:**
  - Document exists
  - User has download permission for the document
- **Trigger:** User clicks "Download" on a document

**Main Success Flow:**

1. User clicks "Download" on a document
2. System validates user has permission (role + scope + category visibility)
3. System generates time-limited signed URL (5-minute expiry)
4. System redirects user to signed URL
5. Browser downloads the file
6. System logs download event

**Alternative Flows:**

- **AF-1: Preview** — For images/PDFs, show inline preview before download

**Failure Flows:**

- **FF-1: Permission denied** — 403
- **FF-2: File not found in storage** — "Document file unavailable. Contact HR."
- **FF-3: Signed URL expired** — User re-clicks download to generate new URL

**Business Rules:** BR-DOC-003, BR-DOC-004
**Required Permissions:** document.download (scoped per role)
**Data Created/Modified:** None
**Notifications:** None
**Audit Events:** `document.downloaded` — actor, document_id, employee
**Security Considerations:**
- Signed URLs prevent unauthorized direct access
- 5-minute expiry limits exposure
- Download logged for audit
- Tenant-scoped storage path validated

**Acceptance Criteria:**
1. Authorized users can download
2. Signed URL generated with expiry
3. Download logged
4. Permission checks enforced
5. Missing files handled gracefully

**Priority:** P0
**Related Use Cases:** DOC-003, DOC-008

---


### DOC-005: Replace Document Version

- **ID:** DOC-005
- **Name:** Replace Document Version
- **Goal:** HR uploads a new version of an existing document
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Document exists and is not archived
- **Trigger:** HR clicks "Replace" on a document

**Main Success Flow:**

1. HR clicks "Replace" on an existing document
2. System displays upload form (same validations as DOC-002)
3. HR selects new file
4. System validates file type and size
5. System uploads new file to storage
6. System updates Document record (new file reference, upload timestamp)
7. Previous version retained if retention enabled
8. System displays success

**Alternative Flows:**

- **AF-1: Version history** — Previous file retained as historical version (V2 full versioning)

**Failure Flows:**

- **FF-1: Document archived** — "Cannot replace archived document"
- **FF-2: File validation failure** — Same as DOC-002 failures

**Business Rules:** BR-DOC-001, BR-DOC-002
**Required Permissions:** document.replace (Owner, HR Administrator)
**Data Created/Modified:** Document file reference updated, previous version optionally retained
**Notifications:** None
**Audit Events:** `document.replaced` — actor, document_id, old_filename, new_filename
**Security Considerations:**
- Same file validations as upload
- Previous version retained for compliance

**Acceptance Criteria:**
1. New file replaces existing
2. File validations enforced
3. Previous version retained
4. Cannot replace archived documents
5. Audit log records replacement

**Priority:** P1
**Related Use Cases:** DOC-002, DOC-006

---

### DOC-006: Archive Document

- **ID:** DOC-006
- **Name:** Archive Document
- **Goal:** Remove document from active views while retaining for compliance
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Document exists and is active
- **Trigger:** User clicks "Archive" on a document

**Main Success Flow:**

1. User clicks "Archive" on document
2. System confirms: "Archive this document? It will be hidden from active views."
3. User confirms
4. System sets Document.archivedAt
5. Document excluded from default views
6. File remains in storage

**Alternative Flows:**

- **AF-1: Unarchive** — Restore to active state

**Failure Flows:**

- **FF-1: Already archived** — "Document is already archived"

**Business Rules:** BR-DATA-001
**Required Permissions:** document.archive (Owner, HR Administrator)
**Data Created/Modified:** Document.archivedAt set
**Notifications:** None
**Audit Events:** `document.archived` — actor, document_id
**Security Considerations:**
- Soft-delete; file preserved in storage
- Required step before permanent deletion

**Acceptance Criteria:**
1. Document hidden from active views
2. File preserved in storage
3. Unarchive available
4. Required before deletion
5. Audit logged

**Priority:** P1
**Related Use Cases:** DOC-007, DOC-005

---

### DOC-007: Delete Document

- **ID:** DOC-007
- **Name:** Delete Document
- **Goal:** Permanently delete a document (two-step: must archive first)
- **Primary Actor:** Owner, or HR Administrator (non-sensitive only)
- **Supporting Actors:** System
- **Preconditions:**
  - Document is in archived state
  - User has delete permission for the category
- **Trigger:** User clicks "Delete Permanently" on an archived document

**Main Success Flow:**

1. User views archived documents
2. User clicks "Delete Permanently"
3. System requires confirmation: "This action is irreversible."
4. User confirms
5. System validates document is archived
6. System validates HR can only delete non-sensitive categories
7. System soft-deletes record (marks deleted, retains in storage for 90 days per BR-DOC-006)
8. After 90-day retention: background job permanently removes file from storage
9. System creates audit event

**Alternative Flows:**

- **AF-1: Owner deleting sensitive** — Allowed (Owner can delete any)

**Failure Flows:**

- **FF-1: Not archived** — "Document must be archived before deletion"
- **FF-2: HR deleting sensitive category** — 403 "Cannot delete sensitive documents"
- **FF-3: Permission denied** — 403

**Business Rules:** BR-DOC-006
**Required Permissions:** document.delete (Owner: any; HR Admin: non-sensitive only)
**Data Created/Modified:** Document marked deleted, file removed after retention period
**Notifications:** None
**Audit Events:** `document.deleted` — actor, document_id (permanent audit record)
**Security Considerations:**
- Two-step deletion (archive → delete) prevents accidents
- 90-day retention for recovery
- HR cannot delete sensitive documents
- Audit record persists permanently

**Acceptance Criteria:**
1. Only archived documents can be deleted
2. 90-day retention before permanent removal
3. HR blocked from sensitive document deletion
4. Confirmation required
5. Permanent audit record created
6. Two-step process enforced

**Priority:** P1
**Related Use Cases:** DOC-006

---

### DOC-008: Control Document Visibility

- **ID:** DOC-008
- **Name:** Control Document Visibility
- **Goal:** System enforces category-based visibility rules for documents
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Document category has visibility configuration
- **Trigger:** Any document access attempt

**Main Success Flow:**

1. User requests to view/download a document
2. System loads document's category configuration
3. System checks category sensitivity level and visibility setting
4. For normal/employee-visible: employee can see own, HR sees all
5. For sensitive/HR-only: only HR/Owner can access
6. System grants or denies access based on rules
7. Sensitive access is audited

**Alternative Flows:**

- **AF-1: Manager access** — Sees direct reports' non-sensitive documents only
- **AF-2: Category visibility changed** — Takes effect immediately for future access

**Failure Flows:**

- **FF-1: Employee accessing sensitive** — 403 (document not shown in list at all)
- **FF-2: Manager accessing sensitive** — 403

**Business Rules:** BR-DOC-004
**Required Permissions:** document.read.sensitive (Owner, HR conditional)
**Data Created/Modified:** None (access control)
**Notifications:** None
**Audit Events:** Sensitive access logged
**Security Considerations:**
- Category-level access control
- Sensitive documents hidden from listings (not just blocked on download)
- HR access to sensitive may be org-setting-controlled

**Acceptance Criteria:**
1. Normal categories visible to employee (own documents)
2. Sensitive categories hidden from employees entirely
3. HR sees all categories
4. Manager sees team non-sensitive only
5. Category visibility changes take effect immediately

**Priority:** P0
**Related Use Cases:** DOC-001, DOC-003, DOC-004

---


### DOC-009: Track Document Expiry

- **ID:** DOC-009
- **Name:** Track Document Expiry
- **Goal:** System monitors document expiry dates and sends proactive notifications
- **Primary Actor:** System (automated)
- **Supporting Actors:** HR, Employee
- **Preconditions:**
  - Documents exist with expiry dates set
- **Trigger:** Scheduled daily job

**Main Success Flow:**

1. System runs daily expiry check
2. System identifies documents expiring within 30 days (BR-DOC-005)
3. System sends notification to HR and employee: "[Document] expires on [date]"
4. System identifies already-expired documents
5. System flags expired documents with "Expired" badge
6. Expired documents are NOT auto-deleted

**Alternative Flows:**

- **AF-1: 30-day notification** — First alert at 30 days
- **AF-2: 7-day notification** — Reminder at 7 days if not renewed
- **AF-3: Document replaced before expiry** — New document clears expiry flag

**Failure Flows:**

- **FF-1: No expiry date set** — Document excluded from monitoring

**Business Rules:** BR-DOC-005
**Required Permissions:** System (automated)
**Data Created/Modified:** Notification records created, expiry flag set
**Notifications:** HR and employee notified at 30 days and 7 days before expiry
**Audit Events:** None (routine system action)
**Security Considerations:**
- Only sends to users with accounts (BR-NOTIF-001)
- Deduplication prevents daily spam for same document

**Acceptance Criteria:**
1. 30-day advance notification sent
2. 7-day reminder sent
3. Expired documents flagged (not deleted)
4. HR and employee both notified
5. Documents without expiry excluded
6. Deduplication prevents repeated alerts

**Priority:** P1
**Related Use Cases:** DOC-002, DOC-010

---

### DOC-010: View Expiring Documents Report

- **ID:** DOC-010
- **Name:** View Expiring Documents Report
- **Goal:** HR views a report of documents approaching or past expiry
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Documents with expiry dates exist
- **Trigger:** HR navigates to Documents > Expiring

**Main Success Flow:**

1. HR navigates to Documents > Expiring
2. System displays documents grouped: expired, expiring within 7 days, expiring within 30 days
3. Each entry shows: document name, employee, category, expiry date, days until/since expiry
4. HR can click through to employee profile to handle renewal
5. Export option available

**Alternative Flows:**

- **AF-1: Filter by category** — Show only specific categories (e.g., certifications)
- **AF-2: Dashboard widget** — Count of expiring documents on admin dashboard

**Failure Flows:**

- **FF-1: No expiring documents** — "All documents are current"

**Business Rules:** BR-DOC-005
**Required Permissions:** document.read.all (Owner, HR Administrator)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Only HR/Owner access

**Acceptance Criteria:**
1. Grouped by urgency (expired, 7-day, 30-day)
2. Employee link for each document
3. Filterable by category
4. Export available
5. Dashboard widget shows count

**Priority:** P1
**Related Use Cases:** DOC-009

---

### DOC-011: Validate File Upload

- **ID:** DOC-011
- **Name:** Validate File Upload
- **Goal:** System ensures uploaded files meet security and format requirements
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - File submitted for upload
- **Trigger:** Any file upload attempt

**Main Success Flow:**

1. File received by server
2. System checks file size ≤ 10MB (BR-DOC-002)
3. System reads file magic bytes (first few bytes)
4. System verifies magic bytes match claimed MIME type (BR-DOC-001)
5. System checks extension is in allowed list (PDF, JPG, PNG, DOCX, XLSX)
6. System passes validation; upload proceeds

**Alternative Flows:**

- **AF-1: SVG upload (branding)** — Additional sanitization for XSS prevention

**Failure Flows:**

- **FF-1: Size exceeded** — 422 "File exceeds 10MB limit"
- **FF-2: Type not allowed** — 422 "File type not permitted"
- **FF-3: Magic byte mismatch** — 422 "File content doesn't match extension"
- **FF-4: Corrupted file** — 422 "File appears to be corrupted"

**Business Rules:** BR-DOC-001, BR-DOC-002
**Required Permissions:** Depends on upload context
**Data Created/Modified:** None (validation step)
**Notifications:** None
**Audit Events:** Failed uploads logged for security monitoring
**Security Considerations:**
- Magic byte check prevents disguised executables
- Server-side enforcement (client checks are advisory)
- Failed attempts logged

**Acceptance Criteria:**
1. Valid files pass all checks
2. Magic byte mismatch detected
3. Size limit enforced server-side
4. Extension whitelist enforced
5. Failed attempts logged for security

**Priority:** P0
**Related Use Cases:** DOC-002, DOC-005

---

### DOC-012: Handle Upload Size Limit

- **ID:** DOC-012
- **Name:** Handle Upload Size Limit
- **Goal:** System rejects files exceeding the maximum allowed size
- **Primary Actor:** System
- **Supporting Actors:** User (informed)
- **Preconditions:**
  - File larger than 10MB submitted
- **Trigger:** File upload attempted with oversized file

**Main Success Flow:**

1. User selects a file > 10MB
2. Client-side pre-check warns user (advisory)
3. If bypassed, server receives upload
4. Server checks Content-Length or stream size
5. Server rejects: "File exceeds maximum size of 10MB"
6. No partial file stored

**Alternative Flows:**

- **AF-1: Client-side early rejection** — JavaScript checks file size before upload starts

**Failure Flows:**

- **FF-1: Chunked upload bypass** — Server tracks total received bytes regardless of chunking

**Business Rules:** BR-DOC-002
**Required Permissions:** None (validation logic)
**Data Created/Modified:** None (rejected)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Server-side enforcement prevents client bypass
- Prevents storage abuse and DoS via large uploads
- Early rejection saves bandwidth

**Acceptance Criteria:**
1. Files > 10MB rejected server-side
2. Client-side pre-check provides early feedback
3. No partial files stored
4. Clear error message with size limit stated

**Priority:** P0
**Related Use Cases:** DOC-002, DOC-011

---

### DOC-013: Search Documents

- **ID:** DOC-013
- **Name:** Search Documents
- **Goal:** User searches for documents by name, category, or employee
- **Primary Actor:** HR Administrator, Owner, Employee (own)
- **Supporting Actors:** None
- **Preconditions:**
  - Documents exist in the organisation
- **Trigger:** User types in document search box

**Main Success Flow:**

1. User types in document search field
2. System searches document names, descriptions, categories, and employee names
3. Results filtered by user's permission scope
4. System displays matching documents with employee, category, and date
5. User can click through to document or employee

**Alternative Flows:**

- **AF-1: Employee searching** — Results limited to own documents
- **AF-2: Filter by category** — Combined with search query
- **AF-3: No results** — "No documents match your search"

**Failure Flows:**

- **FF-1: Permission enforcement** — Results never include documents outside user's scope

**Business Rules:** BR-DOC-004, BR-ORG-001
**Required Permissions:** document.read.own (employee) / document.read.all (HR/Owner)
**Data Created/Modified:** None
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Search results respect visibility rules
- Employee never sees other employees' documents
- Tenant-scoped

**Acceptance Criteria:**
1. Search by name, description, category
2. Results scoped to user's permission
3. Employee sees only own documents
4. HR sees all documents
5. Category filtering works with search

**Priority:** P1
**Related Use Cases:** DOC-003, DOC-008

---

## Payroll Module

---

### PAY-001: Create Payroll Period

- **ID:** PAY-001
- **Name:** Create Payroll Period
- **Goal:** HR creates a new payroll period (monthly cycle) for processing
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - No overlapping active payroll period exists
  - User is authenticated as Owner or HR Administrator
- **Trigger:** HR clicks "Create Period" in payroll management

**Main Success Flow:**

1. HR navigates to Payroll > Periods
2. HR clicks "Create Period"
3. System suggests next logical period (e.g., March 2024 if Feb is complete)
4. HR confirms or adjusts: start date, end date, label
5. System validates no overlap with existing periods
6. System creates PayrollPeriod record (status: Draft)
7. System displays success

**Alternative Flows:**

- **AF-1: Auto-suggestion** — System pre-fills next sequential month
- **AF-2: Custom period** — Non-monthly periods supported (bi-weekly, etc.)

**Failure Flows:**

- **FF-1: Overlapping period** — "A payroll period already exists for these dates"
- **FF-2: Permission denied** — 403

**Business Rules:** BR-PAY-004
**Required Permissions:** payroll.period.write (Owner, HR Administrator)
**Data Created/Modified:** PayrollPeriod record created (status: Draft)
**Notifications:** None
**Audit Events:** `payroll_period.created` — actor, period dates
**Security Considerations:**
- Sequential validation prevents overlaps
- Only HR/Owner access
- Tenant-scoped

**Acceptance Criteria:**
1. Period created with Draft status
2. No overlapping periods allowed
3. Next period auto-suggested
4. Start/end dates configurable
5. Audit logged

**Priority:** P0
**Related Use Cases:** PAY-002, PAY-009

---


### PAY-002: Generate Payroll Records

- **ID:** PAY-002
- **Name:** Generate Payroll Records
- **Goal:** System generates individual payroll records for all active employees in a period
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** System
- **Preconditions:**
  - Payroll period exists in Draft status
  - Active employees exist with compensation configured
- **Trigger:** HR clicks "Generate Records" on a draft payroll period

**Main Success Flow:**

1. HR opens a Draft payroll period
2. HR clicks "Generate Records"
3. System identifies all active employees (BR-PAY-006)
4. For each employee with compensation data:
   a. System creates PayrollRecord with base salary from compensation
   b. System adds configured allowances
   c. System calculates gross pay (salary + allowances)
5. System displays: "[N] payroll records generated"
6. HR can now edit individual records

**Alternative Flows:**

- **AF-1: Employee without compensation** — Skipped with warning to HR
- **AF-2: Mid-period joiner** — Pro-rata calculation based on start date
- **AF-3: Re-generate** — Regenerates only missing records (doesn't overwrite edited ones)

**Failure Flows:**

- **FF-1: No active employees** — "No active employees with compensation data"
- **FF-2: Period not in Draft** — "Records can only be generated for Draft periods"
- **FF-3: Deactivated employee** — Excluded per BR-PAY-006

**Business Rules:** BR-PAY-006, BR-PAY-001
**Required Permissions:** payroll.record.write (Owner, HR Administrator)
**Data Created/Modified:** PayrollRecord records created for each eligible employee
**Notifications:** None
**Audit Events:** `payroll_records.generated` — actor, period, count
**Security Considerations:**
- Only active employees included
- Decimal-safe arithmetic (BR-PAY-001)
- Organisation-scoped

**Acceptance Criteria:**
1. Records generated for all active employees with compensation
2. Base salary and allowances populated
3. Employees without compensation flagged
4. Pro-rata for mid-period joiners
5. Deactivated employees excluded
6. Decimal-safe calculations

**Priority:** P0
**Related Use Cases:** PAY-001, PAY-003, PAY-004

---

### PAY-003: Add Earnings Line

- **ID:** PAY-003
- **Name:** Add Earnings Line
- **Goal:** HR adds an additional earning (bonus, overtime, commission) to an employee's payroll record
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Payroll record exists in editable period (Draft or Under Review)
- **Trigger:** HR clicks "Add Earning" on a payroll record

**Main Success Flow:**

1. HR opens an employee's payroll record
2. HR clicks "Add Earning"
3. System displays form: type (bonus/overtime/commission/other), description, amount
4. HR enters details
5. System validates amount is positive and decimal-safe
6. System adds earning line to payroll record
7. System recalculates gross pay
8. System displays updated totals

**Alternative Flows:**

- **AF-1: Multiple earnings** — Add several lines (different bonuses, etc.)
- **AF-2: Remove earning** — Delete a previously added line

**Failure Flows:**

- **FF-1: Period not editable** — "Payroll period is not in an editable state"
- **FF-2: Negative amount** — "Amount must be positive"

**Business Rules:** BR-PAY-001, BR-PAY-004
**Required Permissions:** payroll.record.write
**Data Created/Modified:** PayrollEarningLine created, PayrollRecord.grossPay recalculated
**Notifications:** None
**Audit Events:** `payroll_record.earning_added` — actor, employee, amount, type
**Security Considerations:**
- Decimal-safe arithmetic
- Period state enforcement
- Only HR/Owner access

**Acceptance Criteria:**
1. Earning line added with type and amount
2. Gross pay recalculated
3. Only in editable periods
4. Positive amounts only
5. Audit logged

**Priority:** P0
**Related Use Cases:** PAY-002, PAY-004

---

### PAY-004: Add Deduction Line

- **ID:** PAY-004
- **Name:** Add Deduction Line
- **Goal:** HR adds a deduction (tax, insurance, loan repayment) to an employee's payroll record
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Payroll record exists in editable period
- **Trigger:** HR clicks "Add Deduction" on a payroll record

**Main Success Flow:**

1. HR opens an employee's payroll record
2. HR clicks "Add Deduction"
3. System displays form: type (tax/insurance/loan/other), description, amount
4. HR enters details
5. System validates amount is positive and decimal-safe
6. System adds deduction line to payroll record
7. System recalculates net pay (gross - total deductions)
8. System displays updated totals

**Alternative Flows:**

- **AF-1: Percentage-based deduction** — Calculate from gross (V2; V1 is fixed amounts)
- **AF-2: Remove deduction** — Delete a previously added line

**Failure Flows:**

- **FF-1: Period not editable** — Validation error
- **FF-2: Net pay goes negative** — Warning shown (allowed but flagged)

**Business Rules:** BR-PAY-001, BR-PAY-004
**Required Permissions:** payroll.record.write
**Data Created/Modified:** PayrollDeductionLine created, PayrollRecord.netPay recalculated
**Notifications:** None
**Audit Events:** `payroll_record.deduction_added` — actor, employee, amount, type
**Security Considerations:**
- Decimal-safe arithmetic
- Net pay validation (warn if negative)

**Acceptance Criteria:**
1. Deduction line added with type and amount
2. Net pay recalculated
3. Warning if net pay goes negative
4. Only in editable periods
5. Audit logged

**Priority:** P0
**Related Use Cases:** PAY-003, PAY-005

---

### PAY-005: Calculate Net Pay

- **ID:** PAY-005
- **Name:** Calculate Net Pay
- **Goal:** System calculates net pay from gross pay minus deductions
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Payroll record has earnings and deductions configured
- **Trigger:** Any change to earnings or deductions

**Main Success Flow:**

1. Earning or deduction is added/modified/removed
2. System recalculates gross pay = base salary + sum of all earnings
3. System recalculates total deductions = sum of all deduction lines
4. System calculates net pay = gross pay - total deductions
5. System validates equation: net = gross - deductions (BR-PAY-005)
6. System updates PayrollRecord with calculated values

**Alternative Flows:**

- **AF-1: Zero deductions** — Net = Gross
- **AF-2: Negative net** — Allowed but flagged with warning

**Failure Flows:**

- **FF-1: Arithmetic error** — System logs and prevents save (should not occur with decimal-safe math)

**Business Rules:** BR-PAY-001, BR-PAY-005
**Required Permissions:** System (automatic calculation)
**Data Created/Modified:** PayrollRecord.grossPay, totalDeductions, netPay updated
**Notifications:** None
**Audit Events:** None (part of edit flow)
**Security Considerations:**
- Integer cents arithmetic prevents floating-point drift
- Validation equation prevents approval of incorrect records

**Acceptance Criteria:**
1. Net = Gross - Deductions always holds
2. Decimal-safe arithmetic (no floating point errors)
3. Negative net pay flagged
4. Recalculates on every change
5. Validation prevents inconsistent records from approval

**Priority:** P0
**Related Use Cases:** PAY-003, PAY-004, PAY-009

---


### PAY-006: Edit Payroll Record

- **ID:** PAY-006
- **Name:** Edit Payroll Record
- **Goal:** HR modifies an employee's payroll record (earnings, deductions, notes)
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Period is in Draft or Under Review status
- **Trigger:** HR opens and edits a payroll record

**Main Success Flow:**

1. HR opens a payroll record
2. HR modifies earnings, deductions, or notes
3. System validates period is editable (BR-PAY-004)
4. System recalculates totals with decimal-safe math (BR-PAY-001)
5. System saves changes
6. System displays updated record

**Alternative Flows:**

- **AF-1: Revert changes** — Cancel without saving

**Failure Flows:**

- **FF-1: Period not editable** — "Cannot edit records in [status] period"
- **FF-2: Concurrent edit** — Optimistic lock conflict

**Business Rules:** BR-PAY-001, BR-PAY-004, BR-DATA-004
**Required Permissions:** payroll.record.write (Owner, HR Administrator)
**Data Created/Modified:** PayrollRecord updated
**Notifications:** None
**Audit Events:** `payroll_record.updated` — actor, employee, changes
**Security Considerations:**
- Period state enforcement
- Decimal-safe arithmetic
- Optimistic locking

**Acceptance Criteria:**
1. Records editable in Draft/Under Review periods
2. Totals recalculated on save
3. Period state enforced
4. Concurrent edits detected
5. Audit logged

**Priority:** P0
**Related Use Cases:** PAY-003, PAY-004, PAY-005

---

### PAY-007: Review Payroll Period

- **ID:** PAY-007
- **Name:** Review Payroll Period
- **Goal:** HR submits payroll period for review (Draft → Under Review)
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Period is in Draft status
  - All records have valid calculations
- **Trigger:** HR clicks "Submit for Review" on a draft period

**Main Success Flow:**

1. HR reviews all records in the draft period
2. HR clicks "Submit for Review"
3. System validates all records have net pay calculated
4. System validates equation holds for all records (BR-PAY-005)
5. System transitions period status: Draft → Under Review
6. System notifies Owner/other HR admins that payroll is ready for review
7. Records remain editable during review

**Alternative Flows:**

- **AF-1: Send back to draft** — Reviewer can revert to Draft for corrections

**Failure Flows:**

- **FF-1: Validation failures** — "Cannot submit: [N] records have calculation errors"
- **FF-2: Period not in Draft** — Invalid state transition

**Business Rules:** BR-PAY-004, BR-PAY-005
**Required Permissions:** payroll.period.write
**Data Created/Modified:** PayrollPeriod.status → Under Review
**Notifications:** Notify payroll approvers
**Audit Events:** `payroll_period.submitted_for_review` — actor, period, record_count
**Security Considerations:**
- Validation prevents incorrect records from advancing
- State machine enforcement

**Acceptance Criteria:**
1. Period transitions to Under Review
2. All records validated before submission
3. Invalid records block submission
4. Approvers notified
5. Records remain editable during review

**Priority:** P0
**Related Use Cases:** PAY-006, PAY-008, PAY-009

---

### PAY-008: View Payroll Summary

- **ID:** PAY-008
- **Name:** View Payroll Summary
- **Goal:** HR views aggregate payroll figures for a period
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** None
- **Preconditions:**
  - Payroll period exists with records
- **Trigger:** HR navigates to payroll period summary

**Main Success Flow:**

1. HR opens a payroll period
2. System displays summary: total headcount, total gross, total deductions, total net, breakdown by department
3. Individual records listed below summary
4. Flagged records (negative net, missing data) highlighted
5. Comparison with previous period shown

**Alternative Flows:**

- **AF-1: Department breakdown** — Totals grouped by department
- **AF-2: Export summary** — Download as PDF/CSV

**Failure Flows:**

- **FF-1: No records** — "No payroll records in this period"

**Business Rules:** BR-PAY-001
**Required Permissions:** payroll.period.read, payroll.record.read
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Highly sensitive data; HR/Owner only
- Organisation-scoped

**Acceptance Criteria:**
1. Aggregate totals displayed
2. Department breakdown available
3. Flagged records highlighted
4. Previous period comparison
5. Export available

**Priority:** P1
**Related Use Cases:** PAY-001, PAY-009

---

### PAY-009: Approve Payroll Period

- **ID:** PAY-009
- **Name:** Approve Payroll Period
- **Goal:** Authorized approver approves payroll, locking records for publication
- **Primary Actor:** Owner (or HR if enabled)
- **Supporting Actors:** None
- **Preconditions:**
  - Period is in Under Review status
  - All records valid
  - Approver is not the preparer (separation of duties if multiple admins)
- **Trigger:** Approver clicks "Approve" on a payroll period

**Main Success Flow:**

1. Approver reviews payroll summary
2. Approver clicks "Approve"
3. System validates period is Under Review (BR-PAY-004)
4. System validates net pay equation for all records (BR-PAY-005)
5. System checks separation of duties (if multiple admins exist)
6. System transitions period: Under Review → Approved
7. Records become locked (no further editing without reopen)
8. System creates audit event

**Alternative Flows:**

- **AF-1: Reject back to Draft** — Approver sends back with comments
- **AF-2: Single admin** — Separation of duties waived

**Failure Flows:**

- **FF-1: Same person prepared and approves** — "Separation of duties: different approver required" (if multiple admins exist)
- **FF-2: Validation failure** — "Cannot approve: calculation errors exist"
- **FF-3: Period not in review** — Invalid state transition

**Business Rules:** BR-PAY-004, BR-PAY-005, BR-DATA-004
**Required Permissions:** payroll.approve (Owner; HR conditional)
**Data Created/Modified:** PayrollPeriod.status → Approved, records locked
**Notifications:** HR notified of approval
**Audit Events:** `payroll_period.approved` — actor: approver, period
**Security Considerations:**
- Separation of duties when possible
- Records locked after approval
- State machine enforcement
- Optimistic locking on period status

**Acceptance Criteria:**
1. Period transitions to Approved
2. Separation of duties enforced (if applicable)
3. All records validated
4. Records locked after approval
5. Audit logged with approver identity

**Priority:** P0
**Related Use Cases:** PAY-007, PAY-010

---

### PAY-010: Publish Payslips

- **ID:** PAY-010
- **Name:** Publish Payslips
- **Goal:** HR publishes approved payroll, making payslips visible to employees
- **Primary Actor:** HR Administrator or Owner
- **Supporting Actors:** System
- **Preconditions:**
  - Period is in Approved status
- **Trigger:** HR clicks "Publish Payslips" on an approved period

**Main Success Flow:**

1. HR clicks "Publish Payslips"
2. System validates period is Approved (BR-PAY-004)
3. System generates individual Payslip records for each employee
4. System transitions period: Approved → Published
5. Payslips become visible to employees in self-service
6. System sends notification to all employees: "Your payslip for [period] is available"
7. System creates audit event

**Alternative Flows:**

- **AF-1: Selective publish** — V2; V1 publishes all at once

**Failure Flows:**

- **FF-1: Period not approved** — "Must approve payroll before publishing"
- **FF-2: Publication failure** — Transaction rollback; retry available

**Business Rules:** BR-PAY-002, BR-PAY-004
**Required Permissions:** payroll.publish (Owner, HR Administrator)
**Data Created/Modified:** Payslip records created, period status → Published
**Notifications:** All employees notified
**Audit Events:** `payroll_period.published` — actor, period, employee_count
**Security Considerations:**
- Published payslips are immutable (BR-PAY-002)
- Bulk notification to all employees
- Highly sensitive data now accessible to employees

**Acceptance Criteria:**
1. Individual payslips generated for each employee
2. Employees can view their payslips
3. Period status → Published
4. All employees notified
5. Published payslips become immutable
6. Only approved periods can be published

**Priority:** P0
**Related Use Cases:** PAY-009, PAY-011

---


### PAY-011: View Own Payslip

- **ID:** PAY-011
- **Name:** View Own Payslip
- **Goal:** Employee views their published payslip
- **Primary Actor:** Employee (any user viewing own)
- **Supporting Actors:** None
- **Preconditions:**
  - Published payslip exists for the employee
- **Trigger:** Employee navigates to Payroll > My Payslips

**Main Success Flow:**

1. Employee navigates to "My Payslips"
2. System displays list of published payslips by period
3. Employee selects a period
4. System displays: earnings breakdown, deductions breakdown, gross pay, net pay, pay date
5. Employee can download as PDF

**Alternative Flows:**

- **AF-1: No payslips yet** — "No payslips available yet"
- **AF-2: Download PDF** — Formatted payslip document generated

**Failure Flows:**

- **FF-1: Unpublished period** — Not visible to employee

**Business Rules:** BR-PAY-002, BR-PAY-003
**Required Permissions:** payslip.read.own (all roles for own data)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None (own data access not audited)
**Security Considerations:**
- Employee sees only own payslips
- Published only; no draft/review visibility
- Sensitive data (compensation)

**Acceptance Criteria:**
1. Employee sees list of published payslips
2. Detailed breakdown available per period
3. PDF download available
4. Only own payslips visible
5. Unpublished periods hidden

**Priority:** P0
**Related Use Cases:** PAY-010, PAY-012

---

### PAY-012: Download Payslip PDF

- **ID:** PAY-012
- **Name:** Download Payslip PDF
- **Goal:** Employee downloads their payslip as a formatted PDF
- **Primary Actor:** Employee (own) or HR (any)
- **Supporting Actors:** System (PDF generation)
- **Preconditions:**
  - Published payslip exists
- **Trigger:** User clicks "Download PDF" on a payslip

**Main Success Flow:**

1. User clicks "Download PDF" on a payslip
2. System generates PDF with: company name/logo, employee name, period, earnings table, deductions table, gross, net, payment method
3. PDF downloaded to browser
4. Download logged for HR-accessed payslips

**Alternative Flows:**

- **AF-1: HR downloading for employee** — Allowed for all employees
- **AF-2: Bulk download** — V2 feature

**Failure Flows:**

- **FF-1: PDF generation failure** — "Unable to generate PDF. Please try again."

**Business Rules:** BR-PAY-002, BR-PAY-003
**Required Permissions:** payslip.read.own (employee), payroll.record.read (HR)
**Data Created/Modified:** None
**Notifications:** None
**Audit Events:** `payslip.downloaded` (if HR downloading another employee's)
**Security Considerations:**
- PDF contains sensitive compensation data
- Employee can only download own
- HR access logged

**Acceptance Criteria:**
1. PDF generated with full payslip details
2. Company branding included
3. Employee can download own
4. HR can download any
5. HR access is audited

**Priority:** P1
**Related Use Cases:** PAY-011

---

### PAY-013: Reopen Published Payroll

- **ID:** PAY-013
- **Name:** Reopen Published Payroll
- **Goal:** Owner reopens a published payroll period to make corrections (exceptional case)
- **Primary Actor:** Owner only
- **Supporting Actors:** None
- **Preconditions:**
  - Period is in Published status
  - User is the Owner
  - Mandatory justification provided
- **Trigger:** Owner clicks "Reopen" on a published period (Danger Zone action)

**Main Success Flow:**

1. Owner navigates to published period > Danger Zone
2. Owner clicks "Reopen Period"
3. System displays warning: "This is a compliance-sensitive action. Published payslips will be retracted from employees."
4. System requires mandatory justification reason (BR-PAY-007)
5. Owner enters reason and confirms
6. System transitions period: Published → Under Review
7. System retracts payslips from employee self-service
8. Records become editable again
9. High-severity audit event created

**Alternative Flows:**

- **AF-1: HR Admin attempts** — 403 (Owner only for published periods)

**Failure Flows:**

- **FF-1: No reason** — "Justification is required for reopening published payroll"
- **FF-2: Permission denied** — Only Owner can reopen published
- **FF-3: Period not published** — Invalid state transition

**Business Rules:** BR-PAY-002, BR-PAY-007, BR-PAY-004
**Required Permissions:** payroll.period.write (Owner only for reopen)
**Data Created/Modified:** Period status → Under Review, payslips retracted
**Notifications:** Employees notified payslip is under revision
**Audit Events:** `payroll_period.reopened` — actor: Owner, reason, severity: HIGH
**Security Considerations:**
- Owner-only action (highest privilege)
- Mandatory justification
- High-severity audit event for compliance
- Published payslips retracted from view

**Acceptance Criteria:**
1. Only Owner can reopen published periods
2. Mandatory justification recorded
3. High-severity audit event created
4. Payslips retracted from employee view
5. Records become editable
6. Employees notified

**Priority:** P1
**Related Use Cases:** PAY-010, PAY-009

---

### PAY-014: Restrict Payroll Access

- **ID:** PAY-014
- **Name:** Restrict Payroll Access
- **Goal:** System enforces that only Owner and HR Administrator can access payroll management
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Any payroll operation attempted
- **Trigger:** Non-authorized user attempts payroll access

**Main Success Flow:**

1. User attempts to access payroll section
2. System checks role: Owner or HR Administrator required
3. If authorized: access granted
4. If not: 403 returned, user redirected to appropriate dashboard

**Alternative Flows:**

- **AF-1: Employee accessing own payslip** — Allowed (different permission: payslip.read.own)
- **AF-2: Manager accessing team payroll** — 403 (managers cannot see compensation)

**Failure Flows:**

- **FF-1: Manager/Employee accessing payroll admin** — 403 "Insufficient permissions"

**Business Rules:** BR-PAY-003
**Required Permissions:** payroll.period.read, payroll.record.read (Owner, HR Admin only)
**Data Created/Modified:** None (access control)
**Notifications:** None
**Audit Events:** Permission denied attempts logged
**Security Considerations:**
- Compensation data is most sensitive in the system
- Manager explicitly excluded from any payroll data
- Server-side enforcement mandatory

**Acceptance Criteria:**
1. Only Owner and HR Admin can access payroll admin
2. Manager cannot see any payroll data (including team)
3. Employee can only see own published payslips
4. 403 returned for unauthorized access
5. Denied attempts logged

**Priority:** P0
**Related Use Cases:** PAY-001 through PAY-013

---

### PAY-015: Validate Payroll Calculations

- **ID:** PAY-015
- **Name:** Validate Payroll Calculations
- **Goal:** System ensures all payroll arithmetic is decimal-safe and internally consistent
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Payroll records with earnings and deductions
- **Trigger:** Any payroll calculation or state transition

**Main Success Flow:**

1. System performs payroll calculation
2. All amounts stored as integer cents (e.g., $1234.56 → 123456)
3. Sum of earnings = gross pay (validated)
4. Gross - deductions = net pay (validated per BR-PAY-005)
5. No floating-point arithmetic used
6. Results consistent to the cent

**Alternative Flows:**

- **AF-1: Currency with 0 decimals** — JPY stored as whole units
- **AF-2: Display formatting** — Cents converted to display format at presentation layer

**Failure Flows:**

- **FF-1: Inconsistency detected** — Block state transition; flag record for correction

**Business Rules:** BR-PAY-001, BR-PAY-005
**Required Permissions:** System (automated validation)
**Data Created/Modified:** None (validation)
**Notifications:** HR notified if inconsistency found
**Audit Events:** `payroll.validation_failure` — if inconsistency detected
**Security Considerations:**
- Integer cents storage prevents rounding attacks
- Validation at every calculation point
- Cannot advance with inconsistent records

**Acceptance Criteria:**
1. All arithmetic uses integer cents
2. No floating-point drift in calculations
3. Gross = sum of earnings + base salary
4. Net = gross - deductions
5. Inconsistencies block state transitions
6. Currency-appropriate decimal handling

**Priority:** P0
**Related Use Cases:** PAY-005, PAY-009

---

## Notifications Module

---

### NOTIF-001: Create In-App Notification

- **ID:** NOTIF-001
- **Name:** Create In-App Notification
- **Goal:** System creates an in-app notification for a user based on a triggering event
- **Primary Actor:** System
- **Supporting Actors:** None
- **Preconditions:**
  - Triggering event has occurred
  - Target recipient has a User account (BR-NOTIF-001)
- **Trigger:** Domain event (leave approved, task assigned, payslip published, etc.)

**Main Success Flow:**

1. Domain event occurs (e.g., leave request approved)
2. System resolves notification recipient(s) via User accounts (BR-NOTIF-001)
3. System checks deduplication window (BR-NOTIF-002)
4. System creates Notification record: type, title, body, link, recipient, org_id, read=false
5. Notification appears in recipient's notification panel
6. Unread count badge updates in real-time

**Alternative Flows:**

- **AF-1: Multiple recipients** — Creates individual notification per recipient
- **AF-2: No User account** — Skip notification (BR-NOTIF-001)
- **AF-3: Real-time delivery** — WebSocket push for immediate display (V2; V1 uses polling)

**Failure Flows:**

- **FF-1: Deduplication hit** — Same event within 5 minutes: notification suppressed (BR-NOTIF-002)
- **FF-2: Recipient deactivated** — Notification not created

**Business Rules:** BR-NOTIF-001, BR-NOTIF-002, BR-NOTIF-003
**Required Permissions:** System (internal)
**Data Created/Modified:** Notification record created
**Notifications:** Self (this IS the notification creation)
**Audit Events:** None (routine system action)
**Security Considerations:**
- Notifications tenant-scoped (BR-NOTIF-003)
- Only Users (not Employees without accounts) receive notifications
- Deduplication prevents spam

**Acceptance Criteria:**
1. Notifications created for relevant events
2. Only users with accounts receive them
3. Deduplication prevents duplicates within 5 minutes
4. Notification scoped to organisation
5. Unread count updates
6. Deactivated users excluded

**Priority:** P0
**Related Use Cases:** NOTIF-002, NOTIF-003

---



### NOTIF-002: Mark Notification as Read

- **ID:** NOTIF-002
- **Name:** Mark Notification as Read
- **Goal:** User marks a notification as read to clear unread state
- **Primary Actor:** Any authenticated user
- **Preconditions:**
  - Notification exists and belongs to user
  - Notification is currently unread
- **Trigger:** User clicks notification or "Mark as Read"

**Main Success Flow:**

1. User clicks a notification in their notification panel
2. System validates notification belongs to this user
3. System sets Notification.readAt = now
4. Unread badge count decrements
5. If clicked: user is navigated to the linked resource
6. Notification remains in history (read state)

**Alternative Flows:**

- **AF-1: Mark all as read** — User clicks "Mark All Read"; all unread notifications for current org updated
- **AF-2: Already read** — No-op; idempotent

**Failure Flows:**

- **FF-1: Notification not found** — 404
- **FF-2: Cross-user attempt** — 403

**Business Rules:** BR-NOTIF-003
**Required Permissions:** Authenticated (own notifications only)
**Data Created/Modified:** Notification.readAt set
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- User can only mark own notifications
- Organisation-scoped

**Acceptance Criteria:**
1. Individual notification can be marked read
2. Mark all read works for current org
3. Unread count updates immediately
4. Click-through navigates to linked resource
5. Idempotent operation

**Priority:** P0
**Related Use Cases:** NOTIF-001, NOTIF-003

---



### NOTIF-003: View Notification List

- **ID:** NOTIF-003
- **Name:** View Notification List
- **Goal:** User views their notifications (read and unread)
- **Primary Actor:** Any authenticated user
- **Preconditions:**
  - User is authenticated
- **Trigger:** User clicks notification bell icon

**Main Success Flow:**

1. User clicks notification bell in navigation
2. System retrieves notifications for user in current organisation (BR-NOTIF-003)
3. System displays recent notifications (latest 20) with unread first
4. Each shows: title, body preview, timestamp, read/unread indicator
5. User can scroll/paginate for older notifications
6. Unread count shown on bell icon

**Alternative Flows:**

- **AF-1: No notifications** — "No notifications yet"
- **AF-2: Paginate older** — Load more button for history

**Failure Flows:**

- **FF-1: Session expired** — Redirect to login

**Business Rules:** BR-NOTIF-003
**Required Permissions:** Authenticated (own)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Scoped to current organisation context
- Only own notifications visible

**Acceptance Criteria:**
1. Recent notifications displayed
2. Unread count shown on bell icon
3. Scoped to current organisation
4. Pagination for older notifications
5. Timestamp and read state visible

**Priority:** P0
**Related Use Cases:** NOTIF-001, NOTIF-002

---



### NOTIF-004: Send Email Notification

- **ID:** NOTIF-004
- **Name:** Send Email Notification
- **Goal:** System sends email notifications for high-priority events (invitations, password reset, payslips)
- **Primary Actor:** System
- **Preconditions:**
  - Triggering event requires email delivery
  - Recipient has a valid email address
- **Trigger:** Domain event flagged for email delivery

**Main Success Flow:**

1. Domain event occurs requiring email (e.g., invitation, password reset, payslip published)
2. System resolves recipient email address
3. System selects email template based on event type
4. System renders template with event data
5. System queues email for delivery
6. Email service sends the message
7. Delivery status recorded

**Alternative Flows:**

- **AF-1: Delivery failure** — Retry up to 3 times with exponential backoff
- **AF-2: Bounce** — Mark email as undeliverable; do not retry

**Failure Flows:**

- **FF-1: No email address** — Skip email; log warning
- **FF-2: Email service down** — Queue holds; retries on service recovery
- **FF-3: Invalid email** — Bounce handling; mark undeliverable

**Business Rules:** BR-NOTIF-001
**Required Permissions:** System (internal)
**Data Created/Modified:** Email delivery record created
**Notifications:** Self (this IS the email)
**Audit Events:** None (routine)
**Security Considerations:**
- Never include sensitive data in email body (link to app instead)
- Rate-limit per recipient
- Unsubscribe not applicable for transactional emails

**Acceptance Criteria:**
1. Emails sent for configured event types
2. Templates render correctly
3. Retry on transient failures (3 attempts)
4. Bounces handled gracefully
5. Sensitive data not included in email body

**Priority:** P0
**Related Use Cases:** NOTIF-001, AUTH-001, AUTH-005

---



### NOTIF-005: Deduplicate Notifications

- **ID:** NOTIF-005
- **Name:** Deduplicate Notifications
- **Goal:** System prevents duplicate notifications from being sent within a short window
- **Primary Actor:** System
- **Preconditions:**
  - Event triggers notification creation
  - Similar notification exists within deduplication window
- **Trigger:** Notification creation attempt

**Main Success Flow:**

1. System receives event to create notification
2. System checks for existing notification with same type + recipient + target within 5-minute window (BR-NOTIF-002)
3. Duplicate found: notification suppressed
4. No duplicate: notification created normally

**Alternative Flows:**

- **AF-1: Different target** — Same type but different target (e.g., different leave request): not a duplicate
- **AF-2: Window expired** — Same event after 5 minutes: new notification created

**Failure Flows:**

- **FF-1: Dedup check failure** — Fail-open (create notification rather than suppress)

**Business Rules:** BR-NOTIF-002
**Required Permissions:** System (internal)
**Data Created/Modified:** Notification suppressed or created
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Fail-open prevents lost notifications
- Window is short enough to avoid user confusion

**Acceptance Criteria:**
1. Duplicate events within 5 minutes produce only one notification
2. Different targets are not considered duplicates
3. After window expires, new notification created
4. Fail-open on check failure
5. Works for both in-app and email

**Priority:** P1
**Related Use Cases:** NOTIF-001, NOTIF-004

---

### NOTIF-006: Route Notification by Role

- **ID:** NOTIF-006
- **Name:** Route Notification by Role
- **Goal:** System routes notifications to correct recipients based on event type and role
- **Primary Actor:** System
- **Preconditions:**
  - Event has defined routing rules
- **Trigger:** Domain event with notification requirement

**Main Success Flow:**

1. Domain event occurs
2. System determines notification routing rules for event type
3. System resolves recipients:
   - Leave submitted → direct manager
   - Leave approved/rejected → requesting employee
   - Payslip published → all employees
   - Onboarding task assigned → specific assignee
   - Employee deactivated → HR admins
4. System creates notifications per resolved recipient
5. Each notification scoped to correct organisation (BR-NOTIF-003)

**Alternative Flows:**

- **AF-1: Broadcast to all HR** — Events like "overdue onboarding" go to all HR admins
- **AF-2: Fallback routing** — If manager absent, route to HR

**Failure Flows:**

- **FF-1: No valid recipient** — Log warning; notification dropped
- **FF-2: Recipient deactivated** — Skip

**Business Rules:** BR-NOTIF-001, BR-NOTIF-003
**Required Permissions:** System (internal)
**Data Created/Modified:** Notification records created
**Notifications:** Self
**Audit Events:** None
**Security Considerations:**
- Organisation scoping prevents cross-tenant notifications
- Deactivated users excluded

**Acceptance Criteria:**
1. Events route to correct role-based recipients
2. Organisation scoping enforced
3. Fallback routing works when primary recipient unavailable
4. Deactivated users excluded
5. Broadcast events reach all applicable users

**Priority:** P0
**Related Use Cases:** NOTIF-001, LEAVE-005, ONB-005

---



### NOTIF-007: Handle Notification for Users Without Account

- **ID:** NOTIF-007
- **Name:** Handle Notification for Users Without Account
- **Goal:** System gracefully skips notifications for employees without linked User accounts
- **Primary Actor:** System
- **Preconditions:**
  - Event targets an employee who has no User account
- **Trigger:** Notification routing resolves to employee without User

**Main Success Flow:**

1. Event occurs targeting an employee (e.g., onboarding task assigned)
2. System resolves Employee record
3. System checks for linked User account
4. No User account found (employee is Draft or hasn't accepted invitation)
5. System skips in-app notification (BR-NOTIF-001)
6. System logs informational event
7. No error raised

**Alternative Flows:**

- **AF-1: Email available** — If employee has email but no account, email can still be sent for some event types
- **AF-2: User later created** — Historical notifications are NOT retroactively created

**Failure Flows:**

- **FF-1: None** — This is a graceful skip, not an error

**Business Rules:** BR-NOTIF-001
**Required Permissions:** System (internal)
**Data Created/Modified:** None
**Notifications:** None (skipped)
**Audit Events:** None
**Security Considerations:**
- No sensitive data exposed
- Graceful degradation

**Acceptance Criteria:**
1. No error when employee has no User account
2. In-app notification silently skipped
3. System continues processing other recipients
4. No retroactive notifications when account created later
5. Email notifications can still be attempted if email exists

**Priority:** P1
**Related Use Cases:** NOTIF-001, EMP-002

---

### NOTIF-008: Delete Old Notifications

- **ID:** NOTIF-008
- **Name:** Delete Old Notifications
- **Goal:** System cleans up old read notifications to manage storage
- **Primary Actor:** System (scheduled job)
- **Preconditions:**
  - Read notifications older than retention period exist
- **Trigger:** Scheduled weekly cleanup job

**Main Success Flow:**

1. Weekly cleanup job runs
2. System identifies read notifications older than 90 days
3. System deletes notification records in batches
4. System logs cleanup statistics
5. Unread notifications are never deleted regardless of age

**Alternative Flows:**

- **AF-1: User manually dismisses** — Immediate delete of individual notification (V2)
- **AF-2: No old notifications** — Job completes with 0 deletions

**Failure Flows:**

- **FF-1: Job failure** — Retry next scheduled run; no user impact

**Business Rules:** None specific
**Required Permissions:** System (automated)
**Data Created/Modified:** Old read notifications deleted
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Only read notifications deleted
- Unread preserved indefinitely
- Batch processing prevents DB locks

**Acceptance Criteria:**
1. Read notifications older than 90 days are deleted
2. Unread notifications never deleted
3. Batch processing prevents performance impact
4. Runs automatically on schedule
5. No user-facing impact

**Priority:** P2
**Related Use Cases:** NOTIF-002

---



### NOTIF-009: Scope Notifications to Organisation

- **ID:** NOTIF-009
- **Name:** Scope Notifications to Organisation
- **Goal:** Ensure users only see notifications relevant to their current organisation context
- **Primary Actor:** System
- **Preconditions:**
  - User has memberships in multiple organisations
- **Trigger:** User views notifications or switches organisation

**Main Success Flow:**

1. User views notification list
2. System filters notifications by current active organisation (BR-NOTIF-003)
3. Only notifications for current org displayed
4. Unread count reflects current org only
5. Switching orgs (AUTH-007) refreshes notification context

**Alternative Flows:**

- **AF-1: Cross-org badge** — V2: show combined unread across all orgs on the switcher
- **AF-2: Single org user** — All notifications shown (no filtering needed)

**Failure Flows:**

- **FF-1: Org context missing** — Default to most recent org

**Business Rules:** BR-NOTIF-003
**Required Permissions:** Authenticated
**Data Created/Modified:** None (query filter)
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Prevents cross-tenant information leakage
- Organisation ID in notification record is authoritative

**Acceptance Criteria:**
1. Notifications filtered by active organisation
2. Unread count is org-specific
3. Switching orgs updates notification view
4. No cross-org leakage
5. Multi-org users see correct context

**Priority:** P0
**Related Use Cases:** AUTH-007, NOTIF-003

---

### NOTIF-010: Notify on Critical System Events

- **ID:** NOTIF-010
- **Name:** Notify on Critical System Events
- **Goal:** System sends immediate notifications for security-sensitive or critical events
- **Primary Actor:** System
- **Preconditions:**
  - Critical event occurred (ownership transfer, payroll reopen, account disabled)
- **Trigger:** Critical domain event

**Main Success Flow:**

1. Critical event occurs (e.g., ownership transfer, payroll reopened, bulk deactivation)
2. System identifies event as high-priority
3. System sends both in-app AND email notification to affected parties
4. Notification marked as high-priority (visual distinction)
5. Email sent regardless of normal email preferences (critical override)

**Alternative Flows:**

- **AF-1: Ownership transfer** — Both old and new owner notified via email + in-app
- **AF-2: Payroll reopened** — All employees notified payslip retracted
- **AF-3: Account disabled** — No notification possible (account is disabled)

**Failure Flows:**

- **FF-1: Email delivery failure** — In-app notification still delivered; email retried

**Business Rules:** BR-NOTIF-001
**Required Permissions:** System (internal)
**Data Created/Modified:** Notification + email records created
**Notifications:** Self (dual-channel: in-app + email)
**Audit Events:** Covered by triggering event's audit
**Security Considerations:**
- Critical events bypass deduplication
- Dual-channel ensures receipt
- Cannot be suppressed by user preferences

**Acceptance Criteria:**
1. Critical events trigger both in-app and email
2. High-priority visual styling in notification panel
3. Email sent regardless of preferences
4. Dual-channel delivery for redundancy
5. Correct recipients identified per event type

**Priority:** P0
**Related Use Cases:** ORG-013, PAY-013, AUTH-009

---



## Audit Module

---

### AUDIT-001: Record Audit Event

- **ID:** AUDIT-001
- **Name:** Record Audit Event
- **Goal:** System records an immutable audit trail entry for a significant action
- **Primary Actor:** System
- **Preconditions:**
  - A domain action has occurred that requires auditing
- **Trigger:** Domain event completion (employee created, role changed, leave approved, payroll published, etc.)

**Main Success Flow:**

1. Domain action completes successfully
2. System creates AuditEvent record with: event_type, actor_id, actor_role, target_type, target_id, organisation_id, timestamp (UTC), metadata (changes, reason, IP)
3. Record is immutable (append-only, no updates or deletes)
4. Event stored in audit-specific table/partition
5. Available for querying via audit log viewer

**Alternative Flows:**

- **AF-1: System-triggered event** — Actor = "system" (e.g., scheduled balance recalculation)
- **AF-2: High-severity event** — Flagged for immediate attention (e.g., ownership transfer)
- **AF-3: Failed action** — Some failures also audited (e.g., permission denied attempts)

**Failure Flows:**

- **FF-1: Audit write failure** — Domain action still succeeds; audit failure logged to error monitoring; retry queued
- **FF-2: Missing actor context** — System used as fallback actor

**Business Rules:** BR-AUDIT-001, BR-AUDIT-002
**Required Permissions:** System (internal; no user triggers this directly)
**Data Created/Modified:** AuditEvent record created (immutable)
**Notifications:** None
**Audit Events:** Self (this IS the audit)
**Security Considerations:**
- Append-only; no updates or deletes ever
- Timestamp from server clock only
- Actor identity from authenticated session
- IP address captured for security events

**Acceptance Criteria:**
1. All configured domain events produce audit records
2. Records are immutable (no edit/delete API)
3. Actor, target, timestamp, and metadata captured
4. High-severity events flagged
5. Audit write failure does not block domain action

**Priority:** P0
**Related Use Cases:** AUDIT-002, AUDIT-003

---



### AUDIT-002: View Audit Log

- **ID:** AUDIT-002
- **Name:** View Audit Log
- **Goal:** Owner or HR Admin views the audit trail for the organisation
- **Primary Actor:** Owner or HR Administrator
- **Preconditions:**
  - User is authenticated as Owner or HR Administrator
  - Audit events exist
- **Trigger:** User navigates to Settings > Audit Log

**Main Success Flow:**

1. User navigates to Audit Log section
2. System retrieves audit events for the current organisation (paginated)
3. System displays: timestamp, event type, actor name, target, summary
4. Events sorted newest-first by default
5. User can paginate through history
6. Click on event shows full detail (metadata, before/after values)

**Alternative Flows:**

- **AF-1: Empty log** — "No audit events recorded yet" (unlikely in practice)
- **AF-2: Large dataset** — Server-side pagination (50 per page)

**Failure Flows:**

- **FF-1: Permission denied** — Employee/Manager: 403

**Business Rules:** BR-AUDIT-002, BR-ORG-001
**Required Permissions:** audit.read (Owner, HR Administrator)
**Data Created/Modified:** None (read-only)
**Notifications:** None
**Audit Events:** None (viewing the log is not itself audited)
**Security Considerations:**
- Only Owner/HR Admin can view audit log
- Organisation-scoped
- Sensitive metadata visible (role changes, compensation access)

**Acceptance Criteria:**
1. Audit events displayed in chronological order
2. Only Owner/HR Admin can access
3. Pagination works for large logs
4. Click-through shows full event detail
5. Organisation-scoped

**Priority:** P0
**Related Use Cases:** AUDIT-001, AUDIT-003, AUDIT-004

---

### AUDIT-003: Filter Audit Events

- **ID:** AUDIT-003
- **Name:** Filter Audit Events
- **Goal:** User filters audit log by date range, event type, actor, or target
- **Primary Actor:** Owner or HR Administrator
- **Preconditions:**
  - User has audit log access
- **Trigger:** User applies filters on audit log view

**Main Success Flow:**

1. User opens audit log (AUDIT-002)
2. User selects filter criteria: date range, event type, actor, target entity
3. System applies filters server-side
4. Filtered results displayed
5. Active filters shown as badges
6. Result count updated

**Alternative Flows:**

- **AF-1: Date range only** — Show events within specific period
- **AF-2: Actor filter** — Show all actions by a specific user
- **AF-3: Target filter** — Show all events affecting a specific employee
- **AF-4: Event type filter** — Show only leave approvals, or only role changes
- **AF-5: Clear filters** — Reset to unfiltered view

**Failure Flows:**

- **FF-1: No results** — "No audit events match the selected filters"

**Business Rules:** BR-AUDIT-002
**Required Permissions:** audit.read (Owner, HR Administrator)
**Data Created/Modified:** None
**Notifications:** None
**Audit Events:** None
**Security Considerations:**
- Filters applied server-side
- Cannot filter into another organisation's data

**Acceptance Criteria:**
1. Filter by date range works
2. Filter by event type works
3. Filter by actor works
4. Filter by target entity works
5. Multiple filters combinable (AND logic)
6. Clear filters resets view

**Priority:** P1
**Related Use Cases:** AUDIT-002, AUDIT-004

---



### AUDIT-004: Export Audit Log

- **ID:** AUDIT-004
- **Name:** Export Audit Log
- **Goal:** Owner exports audit log data for compliance reporting or external review
- **Primary Actor:** Owner
- **Preconditions:**
  - Audit events exist
  - User is Owner
- **Trigger:** Owner clicks "Export" on audit log

**Main Success Flow:**

1. Owner views audit log
2. Owner clicks "Export"
3. System displays options: date range, format (CSV/JSON), include metadata
4. Owner configures export and confirms
5. System generates export file with selected events
6. File downloaded to browser
7. Export action itself is audited

**Alternative Flows:**

- **AF-1: Filtered export** — Export respects active filters
- **AF-2: Full history export** — All events (may be large)

**Failure Flows:**

- **FF-1: No events in range** — "No audit events for selected period"
- **FF-2: Export too large** — "Export limited to 10,000 records. Narrow date range."
- **FF-3: HR Admin attempts** — 403 (Owner only for export)

**Business Rules:** BR-AUDIT-002
**Required Permissions:** audit.export (Owner only)
**Data Created/Modified:** None (export)
**Notifications:** None
**Audit Events:** `audit_log.exported` — actor: Owner, date_range, record_count
**Security Considerations:**
- Owner-only to prevent bulk data extraction
- Export is itself audited
- Rate-limited (max 3 per hour)
- 10,000 record cap per export

**Acceptance Criteria:**
1. CSV and JSON formats available
2. Date range filtering on export
3. Owner-only access
4. Export action is audited
5. Record cap prevents abuse
6. Rate-limited

**Priority:** P1
**Related Use Cases:** AUDIT-002, AUDIT-003

---

### AUDIT-005: Track Employee Data Changes

- **ID:** AUDIT-005
- **Name:** Track Employee Data Changes
- **Goal:** System captures before/after values for all employee record modifications
- **Primary Actor:** System
- **Preconditions:**
  - Employee record is being modified
- **Trigger:** Any write operation on employee data

**Main Success Flow:**

1. User initiates employee data change (personal, employment, status, etc.)
2. System captures current field values (before state)
3. System applies the change
4. System captures new field values (after state)
5. System creates audit event with changes: {field: {before: old, after: new}}
6. Before/after available in audit log detail view

**Alternative Flows:**

- **AF-1: Multiple fields changed** — All changes captured in single event
- **AF-2: Null to value** — Before = null, after = new value (first assignment)
- **AF-3: Sensitive field change** — Flagged as high-sensitivity audit event

**Failure Flows:**

- **FF-1: Capture failure** — Change proceeds; audit logged without diff (degraded)

**Business Rules:** BR-AUDIT-001, BR-DATA-004
**Required Permissions:** System (automatic)
**Data Created/Modified:** AuditEvent with change diff
**Notifications:** None
**Audit Events:** Self
**Security Considerations:**
- Sensitive field values masked in audit display (show "***changed***" not actual value for bank details)
- Full diff stored but display restricted
- Cannot be retroactively modified

**Acceptance Criteria:**
1. Before/after values captured for all changes
2. Multi-field changes in single event
3. Sensitive values masked in display
4. Null-to-value transitions handled
5. Available in audit detail view

**Priority:** P0
**Related Use Cases:** EMP-007, EMP-008, AUDIT-001

---



### AUDIT-006: Track Permission Changes

- **ID:** AUDIT-006
- **Name:** Track Permission Changes
- **Goal:** System records all role and permission modifications with high-severity flagging
- **Primary Actor:** System
- **Preconditions:**
  - A role change, ownership transfer, or membership modification occurs
- **Trigger:** Role change (ORG-011), ownership transfer (ORG-013), member removal (ORG-012)

**Main Success Flow:**

1. Permission-affecting action occurs
2. System creates high-severity audit event
3. Event captures: actor, target user, previous role/permission, new role/permission
4. Event flagged as security-relevant
5. Available in filtered audit view under "Security" category

**Alternative Flows:**

- **AF-1: Ownership transfer** — Highest severity; both parties recorded
- **AF-2: Role demotion** — Captures permission loss
- **AF-3: Member removal** — Captures full access revocation

**Failure Flows:**

- **FF-1: Audit write failure** — Domain action proceeds; failure logged

**Business Rules:** BR-AUDIT-001
**Required Permissions:** System (automatic)
**Data Created/Modified:** AuditEvent (high severity)
**Notifications:** None (separate from notification system)
**Audit Events:** Self
**Security Considerations:**
- All permission changes are high-severity
- Cannot be suppressed or filtered out
- Supports compliance investigation

**Acceptance Criteria:**
1. All role changes produce high-severity audit events
2. Previous and new roles captured
3. Ownership transfers logged with both parties
4. Member removals logged
5. Filterable by "Security" category

**Priority:** P0
**Related Use Cases:** ORG-011, ORG-012, ORG-013, AUDIT-001

---

### AUDIT-007: Track Payroll Actions

- **ID:** AUDIT-007
- **Name:** Track Payroll Actions
- **Goal:** System records all payroll lifecycle events for financial compliance
- **Primary Actor:** System
- **Preconditions:**
  - Payroll action occurs (create, generate, approve, publish, reopen)
- **Trigger:** Any payroll state transition or record modification

**Main Success Flow:**

1. Payroll action occurs (period created, records generated, approved, published, reopened)
2. System creates audit event with payroll-specific metadata
3. For state transitions: captures before/after status
4. For record edits: captures amount changes
5. For reopen: captures mandatory justification (BR-PAY-007)
6. All payroll audit events tagged as "financial" category

**Alternative Flows:**

- **AF-1: Record edit** — Captures old/new amounts
- **AF-2: Period reopen** — High-severity with justification reason

**Failure Flows:**

- **FF-1: Audit failure** — Payroll action proceeds; failure escalated

**Business Rules:** BR-AUDIT-001, BR-PAY-007
**Required Permissions:** System (automatic)
**Data Created/Modified:** AuditEvent (financial category)
**Notifications:** None
**Audit Events:** Self
**Security Considerations:**
- Financial audit events require long-term retention
- Reopen justification permanently recorded
- Supports financial audit requirements

**Acceptance Criteria:**
1. All payroll state transitions audited
2. Amount changes captured with before/after
3. Reopen events capture justification
4. Tagged as financial category
5. Supports compliance filtering

**Priority:** P0
**Related Use Cases:** PAY-001 through PAY-013, AUDIT-001

---



### AUDIT-008: Track Sensitive Data Access

- **ID:** AUDIT-008
- **Name:** Track Sensitive Data Access
- **Goal:** System logs when authorized users access sensitive employee data
- **Primary Actor:** System
- **Preconditions:**
  - User accesses compensation, national ID, or bank details
  - User has permission to view this data
- **Trigger:** Authorized read of sensitive fields

**Main Success Flow:**

1. Authorized user views employee profile with sensitive fields
2. System detects sensitive fields are included in response (compensation, national ID, bank details)
3. System creates audit event: actor, target employee, fields accessed
4. Event available in audit log for compliance review
5. No impact on user experience (transparent logging)

**Alternative Flows:**

- **AF-1: Employee viewing own data** — Not audited (own data access is routine)
- **AF-2: HR viewing compensation** — Audited
- **AF-3: Owner viewing bank details** — Audited

**Failure Flows:**

- **FF-1: Audit write failure** — Data still served; failure logged separately

**Business Rules:** BR-AUDIT-001, BR-PERM-004
**Required Permissions:** System (automatic)
**Data Created/Modified:** AuditEvent for sensitive access
**Notifications:** None
**Audit Events:** `employee.sensitive_field_accessed` — actor, target, fields
**Security Considerations:**
- Own-data access not audited (would be noisy)
- Supports data protection compliance (GDPR-style)
- Cannot be disabled

**Acceptance Criteria:**
1. Sensitive field access logged for non-self viewers
2. Own-data access excluded from logging
3. Fields accessed are identified specifically
4. Transparent to the accessing user
5. Available for compliance reporting

**Priority:** P0
**Related Use Cases:** EMP-016, AUDIT-001

---

### AUDIT-009: Ensure Audit Immutability

- **ID:** AUDIT-009
- **Name:** Ensure Audit Immutability
- **Goal:** System prevents any modification or deletion of audit records
- **Primary Actor:** System (architecture enforcement)
- **Preconditions:**
  - Audit records exist in the system
- **Trigger:** Any attempt to modify or delete audit data

**Main Success Flow:**

1. System architecture enforces append-only on audit table
2. No UPDATE or DELETE operations exposed via API
3. No administrative endpoint exists for audit modification
4. Database-level constraints prevent direct modification
5. Audit records accumulate indefinitely (retention managed by archival, not deletion)

**Alternative Flows:**

- **AF-1: Archival** — Old events moved to cold storage after retention period (preserving, not deleting)
- **AF-2: Database migration** — Schema migrations add columns but never remove data

**Failure Flows:**

- **FF-1: Direct DB access attempt** — Database permissions prevent non-INSERT on audit tables
- **FF-2: API attempt** — No endpoint exists; returns 404/405

**Business Rules:** BR-AUDIT-001
**Required Permissions:** N/A (no modification possible)
**Data Created/Modified:** None (enforcement mechanism)
**Notifications:** None
**Audit Events:** N/A
**Security Considerations:**
- Append-only at database level (no UPDATE/DELETE grants)
- No API endpoint for modification
- Critical for legal admissibility
- Tampering detection via checksums (V2)

**Acceptance Criteria:**
1. No API exists to modify or delete audit events
2. Database permissions enforce append-only
3. Records persist indefinitely
4. Archival preserves data (no deletion)
5. Verified via integration test attempting update/delete

**Priority:** P0
**Related Use Cases:** AUDIT-001

---

### AUDIT-010: Audit Retention and Archival

- **ID:** AUDIT-010
- **Name:** Audit Retention and Archival
- **Goal:** System manages long-term audit data retention and archival to cold storage
- **Primary Actor:** System (scheduled job)
- **Preconditions:**
  - Audit records older than active retention period exist
- **Trigger:** Monthly archival job

**Main Success Flow:**

1. Monthly archival job runs
2. System identifies audit events older than active retention (e.g., 12 months)
3. System copies events to archival/cold storage
4. System marks events as archived (but does NOT delete from primary)
5. Archived events remain queryable via "Include Archived" filter (with slower response)
6. System logs archival statistics

**Alternative Flows:**

- **AF-1: No events to archive** — Job completes with 0 actions
- **AF-2: Query archived events** — User enables "Include Archived" toggle; system queries cold storage
- **AF-3: Compliance hold** — Specific org events exempt from archival during investigation

**Failure Flows:**

- **FF-1: Archival storage unavailable** — Job retries next run; no data lost
- **FF-2: Large volume** — Batch processing prevents timeout

**Business Rules:** BR-AUDIT-001, BR-DATA-001
**Required Permissions:** System (automated)
**Data Created/Modified:** Events marked as archived; copied to cold storage
**Notifications:** None
**Audit Events:** `audit.archival_completed` — count, date_range
**Security Considerations:**
- Events are NEVER deleted, only moved to cheaper storage
- Archival does not affect immutability
- Cold storage has same access controls
- Compliance holds prevent archival

**Acceptance Criteria:**
1. Events older than retention period archived
2. Archived events still queryable (with toggle)
3. No events ever deleted
4. Batch processing handles large volumes
5. Compliance holds respected
6. Monthly schedule maintained

**Priority:** P2
**Related Use Cases:** AUDIT-001, AUDIT-009

---
