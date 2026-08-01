-- HR Daddy - enforce one employee identity per organisation.
--
-- An employee may remain unlinked to an account, so user_id stays nullable. The
-- compound constraint prevents an account from resolving to multiple employees
-- within the same organisation while still allowing multiple unlinked records.

-- Fail before applying the constraint if existing production data is ambiguous.
-- This is intentional: duplicates need manual review rather than a migration
-- silently choosing a "winner" row and losing the other employee record.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "employees"
    WHERE "user_id" IS NOT NULL
    GROUP BY "org_id", "user_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add employees_org_id_user_id_key: duplicate non-null (org_id, user_id) rows require manual review';
  END IF;
END
$$;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_org_id_user_id_key"
  UNIQUE ("org_id", "user_id");
