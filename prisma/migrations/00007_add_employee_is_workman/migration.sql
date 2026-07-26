-- M12 fix: Add is_workman flag for MOM Part IV workman threshold distinction

-- AddColumn: employees.is_workman (additive, default false — no existing data changes)
ALTER TABLE "employees" ADD COLUMN "is_workman" BOOLEAN NOT NULL DEFAULT false;
