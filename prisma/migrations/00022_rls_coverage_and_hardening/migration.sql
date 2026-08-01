-- HR Daddy - RLS coverage completion + owner/self-edit/storage/audit hardening.
--
-- Round-2 external review: 00020 only added role-aware RESTRICTIVE policies to
-- 9 of ~35 tables, so every other table was still reachable with full CRUD by
-- any authenticated org member via a direct Supabase call. This migration:
--   1. Fixes leave_requests' MANAGER branch to use user_manages_employee()
--      instead of a blanket role check (it built the helper in 00020 but
--      never used it).
--   2. Adds owner-membership protection (a non-owner can't touch an OWNER
--      row; nobody can remove the org's last OWNER) via trigger, since RLS
--      alone can't express a cross-row "don't leave zero owners" invariant.
--   3. Adds a self-update column guard on employees (RLS can restrict which
--      *rows* you can touch, not which *columns* — this closes the gap where
--      an employee's own UPDATE could silently include compensation,
--      employment status, manager, etc.).
--   4. Locks storage.objects down to match employee_documents exactly: no
--      legitimate self-serve upload path exists (document.upload is
--      ADMIN_ROLES-only), so the "employee owns this folder" write branch is
--      dropped; the read branch gains the same category-sensitivity join
--      employee_documents_select already has, closing the "read a sensitive
--      file via direct signed-URL request" bypass.
--   5. Closes audit log forgery: INSERT is revoked from `authenticated`
--      entirely; the only way to write a row is write_audit_log(), which
--      reads the actor from auth.uid() itself so it can never be forged.
--      SELECT is restricted to admin roles (the one in-app self-view path,
--      getEmployeeActivity(), has no callers anywhere in the app).
--   6. Extends role-aware RESTRICTIVE policies to every remaining table
--      (attendance, expenses, assets, performance, payroll periods/line
--      items, onboarding, settings/modules, invitations, notifications,
--      calendar, and the reference/master tables), mirroring each module's
--      manifest.ts permission definitions.

-- ---------------------------------------------------------------------------
-- 1. leave_requests: manager scope must go through user_manages_employee()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS leave_requests_select ON leave_requests;
CREATE POLICY leave_requests_select ON leave_requests
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = leave_requests.employee_id
        AND e.org_id = leave_requests.org_id
        AND e.user_id = auth.uid()::text
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
      status = 'PENDING'::"LeaveRequestStatus"
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
      status = 'PENDING'::"LeaveRequestStatus"
      AND EXISTS (
        SELECT 1
        FROM employees e
        WHERE e.id = leave_requests.employee_id
          AND e.org_id = leave_requests.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Owner membership protection
--
-- RESTRICTIVE policies can express row visibility and simple per-row checks,
-- but not "would this change leave the org with zero active owners" (that
-- needs to look at sibling rows). Use a trigger, same reasoning 00020 used
-- for user_manages_employee's manager-chain walk.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_owners integer;
BEGIN
  IF OLD.role <> 'OWNER'::"OrgRole" THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Only another OWNER may modify an existing OWNER's membership row.
  IF public.user_role_in_org(OLD.org_id) <> 'OWNER'::"OrgRole" THEN
    RAISE EXCEPTION 'Only an OWNER can modify another OWNER''s membership.';
  END IF;

  -- Staying an active OWNER carries no risk of the zero-owners invariant.
  IF TG_OP = 'UPDATE' AND NEW.role = 'OWNER'::"OrgRole" AND NEW.is_active THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_remaining_owners
  FROM organisation_memberships
  WHERE org_id = OLD.org_id
    AND role = 'OWNER'::"OrgRole"
    AND is_active
    AND id <> OLD.id;

  IF v_remaining_owners = 0 THEN
    RAISE EXCEPTION 'Cannot remove the organisation''s last OWNER.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_owner_membership_trigger ON organisation_memberships;
CREATE TRIGGER protect_owner_membership_trigger
  BEFORE UPDATE OR DELETE ON organisation_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_owner_membership();

-- ---------------------------------------------------------------------------
-- 3. Employee self-update column guard
--
-- employees_update (00020) allows an employee to UPDATE their own row, but
-- RLS can't restrict which *columns* an UPDATE touches. The app's actual
-- self-service surface (self-service-actions.ts, employee.edit_own) only
-- ever writes personal_email/phone/address. Everything else on the row
-- (compensation, employment status, manager, pay type, bank/national-id,
-- department/job/location/shift, name, dates) must stay admin-only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.employees_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS employees_self_update_guard_trigger ON employees;
CREATE TRIGGER employees_self_update_guard_trigger
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION public.employees_self_update_guard();

-- ---------------------------------------------------------------------------
-- 4. Storage lockdown
--
-- No legitimate self-serve upload path exists (document.upload is
-- ADMIN_ROLES-only in the app, and employee_documents INSERT/UPDATE/DELETE
-- are already admin-only at the DB layer since 00020) so storage write
-- access should match, not be looser. Read access gains the same
-- category-sensitivity join employee_documents_select already applies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_documents_read ON storage.objects;
CREATE POLICY employee_documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND (
      public.user_role_in_org((storage.foldername(name))[2]) IN (
        'OWNER'::"OrgRole",
        'HR_ADMIN'::"OrgRole"
      )
      OR EXISTS (
        SELECT 1
        FROM employee_documents ed
        JOIN document_categories dc
          ON dc.id = ed.category_id
         AND dc.org_id = ed.org_id
        WHERE ed.file_key = name
          AND ed.employee_id = public.user_employee_id(ed.org_id)
          AND NOT dc.is_sensitive
      )
    )
  );

DROP POLICY IF EXISTS employee_documents_insert ON storage.objects;
CREATE POLICY employee_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND public.user_role_in_org((storage.foldername(name))[2]) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole"
    )
  );

DROP POLICY IF EXISTS employee_documents_update ON storage.objects;
CREATE POLICY employee_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND public.user_role_in_org((storage.foldername(name))[2]) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole"
    )
  )
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND public.user_role_in_org((storage.foldername(name))[2]) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole"
    )
  );

DROP POLICY IF EXISTS employee_documents_delete ON storage.objects;
CREATE POLICY employee_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND public.user_role_in_org((storage.foldername(name))[2]) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole"
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Audit log forgery + blanket-read closure
--
-- write_audit_log() reads the actor from auth.uid() itself -- never a
-- client-supplied value -- so a caller can insert only as themselves.
-- Service-role writes (dbAdmin, used outside a request or as the
-- no-active-tx fallback in writeAudit()) are untouched: service_role already
-- bypasses RLS and doesn't need this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_org_id text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id NOT IN (SELECT public.user_org_ids()) THEN
    RAISE EXCEPTION 'Not a member of this organisation.';
  END IF;

  INSERT INTO audit_logs (
    id, org_id, actor_id, action, target_type, target_id, before, after, metadata, created_at
  )
  VALUES (
    gen_random_uuid()::text,
    p_org_id,
    auth.uid()::text,
    p_action,
    p_target_type,
    p_target_id,
    p_before,
    p_after,
    p_metadata,
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(text, text, text, text, jsonb, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, text, text, jsonb, jsonb, jsonb) TO authenticated;

REVOKE INSERT ON audit_logs FROM authenticated;

-- Notifications are created only by the service-role client (dbAdmin). Unlike
-- audit_logs, notifications never had its own tenant_isolation replaced by a
-- RESTRICTIVE policy, so the original PERMISSIVE FOR ALL tenant_isolation
-- policy still grants INSERT to any org member on its own -- adding a
-- RESTRICTIVE notifications_* policy set for SELECT/UPDATE/DELETE (below)
-- does not by itself close INSERT. Revoke it at the grant level instead, same
-- as audit_logs.
REVOKE INSERT ON notifications FROM authenticated;

DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- 6. Role-aware RESTRICTIVE policies for every remaining table
-- (attendance, expenses, assets, performance, payroll periods/line items,
-- onboarding, org settings/modules, invitations, notifications, calendar,
-- and the reference/master tables), mirroring each module's manifest.ts.
-- ---------------------------------------------------------------------------
-- --- attendance_records ---
DROP POLICY IF EXISTS attendance_records_select ON attendance_records;
CREATE POLICY attendance_records_select ON attendance_records
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = attendance_records.employee_id
        AND e.org_id = attendance_records.org_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS attendance_records_insert ON attendance_records;
CREATE POLICY attendance_records_insert ON attendance_records
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = attendance_records.employee_id
        AND e.org_id = attendance_records.org_id
        AND e.user_id = auth.uid()::text
    )
  );

-- Employees may update only their own still-open attendance record; administrators may update any record.
DROP POLICY IF EXISTS attendance_records_update ON attendance_records;
CREATE POLICY attendance_records_update ON attendance_records
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      status = 'OPEN'::"AttendanceStatus"
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = attendance_records.employee_id
          AND e.org_id = attendance_records.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = attendance_records.employee_id
        AND e.org_id = attendance_records.org_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS attendance_records_delete ON attendance_records;
CREATE POLICY attendance_records_delete ON attendance_records
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- expense_claims ---
DROP POLICY IF EXISTS expense_claims_select ON expense_claims;
CREATE POLICY expense_claims_select ON expense_claims
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = expense_claims.employee_id
        AND e.org_id = expense_claims.org_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS expense_claims_insert ON expense_claims;
CREATE POLICY expense_claims_insert ON expense_claims
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = expense_claims.employee_id
        AND e.org_id = expense_claims.org_id
        AND e.user_id = auth.uid()::text
    )
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
    OR (
      status IN ('DRAFT'::"ExpenseClaimStatus", 'SUBMITTED'::"ExpenseClaimStatus")
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = expense_claims.employee_id
          AND e.org_id = expense_claims.org_id
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
      status IN ('DRAFT'::"ExpenseClaimStatus", 'SUBMITTED'::"ExpenseClaimStatus")
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = expense_claims.employee_id
          AND e.org_id = expense_claims.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS expense_claims_delete ON expense_claims;
CREATE POLICY expense_claims_delete ON expense_claims
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      status = 'DRAFT'::"ExpenseClaimStatus"
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = expense_claims.employee_id
          AND e.org_id = expense_claims.org_id
          AND e.user_id = auth.uid()::text
      )
    )
  );

-- --- expense_categories ---
DROP POLICY IF EXISTS expense_categories_select ON expense_categories;
CREATE POLICY expense_categories_select ON expense_categories
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS expense_categories_insert ON expense_categories;
CREATE POLICY expense_categories_insert ON expense_categories
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS expense_categories_update ON expense_categories;
CREATE POLICY expense_categories_update ON expense_categories
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS expense_categories_delete ON expense_categories;
CREATE POLICY expense_categories_delete ON expense_categories
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- assets ---
DROP POLICY IF EXISTS assets_select ON assets;
CREATE POLICY assets_select ON assets
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS assets_insert ON assets;
CREATE POLICY assets_insert ON assets
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- The assigned person may update the operational status and notes of their asset.
DROP POLICY IF EXISTS assets_update ON assets;
CREATE POLICY assets_update ON assets
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR person_in_charge_id = public.user_employee_id(org_id)
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR person_in_charge_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS assets_delete ON assets;
CREATE POLICY assets_delete ON assets
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- asset_categories ---
DROP POLICY IF EXISTS asset_categories_select ON asset_categories;
CREATE POLICY asset_categories_select ON asset_categories
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS asset_categories_insert ON asset_categories;
CREATE POLICY asset_categories_insert ON asset_categories
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS asset_categories_update ON asset_categories;
CREATE POLICY asset_categories_update ON asset_categories
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS asset_categories_delete ON asset_categories;
CREATE POLICY asset_categories_delete ON asset_categories
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- asset_assignments ---
DROP POLICY IF EXISTS asset_assignments_select ON asset_assignments;
CREATE POLICY asset_assignments_select ON asset_assignments
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR employee_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS asset_assignments_insert ON asset_assignments;
CREATE POLICY asset_assignments_insert ON asset_assignments
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS asset_assignments_update ON asset_assignments;
CREATE POLICY asset_assignments_update ON asset_assignments
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS asset_assignments_delete ON asset_assignments;
CREATE POLICY asset_assignments_delete ON asset_assignments
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- asset_requests ---
DROP POLICY IF EXISTS asset_requests_select ON asset_requests;
CREATE POLICY asset_requests_select ON asset_requests
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR employee_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS asset_requests_insert ON asset_requests;
CREATE POLICY asset_requests_insert ON asset_requests
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR employee_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS asset_requests_update ON asset_requests;
CREATE POLICY asset_requests_update ON asset_requests
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS asset_requests_delete ON asset_requests;
CREATE POLICY asset_requests_delete ON asset_requests
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- performance_cycles ---
DROP POLICY IF EXISTS performance_cycles_select ON performance_cycles;
CREATE POLICY performance_cycles_select ON performance_cycles
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
  );

DROP POLICY IF EXISTS performance_cycles_insert ON performance_cycles;
CREATE POLICY performance_cycles_insert ON performance_cycles
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS performance_cycles_update ON performance_cycles;
CREATE POLICY performance_cycles_update ON performance_cycles
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS performance_cycles_delete ON performance_cycles;
CREATE POLICY performance_cycles_delete ON performance_cycles
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- performance_reviews ---
DROP POLICY IF EXISTS performance_reviews_select ON performance_reviews;
CREATE POLICY performance_reviews_select ON performance_reviews
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR reviewer_id = public.user_employee_id(org_id)
    OR (
      employee_id = public.user_employee_id(org_id)
      AND status = 'PUBLISHED'::"PerformanceReviewStatus"
    )
  );

DROP POLICY IF EXISTS performance_reviews_insert ON performance_reviews;
CREATE POLICY performance_reviews_insert ON performance_reviews
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR reviewer_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS performance_reviews_update ON performance_reviews;
CREATE POLICY performance_reviews_update ON performance_reviews
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR reviewer_id = public.user_employee_id(org_id)
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR reviewer_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS performance_reviews_delete ON performance_reviews;
CREATE POLICY performance_reviews_delete ON performance_reviews
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- performance_competency_scores ---
DROP POLICY IF EXISTS performance_competency_scores_select ON performance_competency_scores;
CREATE POLICY performance_competency_scores_select ON performance_competency_scores
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_reviews r
      WHERE r.id = performance_competency_scores.review_id
        AND (
          public.user_role_in_org(r.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
          OR r.reviewer_id = public.user_employee_id(r.org_id)
          OR (
            r.employee_id = public.user_employee_id(r.org_id)
            AND r.status = 'PUBLISHED'::"PerformanceReviewStatus"
          )
        )
    )
  );

DROP POLICY IF EXISTS performance_competency_scores_insert ON performance_competency_scores;
CREATE POLICY performance_competency_scores_insert ON performance_competency_scores
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM performance_reviews r
      WHERE r.id = performance_competency_scores.review_id
        AND (
          public.user_role_in_org(r.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
          OR r.reviewer_id = public.user_employee_id(r.org_id)
        )
    )
  );

DROP POLICY IF EXISTS performance_competency_scores_update ON performance_competency_scores;
CREATE POLICY performance_competency_scores_update ON performance_competency_scores
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_reviews r
      WHERE r.id = performance_competency_scores.review_id
        AND (
          public.user_role_in_org(r.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
          OR r.reviewer_id = public.user_employee_id(r.org_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM performance_reviews r
      WHERE r.id = performance_competency_scores.review_id
        AND (
          public.user_role_in_org(r.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
          OR r.reviewer_id = public.user_employee_id(r.org_id)
        )
    )
  );

DROP POLICY IF EXISTS performance_competency_scores_delete ON performance_competency_scores;
CREATE POLICY performance_competency_scores_delete ON performance_competency_scores
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM performance_reviews r
      WHERE r.id = performance_competency_scores.review_id
        AND (
          public.user_role_in_org(r.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
          OR r.reviewer_id = public.user_employee_id(r.org_id)
        )
    )
  );

-- --- payroll_periods ---
DROP POLICY IF EXISTS payroll_periods_select ON payroll_periods;
CREATE POLICY payroll_periods_select ON payroll_periods
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_periods_insert ON payroll_periods;
CREATE POLICY payroll_periods_insert ON payroll_periods
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_periods_update ON payroll_periods;
CREATE POLICY payroll_periods_update ON payroll_periods
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_periods_delete ON payroll_periods;
CREATE POLICY payroll_periods_delete ON payroll_periods
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- payroll_line_items ---
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
        AND pr.employee_id = public.user_employee_id(payroll_line_items.org_id)
    )
  );

DROP POLICY IF EXISTS payroll_line_items_insert ON payroll_line_items;
CREATE POLICY payroll_line_items_insert ON payroll_line_items
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_line_items_update ON payroll_line_items;
CREATE POLICY payroll_line_items_update ON payroll_line_items
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_line_items_delete ON payroll_line_items;
CREATE POLICY payroll_line_items_delete ON payroll_line_items
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- onboarding_templates ---
DROP POLICY IF EXISTS onboarding_templates_select ON onboarding_templates;
CREATE POLICY onboarding_templates_select ON onboarding_templates
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
  );

DROP POLICY IF EXISTS onboarding_templates_insert ON onboarding_templates;
CREATE POLICY onboarding_templates_insert ON onboarding_templates
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS onboarding_templates_update ON onboarding_templates;
CREATE POLICY onboarding_templates_update ON onboarding_templates
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS onboarding_templates_delete ON onboarding_templates;
CREATE POLICY onboarding_templates_delete ON onboarding_templates
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- onboarding_template_tasks ---
DROP POLICY IF EXISTS onboarding_template_tasks_select ON onboarding_template_tasks;
CREATE POLICY onboarding_template_tasks_select ON onboarding_template_tasks
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_templates t
      WHERE t.id = onboarding_template_tasks.template_id
        AND public.user_role_in_org(t.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
    )
  );

DROP POLICY IF EXISTS onboarding_template_tasks_insert ON onboarding_template_tasks;
CREATE POLICY onboarding_template_tasks_insert ON onboarding_template_tasks
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_templates t
      WHERE t.id = onboarding_template_tasks.template_id
        AND public.user_role_in_org(t.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    )
  );

DROP POLICY IF EXISTS onboarding_template_tasks_update ON onboarding_template_tasks;
CREATE POLICY onboarding_template_tasks_update ON onboarding_template_tasks
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_templates t
      WHERE t.id = onboarding_template_tasks.template_id
        AND public.user_role_in_org(t.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_templates t
      WHERE t.id = onboarding_template_tasks.template_id
        AND public.user_role_in_org(t.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    )
  );

DROP POLICY IF EXISTS onboarding_template_tasks_delete ON onboarding_template_tasks;
CREATE POLICY onboarding_template_tasks_delete ON onboarding_template_tasks
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_templates t
      WHERE t.id = onboarding_template_tasks.template_id
        AND public.user_role_in_org(t.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    )
  );

-- --- employee_onboardings ---
DROP POLICY IF EXISTS employee_onboardings_select ON employee_onboardings;
CREATE POLICY employee_onboardings_select ON employee_onboardings
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(org_id, employee_id)
    )
    OR employee_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS employee_onboardings_insert ON employee_onboardings;
CREATE POLICY employee_onboardings_insert ON employee_onboardings
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employee_onboardings_update ON employee_onboardings;
CREATE POLICY employee_onboardings_update ON employee_onboardings
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employee_onboardings_delete ON employee_onboardings;
CREATE POLICY employee_onboardings_delete ON employee_onboardings
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- employee_onboarding_tasks ---
DROP POLICY IF EXISTS employee_onboarding_tasks_select ON employee_onboarding_tasks;
CREATE POLICY employee_onboarding_tasks_select ON employee_onboarding_tasks
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      public.user_role_in_org(org_id) = 'MANAGER'::"OrgRole"
      AND public.user_manages_employee(
        org_id,
        (
          SELECT eo.employee_id
          FROM employee_onboardings eo
          WHERE eo.id = employee_onboarding_tasks.onboarding_id
        )
      )
    )
    OR assignee_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS employee_onboarding_tasks_insert ON employee_onboarding_tasks;
CREATE POLICY employee_onboarding_tasks_insert ON employee_onboarding_tasks
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employee_onboarding_tasks_update ON employee_onboarding_tasks;
CREATE POLICY employee_onboarding_tasks_update ON employee_onboarding_tasks
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR assignee_id = public.user_employee_id(org_id)
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR assignee_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS employee_onboarding_tasks_delete ON employee_onboarding_tasks;
CREATE POLICY employee_onboarding_tasks_delete ON employee_onboarding_tasks
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- organisation_settings ---
DROP POLICY IF EXISTS organisation_settings_select ON organisation_settings;
CREATE POLICY organisation_settings_select ON organisation_settings
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS organisation_settings_insert ON organisation_settings;
CREATE POLICY organisation_settings_insert ON organisation_settings
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS organisation_settings_update ON organisation_settings;
CREATE POLICY organisation_settings_update ON organisation_settings
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS organisation_settings_delete ON organisation_settings;
CREATE POLICY organisation_settings_delete ON organisation_settings
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- organisation_modules ---
DROP POLICY IF EXISTS organisation_modules_select ON organisation_modules;
CREATE POLICY organisation_modules_select ON organisation_modules
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS organisation_modules_insert ON organisation_modules;
CREATE POLICY organisation_modules_insert ON organisation_modules
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS organisation_modules_update ON organisation_modules;
CREATE POLICY organisation_modules_update ON organisation_modules
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS organisation_modules_delete ON organisation_modules;
CREATE POLICY organisation_modules_delete ON organisation_modules
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- invitations ---
DROP POLICY IF EXISTS invitations_select ON invitations;
CREATE POLICY invitations_select ON invitations
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- Only an owner may invite another owner.
DROP POLICY IF EXISTS invitations_insert ON invitations;
CREATE POLICY invitations_insert ON invitations
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    AND (
      role <> 'OWNER'::"OrgRole"
      OR public.user_role_in_org(org_id) = 'OWNER'::"OrgRole"
    )
  );

DROP POLICY IF EXISTS invitations_update ON invitations;
CREATE POLICY invitations_update ON invitations
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    AND (
      role <> 'OWNER'::"OrgRole"
      OR public.user_role_in_org(org_id) = 'OWNER'::"OrgRole"
    )
  );

DROP POLICY IF EXISTS invitations_delete ON invitations;
CREATE POLICY invitations_delete ON invitations
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- notifications ---
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS notifications_delete ON notifications;
CREATE POLICY notifications_delete ON notifications
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

-- Notifications are created only by the service-role client; authenticated inserts remain denied.

-- --- calendar_events ---
DROP POLICY IF EXISTS calendar_events_select ON calendar_events;
CREATE POLICY calendar_events_select ON calendar_events
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS calendar_events_insert ON calendar_events;
CREATE POLICY calendar_events_insert ON calendar_events
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
  );

DROP POLICY IF EXISTS calendar_events_update ON calendar_events;
CREATE POLICY calendar_events_update ON calendar_events
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
  );

DROP POLICY IF EXISTS calendar_events_delete ON calendar_events;
CREATE POLICY calendar_events_delete ON calendar_events
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
  );

-- --- calendar_event_recipients ---
DROP POLICY IF EXISTS calendar_event_recipients_select ON calendar_event_recipients;
CREATE POLICY calendar_event_recipients_select ON calendar_event_recipients
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_event_recipients.event_id
        AND public.user_role_in_org(ce.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
    )
    OR employee_id = public.user_employee_id(
      (
        SELECT ce.org_id
        FROM calendar_events ce
        WHERE ce.id = calendar_event_recipients.event_id
      )
    )
  );

DROP POLICY IF EXISTS calendar_event_recipients_insert ON calendar_event_recipients;
CREATE POLICY calendar_event_recipients_insert ON calendar_event_recipients
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_event_recipients.event_id
        AND public.user_role_in_org(ce.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
    )
  );

DROP POLICY IF EXISTS calendar_event_recipients_update ON calendar_event_recipients;
CREATE POLICY calendar_event_recipients_update ON calendar_event_recipients
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_event_recipients.event_id
        AND public.user_role_in_org(ce.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_event_recipients.event_id
        AND public.user_role_in_org(ce.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
    )
  );

DROP POLICY IF EXISTS calendar_event_recipients_delete ON calendar_event_recipients;
CREATE POLICY calendar_event_recipients_delete ON calendar_event_recipients
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_event_recipients.event_id
        AND public.user_role_in_org(ce.org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole", 'MANAGER'::"OrgRole")
    )
  );

-- --- holidays ---
DROP POLICY IF EXISTS holidays_select ON holidays;
CREATE POLICY holidays_select ON holidays
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS holidays_insert ON holidays;
CREATE POLICY holidays_insert ON holidays
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS holidays_update ON holidays;
CREATE POLICY holidays_update ON holidays
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS holidays_delete ON holidays;
CREATE POLICY holidays_delete ON holidays
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- calendar_feed_tokens ---
DROP POLICY IF EXISTS calendar_feed_tokens_select ON calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_select ON calendar_feed_tokens
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (employee_id = public.user_employee_id(org_id));

DROP POLICY IF EXISTS calendar_feed_tokens_insert ON calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_insert ON calendar_feed_tokens
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.user_employee_id(org_id));

DROP POLICY IF EXISTS calendar_feed_tokens_delete ON calendar_feed_tokens;
CREATE POLICY calendar_feed_tokens_delete ON calendar_feed_tokens
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (employee_id = public.user_employee_id(org_id));

-- --- shift_templates ---
DROP POLICY IF EXISTS shift_templates_select ON shift_templates;
CREATE POLICY shift_templates_select ON shift_templates
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS shift_templates_insert ON shift_templates;
CREATE POLICY shift_templates_insert ON shift_templates
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS shift_templates_update ON shift_templates;
CREATE POLICY shift_templates_update ON shift_templates
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS shift_templates_delete ON shift_templates;
CREATE POLICY shift_templates_delete ON shift_templates
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- job_titles ---
DROP POLICY IF EXISTS job_titles_select ON job_titles;
CREATE POLICY job_titles_select ON job_titles
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS job_titles_insert ON job_titles;
CREATE POLICY job_titles_insert ON job_titles
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS job_titles_update ON job_titles;
CREATE POLICY job_titles_update ON job_titles
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS job_titles_delete ON job_titles;
CREATE POLICY job_titles_delete ON job_titles
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- departments ---
DROP POLICY IF EXISTS departments_select ON departments;
CREATE POLICY departments_select ON departments
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS departments_insert ON departments;
CREATE POLICY departments_insert ON departments
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS departments_update ON departments;
CREATE POLICY departments_update ON departments
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS departments_delete ON departments;
CREATE POLICY departments_delete ON departments
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- work_locations ---
DROP POLICY IF EXISTS work_locations_select ON work_locations;
CREATE POLICY work_locations_select ON work_locations
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS work_locations_insert ON work_locations;
CREATE POLICY work_locations_insert ON work_locations
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS work_locations_update ON work_locations;
CREATE POLICY work_locations_update ON work_locations
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS work_locations_delete ON work_locations;
CREATE POLICY work_locations_delete ON work_locations
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- employment_types ---
DROP POLICY IF EXISTS employment_types_select ON employment_types;
CREATE POLICY employment_types_select ON employment_types
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS employment_types_insert ON employment_types;
CREATE POLICY employment_types_insert ON employment_types
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employment_types_update ON employment_types;
CREATE POLICY employment_types_update ON employment_types
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employment_types_delete ON employment_types;
CREATE POLICY employment_types_delete ON employment_types
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- leave_types ---
DROP POLICY IF EXISTS leave_types_select ON leave_types;
CREATE POLICY leave_types_select ON leave_types
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS leave_types_insert ON leave_types;
CREATE POLICY leave_types_insert ON leave_types
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS leave_types_update ON leave_types;
CREATE POLICY leave_types_update ON leave_types
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS leave_types_delete ON leave_types;
CREATE POLICY leave_types_delete ON leave_types
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- --- leave_policies ---
DROP POLICY IF EXISTS leave_policies_select ON leave_policies;
CREATE POLICY leave_policies_select ON leave_policies
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS leave_policies_insert ON leave_policies;
CREATE POLICY leave_policies_insert ON leave_policies
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS leave_policies_update ON leave_policies;
CREATE POLICY leave_policies_update ON leave_policies
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS leave_policies_delete ON leave_policies;
CREATE POLICY leave_policies_delete ON leave_policies
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );
