-- HR Daddy - database-level safety nets for TOCTOU races.
--
-- The advisory-lock fixes in payroll/attendance/asset-assignment application
-- code (mirroring the leave module's existing pattern) close these races for
-- normal request paths. These constraints are the belt-and-suspenders layer:
-- they make the invalid state impossible to persist at all, regardless of
-- how it was reached (a missed lock, a direct DB write, a future bug).

-- ---------------------------------------------------------------------------
-- One payroll record per (period, employee) — two concurrent process-payroll
-- runs for the same period can no longer both insert a record for the same
-- employee.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payroll_records"
    GROUP BY "period_id", "employee_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add payroll_records_period_id_employee_id_key: duplicate (period_id, employee_id) rows require manual review';
  END IF;
END
$$;

ALTER TABLE "payroll_records"
  ADD CONSTRAINT "payroll_records_period_id_employee_id_key"
  UNIQUE ("period_id", "employee_id");

-- ---------------------------------------------------------------------------
-- One open attendance session per employee — two concurrent clock-ins can no
-- longer both create an OPEN record.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "attendance_records"
    WHERE "status" = 'OPEN'
    GROUP BY "employee_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add attendance_one_open_per_employee: an employee already has more than one OPEN attendance record and needs manual review';
  END IF;
END
$$;

CREATE UNIQUE INDEX "attendance_one_open_per_employee"
  ON "attendance_records" ("employee_id")
  WHERE "status" = 'OPEN';

-- ---------------------------------------------------------------------------
-- One open assignment per asset — two concurrent assignments can no longer
-- both succeed for the same asset.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "asset_assignments"
    WHERE "returned_at" IS NULL
    GROUP BY "asset_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add asset_assignments_one_open_per_asset: an asset already has more than one open assignment and needs manual review';
  END IF;
END
$$;

CREATE UNIQUE INDEX "asset_assignments_one_open_per_asset"
  ON "asset_assignments" ("asset_id")
  WHERE "returned_at" IS NULL;
