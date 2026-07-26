-- Add bank account details to employees (nullable, additive only)
ALTER TABLE "employees" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "employees" ADD COLUMN "bank_account_number" TEXT;
