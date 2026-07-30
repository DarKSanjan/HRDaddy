-- Calendar feed scopes — replace single Employee.calendarFeedToken with a
-- dedicated table supporting PERSONAL / TEAM / COMPANY scopes.

-- 1. Create enum
CREATE TYPE "CalendarFeedScope" AS ENUM ('PERSONAL', 'TEAM', 'COMPANY');

-- 2. Create table
CREATE TABLE calendar_feed_tokens (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  scope "CalendarFeedScope" NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT calendar_feed_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_feed_tokens_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT calendar_feed_tokens_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX calendar_feed_tokens_token_key ON calendar_feed_tokens(token);
CREATE UNIQUE INDEX calendar_feed_tokens_employee_id_scope_key ON calendar_feed_tokens(employee_id, scope);

-- RLS for calendar_feed_tokens (tenant-isolation via org_id)
ALTER TABLE calendar_feed_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_feed_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON calendar_feed_tokens
  USING (org_id IN (SELECT public.user_org_ids()));

-- 3. Backfill existing personal feed tokens
INSERT INTO calendar_feed_tokens (id, org_id, employee_id, scope, token)
SELECT gen_random_uuid()::text, org_id, id, 'PERSONAL', calendar_feed_token
FROM employees
WHERE calendar_feed_token IS NOT NULL;

-- 4. Drop old column
ALTER TABLE employees DROP COLUMN calendar_feed_token;
