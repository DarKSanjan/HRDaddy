-- HR Daddy - role-aware row-level security.
--
-- 00001 protects tenant boundaries, but its permissive policies intentionally
-- allow every active organisation member to mutate tenant rows. This migration
-- adds the application permission model to the database as a second layer.
--
-- PostgreSQL combines permissive policies with OR. The existing tenant policies
-- are therefore recreated as RESTRICTIVE policies below; otherwise a new role
-- policy would be bypassed by the old tenant_isolation policy. Every command
-- must consequently satisfy both tenant isolation and the role/ownership rule.

-- ---------------------------------------------------------------------------
-- Role and ownership lookups
--
-- These helpers read tables that also have RLS policies. SECURITY DEFINER is
-- required to avoid policy recursion and to make the lookup authoritative when
-- it is called from a policy on the same table. A fixed search_path prevents a
-- caller from resolving an untrusted replacement object.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_role_in_org(p_org_id text)
RETURNS "OrgRole"
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM organisation_memberships
  WHERE org_id = p_org_id
    AND user_id = auth.uid()::text
    AND is_active
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.user_role_in_org(text) FROM public;
GRANT EXECUTE ON FUNCTION public.user_role_in_org(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_employee_id(p_org_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM employees
  WHERE org_id = p_org_id
    AND user_id = auth.uid()::text
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.user_employee_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.user_employee_id(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_manages_employee(
  p_org_id text,
  p_employee_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller_employee_id text;
  v_current_employee_id text := p_employee_id;
  v_manager_id text;
  v_depth integer := 0;
BEGIN
  v_caller_employee_id := public.user_employee_id(p_org_id);

  IF v_caller_employee_id IS NULL OR p_employee_id IS NULL THEN
    RETURN false;
  END IF;

  -- Bound the walk so malformed manager data cannot cause an infinite loop.
  WHILE v_current_employee_id IS NOT NULL AND v_depth < 15 LOOP
    SELECT manager_id
    INTO v_manager_id
    FROM employees
    WHERE id = v_current_employee_id
      AND org_id = p_org_id;

    IF NOT FOUND OR v_manager_id IS NULL THEN
      RETURN false;
    END IF;

    IF v_manager_id = v_caller_employee_id THEN
      RETURN true;
    END IF;

    v_current_employee_id := v_manager_id;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.user_manages_employee(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.user_manages_employee(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Organisation memberships
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON organisation_memberships;
CREATE POLICY tenant_isolation ON organisation_memberships
  AS RESTRICTIVE
  USING (
    user_id = auth.uid()::text
    OR org_id IN (SELECT public.user_org_ids())
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR org_id IN (SELECT public.user_org_ids())
  );

DROP POLICY IF EXISTS organisation_memberships_select ON organisation_memberships;
CREATE POLICY organisation_memberships_select ON organisation_memberships
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS organisation_memberships_insert ON organisation_memberships;
CREATE POLICY organisation_memberships_insert ON organisation_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    AND (
      role <> 'OWNER'::"OrgRole"
      OR public.user_role_in_org(org_id) = 'OWNER'::"OrgRole"
    )
  );

DROP POLICY IF EXISTS organisation_memberships_update ON organisation_memberships;
CREATE POLICY organisation_memberships_update ON organisation_memberships
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    AND (
      user_id <> auth.uid()::text
      OR public.user_role_in_org(org_id) = 'OWNER'::"OrgRole"
    )
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    AND (
      role <> 'OWNER'::"OrgRole"
      OR public.user_role_in_org(org_id) = 'OWNER'::"OrgRole"
    )
  );

-- Non-owner admins cannot update their own membership row at all. This is a
-- deliberate coarse RLS approximation that closes self-promotion without
-- requiring a trigger to distinguish safe columns from role changes.
DROP POLICY IF EXISTS organisation_memberships_delete ON organisation_memberships;
CREATE POLICY organisation_memberships_delete ON organisation_memberships
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Users
--
-- Keep colleague visibility for reads, but never allow a colleague to mutate
-- another public.users row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS self_or_colleague ON users;
CREATE POLICY self_or_colleague ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()::text
    OR id IN (
      SELECT om.user_id
      FROM organisation_memberships om
      WHERE om.org_id IN (SELECT public.user_org_ids())
    )
  );

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS users_delete_own ON users;
CREATE POLICY users_delete_own ON users
  FOR DELETE TO authenticated
  USING (id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON employees;
CREATE POLICY tenant_isolation ON employees
  AS RESTRICTIVE
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS employees_select ON employees;
CREATE POLICY employees_select ON employees
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole",
      'MANAGER'::"OrgRole"
    )
    OR user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS employees_insert ON employees;
CREATE POLICY employees_insert ON employees
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- Self-update is intentionally coarser than the app's field-level edit_own
-- permission because RLS cannot restrict which columns an UPDATE changes.
DROP POLICY IF EXISTS employees_update ON employees;
CREATE POLICY employees_update ON employees
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR user_id = auth.uid()::text
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS employees_delete ON employees;
CREATE POLICY employees_delete ON employees
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Document categories
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON document_categories;
CREATE POLICY tenant_isolation ON document_categories
  AS RESTRICTIVE
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

-- Any active member may read category metadata; tenant_isolation supplies the
-- unchanged organisation boundary.
DROP POLICY IF EXISTS document_categories_select ON document_categories;
CREATE POLICY document_categories_select ON document_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS document_categories_insert ON document_categories;
CREATE POLICY document_categories_insert ON document_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS document_categories_update ON document_categories;
CREATE POLICY document_categories_update ON document_categories
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS document_categories_delete ON document_categories;
CREATE POLICY document_categories_delete ON document_categories
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Employee documents
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON employee_documents;
CREATE POLICY tenant_isolation ON employee_documents
  AS RESTRICTIVE
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS employee_documents_select ON employee_documents;
CREATE POLICY employee_documents_select ON employee_documents
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1
      FROM employees e
      JOIN document_categories dc
        ON dc.id = employee_documents.category_id
       AND dc.org_id = employee_documents.org_id
      WHERE e.id = employee_documents.employee_id
        AND e.org_id = employee_documents.org_id
        AND e.user_id = auth.uid()::text
        AND NOT dc.is_sensitive
    )
  );

DROP POLICY IF EXISTS employee_documents_insert ON employee_documents;
CREATE POLICY employee_documents_insert ON employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employee_documents_update ON employee_documents;
CREATE POLICY employee_documents_update ON employee_documents
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS employee_documents_delete ON employee_documents;
CREATE POLICY employee_documents_delete ON employee_documents
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Payroll records
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON payroll_records;
CREATE POLICY tenant_isolation ON payroll_records
  AS RESTRICTIVE
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS payroll_records_select ON payroll_records;
CREATE POLICY payroll_records_select ON payroll_records
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = payroll_records.employee_id
        AND e.org_id = payroll_records.org_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS payroll_records_insert ON payroll_records;
CREATE POLICY payroll_records_insert ON payroll_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_records_update ON payroll_records;
CREATE POLICY payroll_records_update ON payroll_records
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS payroll_records_delete ON payroll_records;
CREATE POLICY payroll_records_delete ON payroll_records
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Leave balances
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON leave_balances;
CREATE POLICY tenant_isolation ON leave_balances
  AS RESTRICTIVE
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS leave_balances_select ON leave_balances;
CREATE POLICY leave_balances_select ON leave_balances
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = leave_balances.employee_id
        AND e.org_id = leave_balances.org_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS leave_balances_insert ON leave_balances;
CREATE POLICY leave_balances_insert ON leave_balances
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS leave_balances_update ON leave_balances;
CREATE POLICY leave_balances_update ON leave_balances
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

DROP POLICY IF EXISTS leave_balances_delete ON leave_balances;
CREATE POLICY leave_balances_delete ON leave_balances
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Leave requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON leave_requests;
CREATE POLICY tenant_isolation ON leave_requests
  AS RESTRICTIVE
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS leave_requests_select ON leave_requests;
CREATE POLICY leave_requests_select ON leave_requests
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole",
      'MANAGER'::"OrgRole"
    )
    OR EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = leave_requests.employee_id
        AND e.org_id = leave_requests.org_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS leave_requests_insert ON leave_requests;
CREATE POLICY leave_requests_insert ON leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
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
    public.user_role_in_org(org_id) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole",
      'MANAGER'::"OrgRole"
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
    public.user_role_in_org(org_id) IN (
      'OWNER'::"OrgRole",
      'HR_ADMIN'::"OrgRole",
      'MANAGER'::"OrgRole"
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

DROP POLICY IF EXISTS leave_requests_delete ON leave_requests;
CREATE POLICY leave_requests_delete ON leave_requests
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
  );

-- ---------------------------------------------------------------------------
-- Storage policies for employee documents
--
-- Keys are org/{orgId}/employee/{employeeId}/{uuid}; storage.foldername(name)
-- uses one-based elements, so [2] is the organisation and [4] is the employee.
-- Keep the tenant check AND the role/ownership check for every operation.
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
      OR public.user_employee_id((storage.foldername(name))[2]) = (storage.foldername(name))[4]
    )
  );

DROP POLICY IF EXISTS employee_documents_insert ON storage.objects;
CREATE POLICY employee_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND (
      public.user_role_in_org((storage.foldername(name))[2]) IN (
        'OWNER'::"OrgRole",
        'HR_ADMIN'::"OrgRole"
      )
      OR public.user_employee_id((storage.foldername(name))[2]) = (storage.foldername(name))[4]
    )
  );

DROP POLICY IF EXISTS employee_documents_update ON storage.objects;
CREATE POLICY employee_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND (
      public.user_role_in_org((storage.foldername(name))[2]) IN (
        'OWNER'::"OrgRole",
        'HR_ADMIN'::"OrgRole"
      )
      OR public.user_employee_id((storage.foldername(name))[2]) = (storage.foldername(name))[4]
    )
  )
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND (
      public.user_role_in_org((storage.foldername(name))[2]) IN (
        'OWNER'::"OrgRole",
        'HR_ADMIN'::"OrgRole"
      )
      OR public.user_employee_id((storage.foldername(name))[2]) = (storage.foldername(name))[4]
    )
  );

DROP POLICY IF EXISTS employee_documents_delete ON storage.objects;
CREATE POLICY employee_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[2] IN (SELECT public.user_org_ids())
    AND (
      public.user_role_in_org((storage.foldername(name))[2]) IN (
        'OWNER'::"OrgRole",
        'HR_ADMIN'::"OrgRole"
      )
      OR public.user_employee_id((storage.foldername(name))[2]) = (storage.foldername(name))[4]
    )
  );
