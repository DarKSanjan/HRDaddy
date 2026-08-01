-- Supabase's security advisor (run against prod right after 00024 deployed)
-- flagged every self-update-guard trigger function as callable directly via
-- `/rest/v1/rpc/<fn>` by anon/authenticated, same class of warning
-- write_audit_log() and the user_role_in_org()-family functions already had
-- explicitly closed. These are all `RETURNS trigger` functions meant only to
-- fire as BEFORE UPDATE triggers — Postgres actually refuses to invoke a
-- trigger function directly via a normal call regardless of EXECUTE
-- privilege ("trigger functions can only be called as triggers"), so this
-- was never an exploitable path. Still closing it for the same reason
-- write_audit_log's grant is explicit rather than left at the PL/pgSQL
-- default: consistency, and no advisor noise to triage next time. Trigger
-- firing itself is unaffected — Postgres invokes trigger functions by OID
-- as part of the DML operation, not subject to the caller's EXECUTE grant.
REVOKE ALL ON FUNCTION public.employees_self_update_guard() FROM public;
REVOKE ALL ON FUNCTION public.protect_owner_membership() FROM public;
REVOKE ALL ON FUNCTION public.users_self_update_guard() FROM public;
REVOKE ALL ON FUNCTION public.attendance_records_self_update_guard() FROM public;
REVOKE ALL ON FUNCTION public.onboarding_tasks_self_update_guard() FROM public;
REVOKE ALL ON FUNCTION public.leave_requests_self_update_guard() FROM public;
REVOKE ALL ON FUNCTION public.performance_reviews_self_update_guard() FROM public;
