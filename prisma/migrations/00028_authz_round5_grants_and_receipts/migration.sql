-- Round 5 external review fixes.
--
-- 1. app_user had GRANT ALL (00024), which includes TRUNCATE/REFERENCES/
--    TRIGGER, not just CRUD. TRUNCATE bypasses RLS entirely — a leaked
--    APP_USER_DATABASE_URL or a raw-SQL bug could wipe every tenant's data in
--    one statement. Replace with the explicit DML app_user actually needs.
-- 2. Round 3/4 revoked authenticated's raw-REST INSERT/UPDATE/DELETE table by
--    table and still missed several (calendar_event_recipients, payroll,
--    org membership/invitations, employee_documents, assets, onboarding).
--    The app has no browser-side data writes anywhere — verified: the browser
--    Supabase client is auth-only, every mutation goes through dbAs()
--    (app_user) or dbAdmin (service role) — so authenticated never
--    legitimately needs table-level write access to any public table.
--    Revoke it everywhere at once instead of enumerating tables again.
-- 3. Storage self-read policy's EXISTS subquery has an unqualified `name`
--    reference that resolves to document_categories.name (dc has its own
--    name column, shadowing the outer storage.objects.name correlation) —
--    so ed.file_key never actually matches, and employees can't read their
--    own non-sensitive documents. Qualify it.
-- 4. Storage self-upload branch existed in 00020 and was dropped in 00022 on
--    the assumption that no self-serve upload path exists. Expense receipts
--    (added after 00022) do need one — restore it.

-- ---------------------------------------------------------------------------
-- 1. app_user: explicit DML instead of ALL
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE ALL ON public._prisma_migrations FROM app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

REVOKE ALL ON storage.objects FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO app_user;
REVOKE ALL ON storage.buckets FROM app_user;
GRANT SELECT ON storage.buckets TO app_user;

-- ---------------------------------------------------------------------------
-- 2. authenticated: no table-level writes on any public table
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage self-read: qualify the shadowed column reference
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
        WHERE ed.file_key = storage.objects.name
          AND ed.employee_id = public.user_employee_id(ed.org_id)
          AND NOT dc.is_sensitive
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Storage self-upload: restore own-folder branch (dropped in 00022)
-- ---------------------------------------------------------------------------
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
