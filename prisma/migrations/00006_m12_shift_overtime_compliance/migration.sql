-- M12: Shift Templates, Overtime Pay, Compliance Extension Point

-- CreateEnum: PayType
CREATE TYPE "PayType" AS ENUM ('SALARIED', 'HOURLY');

-- Add OVERTIME to PayrollLineItemType
ALTER TYPE "PayrollLineItemType" ADD VALUE 'OVERTIME';

-- CreateTable: shift_templates
CREATE TABLE "shift_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_minutes" INTEGER NOT NULL,
    "end_minutes" INTEGER NOT NULL,
    "standard_minutes_per_day" INTEGER NOT NULL,
    "overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "rest_day_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 2.0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_templates_org_id_idx" ON "shift_templates"("org_id");

-- AddColumn: employees.pay_type
ALTER TABLE "employees" ADD COLUMN "pay_type" "PayType" NOT NULL DEFAULT 'SALARIED';

-- AddColumn: employees.shift_template_id
ALTER TABLE "employees" ADD COLUMN "shift_template_id" TEXT;

-- AddColumn: employment_types.default_shift_template_id
ALTER TABLE "employment_types" ADD COLUMN "default_shift_template_id" TEXT;

-- AddColumn: organisation_settings.country_code
ALTER TABLE "organisation_settings" ADD COLUMN "country_code" TEXT NOT NULL DEFAULT 'SG';

-- AddForeignKey: shift_templates -> organisations
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employees -> shift_templates
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_template_id_fkey" FOREIGN KEY ("shift_template_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: employment_types -> shift_templates
ALTER TABLE "employment_types" ADD CONSTRAINT "employment_types_default_shift_template_id_fkey" FOREIGN KEY ("default_shift_template_id") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
