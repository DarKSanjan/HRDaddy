-- M12 gap: shift_templates was created without RLS, unlike every other org-scoped table.
-- Same tenant_isolation policy pattern as work_locations/employment_types/etc.
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shift_templates
  USING (org_id IN (SELECT public.user_org_ids()));
