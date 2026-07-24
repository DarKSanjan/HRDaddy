-- Singapore annual leave is service-based: 7 days after one completed year,
-- +1 per further year, capped at 14. Sick, hospitalisation and parental leave
-- are flat. A flag on the policy lets the balance calculator tell them apart
-- without matching on leave-type names, which would break the moment an
-- organisation renames one.
ALTER TABLE leave_policies
  ADD COLUMN IF NOT EXISTS service_based BOOLEAN NOT NULL DEFAULT false;
