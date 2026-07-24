-- Closes gaps reported by the Supabase security advisor after 00001.

-- ---------------------------------------------------------------------------
-- onboarding_template_tasks was missed by the first pass because it carries no
-- org_id — it is keyed only by template_id. PostgREST exposes it regardless, so
-- without a policy any signed-in user could read every organisation's
-- onboarding templates. Scope it through its parent template.
-- ---------------------------------------------------------------------------
ALTER TABLE onboarding_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_template_tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON onboarding_template_tasks;
CREATE POLICY tenant_isolation ON onboarding_template_tasks
  USING (
    template_id IN (
      SELECT t.id FROM onboarding_templates t
      WHERE t.org_id IN (SELECT public.user_org_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Prisma's migration ledger sits in public and is therefore exposed through the
-- Data API. It has no business being readable by application roles: it reveals
-- schema history and migration checksums.
-- ---------------------------------------------------------------------------
ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE _prisma_migrations FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user() is a trigger function. It was reachable as an RPC endpoint
-- at /rest/v1/rpc/handle_new_user by both anon and authenticated. A SECURITY
-- DEFINER function that writes to public.users should never be callable
-- directly.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- user_org_ids() must stay executable by `authenticated` — the RLS policies
-- call it as the invoking role, so revoking it would break every policy. It is
-- safe for that role: it returns only the caller's own organisation ids, which
-- they are entitled to know. It should not be reachable anonymously.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.user_org_ids() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
