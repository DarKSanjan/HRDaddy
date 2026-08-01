-- HR Daddy - authorization hardening round 3.
--
-- Round-3 external review found production had never actually received
-- 00020-00023 (prod's _prisma_migrations stopped at 00019 — confirmed live).
-- This migration is what actually ships once writeAudit() is fixed to call
-- write_audit_log() (see src/core/audit/index.ts) instead of inserting
-- directly, which would otherwise break under 00022's REVOKE INSERT the
-- moment this deploys. On top of that prerequisite fix, this migration:
--   1. organisations: adds role-aware UPDATE/DELETE (was tenant_isolation-only
--      = any member could rename or delete the org).
--   2. users: self-update column guard (was tenant_isolation + full-row
--      self-update, including is_active, which auth trusts for deactivation).
--   3. calendar_feed_tokens: INSERT now enforces the same COMPANY-scope
--      restriction the app already applies (Owner/HR_ADMIN only).
--   4. payroll_records / payroll_line_items: self-view now requires
--      is_published — draft payroll was previously visible to the employee
--      it belongs to.
--   5. Column/state-machine guards where RLS's row-only model let a
--      self-update through with a full-row payload: attendance_records,
--      employee_onboarding_tasks, leave_requests, performance_reviews (the
--      last two also fix functional bugs found in this pass, not just the
--      reviewer's list — see inline comments).
--   6. Removes self-branches from assets_update / expense_claims_update
--      entirely: neither table actually has a legitimate partial self-edit
--      path in the app (asset PIC has no self-update action at all; expense
--      claims are withdrawn via delete, never updated in place), so the
--      existing full-row self-branch was pure attack surface.
--   7. Functional regressions the reviewer found in 00022 itself:
--      asset_requests self-cancel, expense_claims SUBMITTED withdrawal,
--      organisation_modules tightened to Owner-only.
--   8. Owner-protection trigger gets an advisory lock to close a
--      concurrent-demotion race.
--   9. app_user: a second Postgres role for the app's own dbAs() connection,
--      distinct from `authenticated` (which Supabase Auth maps every signed-
--      in user's direct REST/PostgREST call to). This is what makes a real
--      column-level restriction on employees' sensitive fields possible —
--      RLS is row-only, so without a second role, anything grantable to the
--      trusted app is equally grantable to a raw REST call with any member's
--      JWT. See src/core/db/client.ts for the corresponding code change.

-- ---------------------------------------------------------------------------
-- 0. Fix a real bug found while validating this migration against a real
-- Postgres instance: employees_self_update_guard() (00022) has no bypass for
-- a service-role caller (dbAdmin — background jobs, scripts like
-- scripts/encrypt-existing-pii.ts, the signup transaction). When there is no
-- JWT at all, auth.uid() is NULL, user_role_in_org() returns NULL, and
-- `NULL IN (...)` is not TRUE — so the function falls through to the
-- column-restricted branch and REJECTS writes to bank_name/nationalId/etc,
-- exactly the failure mode the reviewer warned the PII backfill script would
-- hit. Confirmed this by running the trigger against a real Postgres
-- instance with request.jwt.claims genuinely unset, using Supabase's actual
-- production auth.uid() definition (verified via pg_get_functiondef against
-- the live project) rather than assuming. Fix: an explicit bypass when
-- auth.uid() IS NULL — that state is only reachable via a service-role
-- connection (dbAs() always installs a sub claim before running anything),
-- so it's the same trust boundary dbAdmin already crosses by bypassing RLS
-- entirely. Every new guard function below gets the same bypass from the
-- start, for the same reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.employees_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins may change anything on the row; RLS's employees_update policy is
  -- what actually decides who can reach this row at all.
  IF public.user_role_in_org(NEW.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole") THEN
    RETURN NEW;
  END IF;

  IF NEW.first_name IS DISTINCT FROM OLD.first_name
    OR NEW.last_name IS DISTINCT FROM OLD.last_name
    OR NEW.work_email IS DISTINCT FROM OLD.work_email
    OR NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
    OR NEW.gender IS DISTINCT FROM OLD.gender
    OR NEW.national_id IS DISTINCT FROM OLD.national_id
    OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
    OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    OR NEW.employment_status IS DISTINCT FROM OLD.employment_status
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.department_id IS DISTINCT FROM OLD.department_id
    OR NEW.job_title_id IS DISTINCT FROM OLD.job_title_id
    OR NEW.location_id IS DISTINCT FROM OLD.location_id
    OR NEW.employment_type_id IS DISTINCT FROM OLD.employment_type_id
    OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
    OR NEW.compensation_amount_cents IS DISTINCT FROM OLD.compensation_amount_cents
    OR NEW.compensation_currency IS DISTINCT FROM OLD.compensation_currency
    OR NEW.pay_type IS DISTINCT FROM OLD.pay_type
    OR NEW.is_workman IS DISTINCT FROM OLD.is_workman
    OR NEW.shift_template_id IS DISTINCT FROM OLD.shift_template_id
    OR NEW.residency_status IS DISTINCT FROM OLD.residency_status
    OR NEW.pr_start_date IS DISTINCT FROM OLD.pr_start_date
    OR NEW.pr_arrangement IS DISTINCT FROM OLD.pr_arrangement
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'You may only update your personal email, phone, and address.';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Organisations: role-aware UPDATE/DELETE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organisations_update ON organisations;
CREATE POLICY organisations_update ON organisations
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS organisations_delete ON organisations;
CREATE POLICY organisations_delete ON organisations
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(id) = 'OWNER'::"OrgRole"
  );

-- ---------------------------------------------------------------------------
-- 2. Users: self-update column guard
--
-- users_update_own (00020) is row-scoped to id = auth.uid() but not
-- column-scoped, so a direct REST caller could set is_active on their own
-- row — verifySession() (src/core/auth/dal.ts) trusts that field directly to
-- gate access, so a deactivated user with a still-valid Supabase session
-- could reactivate themselves.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Self-update may not change email, is_active, or created_at.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_self_update_guard_trigger ON users;
CREATE TRIGGER users_self_update_guard_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.id = auth.uid()::text)
  EXECUTE FUNCTION public.users_self_update_guard();

-- ---------------------------------------------------------------------------
-- 3. Calendar feed tokens: enforce COMPANY-scope restriction at the DB layer
--
-- The app already blocks a non-admin from requesting a COMPANY-scope token
-- (src/core/calendar-feed/actions.ts), but that check only exists in
-- application code, which always writes through dbAdmin (service role,
-- bypasses RLS) for this table. This closes the equivalent direct-REST path.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS calendar_feed_tokens_insert ON calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_insert ON calendar_feed_tokens
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.user_employee_id(org_id)
    AND (
      scope = 'PERSONAL'::"CalendarFeedScope"
      OR public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Payroll: self-view requires is_published
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_records_select ON payroll_records;
CREATE POLICY payroll_records_select ON payroll_records
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      is_published = true
      AND EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.id = payroll_records.employee_id
          AND e.org_id = payroll_records.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS payroll_line_items_select ON payroll_line_items;
CREATE POLICY payroll_line_items_select ON payroll_line_items
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1 FROM payroll_records pr
      WHERE pr.id = payroll_line_items.record_id
        AND pr.org_id = payroll_line_items.org_id
        AND pr.is_published = true
        AND pr.employee_id = public.user_employee_id(payroll_line_items.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5a. Attendance: self clock-out is column-scoped
--
-- attendance_records_update (00022) already restricts the self-branch to
-- status = 'OPEN' rows, but doesn't stop a direct REST caller from also
-- changing date/clock_in/employee_id/type in that same request. clockOut()
-- (src/modules/attendance/actions.ts) only ever writes clock_out,
-- duration_minutes, status — lock the rest.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_records_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_self boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.user_role_in_org(NEW.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole") THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.employee_id AND e.org_id = NEW.org_id AND e.user_id = auth.uid()::text
  ) INTO v_is_self;

  IF NOT v_is_self THEN
    -- Reached via the manager-approval branch of the RLS policy, or a
    -- correction path this trigger doesn't need to gate further.
    RETURN NEW;
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.date IS DISTINCT FROM OLD.date
    OR NEW.clock_in IS DISTINCT FROM OLD.clock_in
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.corrected_by_id IS DISTINCT FROM OLD.corrected_by_id
    OR NEW.correction_reason IS DISTINCT FROM OLD.correction_reason
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Self clock-out may only change clock_out, duration_minutes, and status.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_records_self_update_guard_trigger ON attendance_records;
CREATE TRIGGER attendance_records_self_update_guard_trigger
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_records_self_update_guard();

-- ---------------------------------------------------------------------------
-- 5b. Onboarding tasks: assignee self-update is column-scoped
--
-- completeTask() (src/modules/onboarding/actions.ts) only ever writes
-- status, completed_at, notes for a non-admin assignee.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_tasks_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.user_role_in_org(NEW.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole") THEN
    RETURN NEW;
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM public.user_employee_id(NEW.org_id) THEN
    -- Not the assignee (e.g. a manager reached via a future policy branch) —
    -- nothing for this guard to restrict beyond what RLS already decided.
    RETURN NEW;
  END IF;

  IF NEW.onboarding_id IS DISTINCT FROM OLD.onboarding_id
    OR NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.assignee_type IS DISTINCT FROM OLD.assignee_type
    OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Self-update may only change status, completed_at, and notes.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_tasks_self_update_guard_trigger ON employee_onboarding_tasks;
CREATE TRIGGER onboarding_tasks_self_update_guard_trigger
  BEFORE UPDATE ON employee_onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.onboarding_tasks_self_update_guard();

-- ---------------------------------------------------------------------------
-- 5c. Leave requests: INSERT can't start pre-decided; self-UPDATE is only
-- the withdraw/cancel transition, nothing else.
--
-- The app has no "edit a pending request" feature — submitLeaveRequest()
-- always inserts with status='PENDING'; withdrawLeaveRequest() and
-- cancelLeaveRequest() only ever change `status` (PENDING->WITHDRAWN,
-- APPROVED->CANCELLED). The existing 00022 self-UPDATE branch requires the
-- OLD row to be PENDING, which would make cancelLeaveRequest() (self,
-- targeting an APPROVED row) always fail once this ships — fixing that here
-- alongside the reviewer's column-bypass finding, not two separate changes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS leave_requests_insert ON leave_requests;
CREATE POLICY leave_requests_insert ON leave_requests
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      status IN ('DRAFT'::"LeaveRequestStatus", 'PENDING'::"LeaveRequestStatus")
      AND reviewed_by_id IS NULL
      AND reviewed_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.id = leave_requests.employee_id
          AND e.org_id = leave_requests.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS leave_requests_update ON leave_requests;
CREATE POLICY leave_requests_update ON leave_requests
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR (
      status IN ('PENDING'::"LeaveRequestStatus", 'APPROVED'::"LeaveRequestStatus")
      AND EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.id = leave_requests.employee_id
          AND e.org_id = leave_requests.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR (
      status IN ('WITHDRAWN'::"LeaveRequestStatus", 'CANCELLED'::"LeaveRequestStatus")
      AND EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.id = leave_requests.employee_id
          AND e.org_id = leave_requests.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

CREATE OR REPLACE FUNCTION public.leave_requests_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_self boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.user_role_in_org(NEW.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(NEW.org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(NEW.org_id, NEW.employee_id)
    )
  THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.employee_id AND e.org_id = NEW.org_id AND e.user_id = auth.uid()::text
  ) INTO v_is_self;

  IF NOT v_is_self THEN
    RETURN NEW;
  END IF;

  IF NEW.leave_type_id IS DISTINCT FROM OLD.leave_type_id
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.is_half_day IS DISTINCT FROM OLD.is_half_day
    OR NEW.half_day_period IS DISTINCT FROM OLD.half_day_period
    OR NEW.total_days IS DISTINCT FROM OLD.total_days
    OR NEW.reviewed_by_id IS DISTINCT FROM OLD.reviewed_by_id
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
    OR NEW.review_note IS DISTINCT FROM OLD.review_note
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Self-update may only withdraw a pending request or cancel an approved one.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'PENDING'::"LeaveRequestStatus" AND NEW.status = 'WITHDRAWN'::"LeaveRequestStatus")
      OR (OLD.status = 'APPROVED'::"LeaveRequestStatus" AND NEW.status = 'CANCELLED'::"LeaveRequestStatus")
    ) THEN
      RAISE EXCEPTION 'Self-update may only withdraw a pending request or cancel an approved one.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_requests_self_update_guard_trigger ON leave_requests;
CREATE TRIGGER leave_requests_self_update_guard_trigger
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.leave_requests_self_update_guard();

-- ---------------------------------------------------------------------------
-- 5d. Performance reviews: add the missing employee-self branch and
-- column-guard both actor types.
--
-- Bug found independently of the review: submitSelfAssessment() and
-- acknowledgeReview() (src/modules/performance/actions.ts) update a review
-- via dbAs() as the REVIEWEE (employee_id = self), not the reviewer. The
-- existing performance_reviews_update policy only has an admin branch and a
-- reviewer_id = self branch — employee_id = self was never covered, so both
-- of those features would silently no-op (0 rows matched by RLS) once this
-- family of policies deploys. Adding the branch here, alongside the column
-- guard, rather than as a separate fix.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS performance_reviews_update ON performance_reviews;
CREATE POLICY performance_reviews_update ON performance_reviews
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR reviewer_id = public.user_employee_id(org_id)
    OR employee_id = public.user_employee_id(org_id)
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR reviewer_id = public.user_employee_id(org_id)
    OR employee_id = public.user_employee_id(org_id)
  );

CREATE OR REPLACE FUNCTION public.performance_reviews_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_reviewer boolean;
  v_is_reviewee boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.user_role_in_org(NEW.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole") THEN
    RETURN NEW;
  END IF;

  v_is_reviewer := NEW.reviewer_id = public.user_employee_id(NEW.org_id);
  v_is_reviewee := NEW.employee_id = public.user_employee_id(NEW.org_id);

  -- Columns nobody but an admin may ever self-touch.
  IF NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.cycle_id IS DISTINCT FROM OLD.cycle_id
    OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.status = 'PUBLISHED'::"PerformanceReviewStatus"
      AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    RAISE EXCEPTION 'Self-update may not change this field or publish a review.';
  END IF;

  IF v_is_reviewer AND NOT v_is_reviewee THEN
    IF NEW.self_assessment IS DISTINCT FROM OLD.self_assessment
      OR NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at
    THEN
      RAISE EXCEPTION 'A reviewer may not set the reviewee''s self-assessment or acknowledgement.';
    END IF;
  ELSIF v_is_reviewee AND NOT v_is_reviewer THEN
    IF NEW.overall_score IS DISTINCT FROM OLD.overall_score
      OR NEW.strengths IS DISTINCT FROM OLD.strengths
      OR NEW.improvements IS DISTINCT FROM OLD.improvements
      OR NEW.goals IS DISTINCT FROM OLD.goals
      OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    THEN
      RAISE EXCEPTION 'A reviewee may only submit a self-assessment or acknowledge a published review.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS performance_reviews_self_update_guard_trigger ON performance_reviews;
CREATE TRIGGER performance_reviews_self_update_guard_trigger
  BEFORE UPDATE ON performance_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.performance_reviews_self_update_guard();

DROP POLICY IF EXISTS performance_reviews_insert ON performance_reviews;
CREATE POLICY performance_reviews_insert ON performance_reviews
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      reviewer_id = public.user_employee_id(org_id)
      AND reviewer_id <> employee_id
      AND status = 'PENDING'::"PerformanceReviewStatus"
      AND submitted_at IS NULL
      AND published_at IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Assets / expense claims: drop self-branches with no legitimate use.
--
-- Neither has an app action that partially self-updates the row: asset PIC
-- has no self-update action at all (all state changes require asset.assign,
-- ADMIN_ROLES-only); expense claims are withdrawn via delete
-- (withdrawExpenseClaim), never updated in place. The existing self-branches
-- were pure attack surface (full-row UPDATE), not a real feature gap.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS assets_update ON assets;
CREATE POLICY assets_update ON assets
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS expense_claims_update ON expense_claims;
CREATE POLICY expense_claims_update ON expense_claims
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Functional regressions from 00022
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS asset_requests_delete ON asset_requests;
CREATE POLICY asset_requests_delete ON asset_requests
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      status = 'PENDING'::"AssetRequestStatus"
      AND employee_id = public.user_employee_id(org_id)
    )
  );

DROP POLICY IF EXISTS expense_claims_delete ON expense_claims;
CREATE POLICY expense_claims_delete ON expense_claims
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      status IN ('DRAFT'::"ExpenseClaimStatus", 'SUBMITTED'::"ExpenseClaimStatus")
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = expense_claims.employee_id
          AND e.org_id = expense_claims.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS organisation_modules_insert ON organisation_modules;
CREATE POLICY organisation_modules_insert ON organisation_modules
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) = 'OWNER'::"OrgRole"
  );

DROP POLICY IF EXISTS organisation_modules_update ON organisation_modules;
CREATE POLICY organisation_modules_update ON organisation_modules
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.user_role_in_org(org_id) = 'OWNER'::"OrgRole")
  WITH CHECK (public.user_role_in_org(org_id) = 'OWNER'::"OrgRole");

DROP POLICY IF EXISTS organisation_modules_delete ON organisation_modules;
CREATE POLICY organisation_modules_delete ON organisation_modules
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.user_role_in_org(org_id) = 'OWNER'::"OrgRole");

-- ---------------------------------------------------------------------------
-- 8. Owner-protection trigger: close the concurrent-demotion race
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_owners integer;
  v_org_id text;
BEGIN
  v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id));

  IF OLD.role <> 'OWNER'::"OrgRole" THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.user_role_in_org(v_org_id) = 'OWNER'::"OrgRole" THEN
    RAISE EXCEPTION 'Only an owner may modify another owner''s membership.';
  END IF;
  IF TG_OP = 'DELETE' AND NOT public.user_role_in_org(v_org_id) = 'OWNER'::"OrgRole" THEN
    RAISE EXCEPTION 'Only an owner may remove another owner''s membership.';
  END IF;

  SELECT count(*) INTO v_remaining_owners
  FROM organisation_memberships
  WHERE org_id = v_org_id
    AND role = 'OWNER'::"OrgRole"
    AND is_active
    AND id <> OLD.id;

  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.role <> 'OWNER'::"OrgRole" OR NOT NEW.is_active)) THEN
    IF v_remaining_owners = 0 THEN
      RAISE EXCEPTION 'Cannot remove the organisation''s last OWNER.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. app_user: dedicated role for the app's dbAs() connection
--
-- Granted directly (not via `GRANT authenticated TO app_user`'s inherited
-- privileges) so that REVOKEs against `authenticated` below don't cascade to
-- it. `GRANT authenticated TO app_user` is still needed separately, purely
-- so RLS policies declared `TO authenticated` recognise app_user sessions
-- (Postgres policy role-matching includes role membership) — that grant
-- does not, by itself, give app_user any of authenticated's privileges; the
-- privileges below are what actually do that, granted directly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

GRANT authenticated TO app_user;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;

GRANT USAGE ON SCHEMA storage TO app_user;
GRANT ALL ON storage.objects TO app_user;
GRANT ALL ON storage.buckets TO app_user;

-- Employees: the one table with a genuine mixed-sensitivity, org-wide-
-- visible-row shape (everyone in the directory can see every employee row;
-- not everyone should see every column of it).
--
-- Column-level REVOKE alone does NOT work here: `00001_rls_policies` granted
-- `authenticated` blanket table-level SELECT/INSERT/UPDATE/DELETE on every
-- public table (`GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated`).
-- A table-level grant covers every column, including future ones; revoking a
-- column-level privilege that was never separately granted removes nothing
-- from that pre-existing table-level grant, so the sensitive columns would
-- stay fully readable. Verified this empirically against a real Postgres
-- instance while writing this migration — the column-REVOKE-only version
-- silently did nothing. Confirmed by re-running the equivalent
-- information_schema.column_privileges query below after this fix.
--
-- The correct fix is subtractive at the table level, then additive at the
-- column level: revoke the blanket table-level grant on `employees` from
-- `authenticated` entirely, then grant back exactly the safe/directory
-- columns. `app_user`'s own direct table-level grant (above) is a completely
-- separate ACL entry and is untouched by any of this.
REVOKE SELECT, INSERT, UPDATE, DELETE ON employees FROM authenticated;

GRANT SELECT (
  id, org_id, first_name, last_name, work_email, employment_status,
  start_date, end_date, department_id, job_title_id, location_id,
  employment_type_id, manager_id, shift_template_id, created_at, updated_at
) ON employees TO authenticated;

-- Not granting INSERT/UPDATE/DELETE back to `authenticated` at all: the app's
-- own writes (including the self-service personal_email/phone/address edit)
-- run as app_user, which has its own full grant. No legitimate direct-REST
-- caller writes to `employees` today, so there is nothing to restore —
-- RLS's row policies remain the only thing standing between "no column
-- grant at all" and "write," which is stricter than before, not looser.
