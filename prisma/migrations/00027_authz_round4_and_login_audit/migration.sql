-- Round-4 security hardening.
--
-- A fourth external review (post round-3 deploy) found: write_audit_log() is
-- forgeable by any org member (00022 granted it to `authenticated`, and the
-- function only forces actor_id — action/target/before/after/metadata are all
-- caller-supplied); several workflow tables (attendance, expenses, asset
-- requests, leave, performance reviews, asset assignments) are still directly
-- writable by `authenticated` via raw PostgREST, bypassing the app's own
-- status/ownership rules (round 3 only did the app_user/authenticated split
-- for `employees`); calendar_events_select has no audience check at all
-- (USING (true)) and _update/_delete let any MANAGER edit any event, not just
-- its creator; users_delete_own still lets a raw REST caller delete their own
-- `users` row outside any account-deletion flow; and get_advisors (run live
-- against prod) shows write_audit_log/user_employee_id/user_role_in_org/
-- user_manages_employee are all executable by `anon` — the same
-- ALTER DEFAULT PRIVILEGES auto-grant pattern already fixed for the trigger
-- functions in 00025/00026, just never applied to these four.
--
-- Verified before writing this migration (not assumed): grepped the whole app
-- for browser-side Supabase usage — the browser client is used only for the
-- auth flow (sign in/up/out), never for data, and there is no realtime usage
-- anywhere. Every data mutation goes through dbAs() (-> app_user) or dbAdmin
-- (service role) from server actions. So revoking `authenticated`'s table-level
-- INSERT/UPDATE/DELETE on the tables below only closes the raw-REST bypass —
-- zero effect on the app, which never held `authenticated` privileges itself.

-- ---------------------------------------------------------------------------
-- 0. Round-3 regression found while validating THIS migration against local
-- Postgres: the employees column grant-back list (00024) omitted `user_id`.
-- Dozens of RLS policies across the app (leave_requests_select,
-- attendance_records_insert, expense_claims_insert, asset_requests_insert,
-- performance_reviews_*, and more) do
-- `EXISTS (SELECT 1 FROM employees e WHERE e.user_id = auth.uid()::text ...)`
-- — evaluating that under the `authenticated` role requires SELECT on
-- employees.user_id, which was never granted back. Confirmed by direct query
-- against this local instance: a raw `authenticated` SELECT on
-- leave_requests (completely unrelated to this migration's own changes)
-- failed with "permission denied for table employees" before this line was
-- added. The app itself was never affected — it runs as app_user, which has
-- the full unrestricted table grant from 00024 — this only affects a raw
-- PostgREST caller. user_id is not sensitive (it's just the auth-identity
-- FK, not PII), so there's no reason to have excluded it; this was a gap in
-- the enumerated list, not an intentional restriction.
-- ---------------------------------------------------------------------------
GRANT SELECT (user_id) ON employees TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. write_audit_log(): stop being forgeable by any org member.
--
-- writeAudit()'s tx.$executeRaw path already runs under app_user (via
-- dbAs()'s set_config('role', 'app_user', ...)), so the app is unaffected.
-- Only a raw REST caller loses access. The no-tx fallback (dbAdmin) already
-- bypasses RLS/grants entirely and was never affected either way.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.write_audit_log(text, text, text, text, jsonb, jsonb, jsonb) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, text, text, jsonb, jsonb, jsonb) TO app_user;

-- ---------------------------------------------------------------------------
-- 2. Helper functions: close the anon-execute gap. authenticated must keep
-- EXECUTE — every RLS policy in the app calls these inside its USING/WITH
-- CHECK clause, so revoking authenticated would break RLS everywhere (same
-- reasoning already applied to user_org_ids(), left untouched since round 3).
-- anon has no session (auth.uid() is NULL) and never legitimately calls these.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.user_employee_id(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_role_in_org(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_manages_employee(text, text) FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Workflow tables: close the raw-REST direct-write bypass. RLS policies
-- (all `TO authenticated`) are untouched — app_user still matches them via
-- role membership (GRANT authenticated TO app_user, from 00024), so the app's
-- own row-scoping is unaffected. This only removes the *independent* path a
-- raw PostgREST call has via the table-level GRANT from 00001.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON attendance_records FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON expense_claims FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON asset_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON leave_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON performance_reviews FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON asset_assignments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON calendar_events FROM authenticated;

-- ---------------------------------------------------------------------------
-- 4. users: drop the raw self-delete path. No account-deletion flow exists in
-- the app that needs this — it was a pure DB-layer bypass.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_delete_own ON users;
REVOKE DELETE ON users FROM authenticated;

-- ---------------------------------------------------------------------------
-- 5. calendar_events: real audience-aware SELECT, creator-aware UPDATE/DELETE.
--
-- CalendarEvent.audience is COMPANY / DEPARTMENT / SPECIFIC_EMPLOYEES;
-- DEPARTMENT carries department_id, SPECIFIC_EMPLOYEES targets rows in
-- calendar_event_recipients. The old policy (USING (true)) ignored all of
-- this. UPDATE/DELETE let any MANAGER edit any event; now only the creator
-- or an OWNER/HR_ADMIN can.
--
-- The SPECIFIC_EMPLOYEES check needs a SECURITY DEFINER helper rather than a
-- plain EXISTS subquery: calendar_event_recipients_select (00022) itself
-- queries calendar_events to resolve the parent event's org, so a direct
-- subquery here would recurse (calendar_events -> calendar_event_recipients
-- -> calendar_events -> ...) — confirmed by actually running this migration
-- against a local Postgres instance ("infinite recursion detected in policy
-- for relation calendar_events"), not assumed. A SECURITY DEFINER function
-- evaluates its own query as the function owner, bypassing RLS on the tables
-- it touches, the same way user_role_in_org()/user_manages_employee() already
-- do for employees/organisation_memberships.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_calendar_event_recipient(p_event_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM calendar_event_recipients cer
    JOIN employees e ON e.id = cer.employee_id
    WHERE cer.event_id = p_event_id
      AND e.user_id = auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_calendar_event_recipient(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_is_calendar_event_recipient(text) TO authenticated;

DROP POLICY IF EXISTS calendar_events_select ON calendar_events;
CREATE POLICY calendar_events_select ON calendar_events
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR created_by_id = public.user_employee_id(org_id)
    OR audience = 'COMPANY'::"CalendarEventAudience"
    OR (
      audience = 'DEPARTMENT'::"CalendarEventAudience"
      AND department_id IN (
        SELECT e.department_id FROM employees e
        WHERE e.org_id = calendar_events.org_id AND e.user_id = auth.uid()::text
      )
    )
    OR public.user_is_calendar_event_recipient(id)
  );

DROP POLICY IF EXISTS calendar_events_update ON calendar_events;
CREATE POLICY calendar_events_update ON calendar_events
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR created_by_id = public.user_employee_id(org_id)
  )
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR created_by_id = public.user_employee_id(org_id)
  );

DROP POLICY IF EXISTS calendar_events_delete ON calendar_events;
CREATE POLICY calendar_events_delete ON calendar_events
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR created_by_id = public.user_employee_id(org_id)
  );

-- ---------------------------------------------------------------------------
-- 6. performance_reviews: self-insert as reviewer must not be able to name
-- ANY coworker as reviewee — only someone they actually *directly* manage.
-- Matches canSubmitReviewAs() (src/modules/performance/utils.ts) exactly,
-- which checks callerEmployeeId === employeeManagerId, not the full manager
-- chain — user_manages_employee() walks the chain and would be laxer than
-- the app's own rule, so it's not used here.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS performance_reviews_insert ON performance_reviews;
CREATE POLICY performance_reviews_insert ON performance_reviews
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_role_in_org(org_id) IN ('OWNER'::"OrgRole", 'HR_ADMIN'::"OrgRole")
    OR (
      reviewer_id = public.user_employee_id(org_id)
      AND reviewer_id <> employee_id
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_id
          AND e.org_id = performance_reviews.org_id
          AND e.manager_id = reviewer_id
      )
      AND status = 'PENDING'::"PerformanceReviewStatus"
      AND submitted_at IS NULL
    )
  );
