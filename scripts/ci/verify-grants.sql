-- Behavioural check of the app_user/authenticated role split, run in CI
-- against a real Postgres instance after the full migration set is applied.
-- Regex-on-migration-text (rls-hardening*.test.ts) checks that the CREATE
-- POLICY/GRANT/REVOKE statements are *present in the file* — this checks
-- what Postgres actually resolved the privileges to, using the same
-- has_*_privilege() introspection functions PostgREST itself relies on.
-- This is what caught two real bugs by hand earlier (a column-level REVOKE
-- silently losing to a pre-existing table-level GRANT; a missing user_id
-- grant that broke every policy referencing employees.user_id for
-- `authenticated`) — running it in CI means the next one gets caught
-- automatically instead of by manual Docker validation.
DO $$
DECLARE
  ok boolean;
BEGIN
  -- app_user (the app's own DB role) can read employee PII columns...
  SELECT has_column_privilege('app_user', 'employees', 'date_of_birth', 'SELECT') INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL: app_user should have SELECT on employees.date_of_birth';
  END IF;

  -- ...but a raw PostgREST caller (authenticated) cannot.
  SELECT has_column_privilege('authenticated', 'employees', 'date_of_birth', 'SELECT') INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: authenticated must NOT have SELECT on employees.date_of_birth';
  END IF;

  -- Workflow tables: app_user can write (the app's own mutations)...
  SELECT has_table_privilege('app_user', 'expense_claims', 'INSERT') INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL: app_user should have INSERT on expense_claims';
  END IF;

  -- ...but a raw PostgREST caller cannot bypass the app's own status rules.
  SELECT has_table_privilege('authenticated', 'expense_claims', 'INSERT') INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: authenticated must NOT have INSERT on expense_claims';
  END IF;

  -- write_audit_log(): only the app (as app_user) can write audit rows...
  SELECT has_function_privilege(
    'app_user', 'write_audit_log(text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE'
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL: app_user should have EXECUTE on write_audit_log';
  END IF;

  -- ...a raw caller must not be able to forge arbitrary audit entries.
  SELECT has_function_privilege(
    'authenticated', 'write_audit_log(text,text,text,text,jsonb,jsonb,jsonb)', 'EXECUTE'
  ) INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: authenticated must NOT have EXECUTE on write_audit_log';
  END IF;

  -- app_user must not be able to TRUNCATE — RLS doesn't apply to it, so a
  -- leaked APP_USER_DATABASE_URL or a raw-SQL bug could otherwise wipe every
  -- tenant's data in one statement (round 5).
  SELECT has_table_privilege('app_user', 'employees', 'TRUNCATE') INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: app_user must NOT have TRUNCATE on employees';
  END IF;

  SELECT has_table_privilege('app_user', '_prisma_migrations', 'SELECT') INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: app_user must NOT have access to _prisma_migrations';
  END IF;

  -- authenticated has no raw-REST write path on any public table, not just
  -- an enumerated list of "workflow" tables (round 5 blanket revoke).
  SELECT has_table_privilege('authenticated', 'calendar_event_recipients', 'INSERT') INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: authenticated must NOT have INSERT on calendar_event_recipients';
  END IF;

  SELECT has_table_privilege('authenticated', 'payroll_records', 'UPDATE') INTO ok;
  IF ok THEN
    RAISE EXCEPTION 'FAIL: authenticated must NOT have UPDATE on payroll_records';
  END IF;

  RAISE NOTICE 'verify-grants: all assertions passed';
END
$$;
