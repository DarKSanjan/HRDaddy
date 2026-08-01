-- 00025 revoked EXECUTE from the `public` pseudo-role only. That did nothing
-- here: this Supabase project has a project-level
-- `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO
-- anon, authenticated, service_role` rule that auto-grants EXECUTE to those
-- three roles individually the moment any function is created in `public` —
-- a separate ACL entry from PUBLIC's, unaffected by revoking PUBLIC.
-- Confirmed by querying pg_proc.proacl directly against prod right after
-- 00025 landed: anon/authenticated still had explicit `X` entries. The
-- correct fix revokes from the named roles directly, not just PUBLIC.
REVOKE ALL ON FUNCTION public.employees_self_update_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_owner_membership() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.users_self_update_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_records_self_update_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.onboarding_tasks_self_update_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_requests_self_update_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.performance_reviews_self_update_guard() FROM anon, authenticated;
