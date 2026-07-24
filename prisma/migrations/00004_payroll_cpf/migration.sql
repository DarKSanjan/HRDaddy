-- Migration: Add CPF fields to payroll and residency fields to employees
-- Adds REOPENED to PayrollPeriodStatus, ResidencyStatus and PrArrangement enums

-- Add REOPENED to PayrollPeriodStatus
ALTER TYPE "PayrollPeriodStatus" ADD VALUE IF NOT EXISTS 'REOPENED';

-- Create ResidencyStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResidencyStatus') THEN
    CREATE TYPE "ResidencyStatus" AS ENUM ('CITIZEN', 'PR', 'FOREIGNER');
  END IF;
END $$;

-- Create PrArrangement enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrArrangement') THEN
    CREATE TYPE "PrArrangement" AS ENUM ('GRADUATED_GRADUATED', 'FULL_GRADUATED');
  END IF;
END $$;

-- Add CPF columns to payroll_records
ALTER TABLE "payroll_records"
  ADD COLUMN IF NOT EXISTS "cpf_total_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "cpf_employee_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "cpf_employer_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "ytd_ow_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);

-- Add residency columns to employees
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "residency_status" "ResidencyStatus",
  ADD COLUMN IF NOT EXISTS "pr_start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pr_arrangement" "PrArrangement";
