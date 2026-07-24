-- HR Daddy — row-level security.
--
-- Tenant isolation is enforced twice: once in application code via
-- requirePermission(), and once here in Postgres. This file is the second
-- layer, and it must hold on its own even if the application layer is bypassed.
--
-- NOTE: auth.uid() is provided by Supabase. Do NOT redefine it — overwriting
-- the built-in would change behaviour for Supabase's own internals.

-- ---------------------------------------------------------------------------
-- Membership lookup
--
-- A policy on organisation_memberships that itself SELECTs from
-- organisation_memberships recurses infinitely ("infinite recursion detected in
-- policy for relation ..."). SECURITY DEFINER runs the lookup as the function
-- owner, which is exempt from RLS, breaking the cycle.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id FROM organisation_memberships
  WHERE user_id = auth.uid()::text AND is_active
$$;

REVOKE ALL ON FUNCTION public.user_org_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
--
-- RLS narrows which rows a role may see; it grants nothing on its own. Without
-- these GRANTs every query made through dbAs() fails with "permission denied
-- for table ...", because dbAs switches the session role to `authenticated`.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ---------------------------------------------------------------------------
-- Non-tenant tables
-- ---------------------------------------------------------------------------

-- organisations is keyed by id, not org_id.
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organisations
  USING (id IN (SELECT public.user_org_ids()));

-- A user may see themselves, plus anyone sharing an organisation with them.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY self_or_colleague ON users
  USING (
    id = auth.uid()::text
    OR id IN (
      SELECT om.user_id FROM organisation_memberships om
      WHERE om.org_id IN (SELECT public.user_org_ids())
    )
  );

-- Wizard state is private to the user, and exists before any organisation does.
ALTER TABLE org_setup_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_setup_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY own_setup_progress ON org_setup_progress
  USING (user_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Tenant-owned tables
-- ---------------------------------------------------------------------------

ALTER TABLE organisation_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organisation_memberships
  USING (user_id = auth.uid()::text OR org_id IN (SELECT public.user_org_ids()));

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invitations
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE organisation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organisation_settings
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE organisation_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_modules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organisation_modules
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employees
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON departments
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_titles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON job_titles
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON work_locations
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE employment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_types FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employment_types
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_types
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_policies
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_balances
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leave_requests
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attendance_records
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON onboarding_templates
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE employee_onboardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_onboardings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_onboardings
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE employee_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_onboarding_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_onboarding_tasks
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_categories
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employee_documents
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payroll_periods
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payroll_records
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE payroll_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_line_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payroll_line_items
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifications
  USING (org_id IN (SELECT public.user_org_ids()));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING (org_id IN (SELECT public.user_org_ids()));

-- ---------------------------------------------------------------------------
-- Audit log is append-only.
-- The service exposes no mutation path; this removes it at the database too.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;

-- ---------------------------------------------------------------------------
-- Mirror auth.users into public.users on signup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
