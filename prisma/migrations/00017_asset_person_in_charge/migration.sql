-- Add person_in_charge_id to assets for ownership-based assignment authorization

ALTER TABLE "assets" ADD COLUMN "person_in_charge_id" TEXT;

ALTER TABLE "assets" ADD CONSTRAINT "assets_person_in_charge_id_fkey"
  FOREIGN KEY ("person_in_charge_id") REFERENCES "employees"("id") ON DELETE SET NULL;
