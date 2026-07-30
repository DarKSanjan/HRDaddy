-- Asset Management module

-- Enum for asset statuses
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED', 'LOST');

-- Asset Categories (org-scoped lookup table)
CREATE TABLE asset_categories (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT asset_categories_pkey PRIMARY KEY (id),
  CONSTRAINT asset_categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX asset_categories_org_id_idx ON asset_categories(org_id);

-- Assets
CREATE TABLE assets (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_tag TEXT NOT NULL,
  status "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  purchase_date TIMESTAMP(3),
  purchase_value_cents INTEGER,
  notes TEXT,
  current_assignment_id TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES asset_categories(id)
);
CREATE INDEX assets_org_id_idx ON assets(org_id);
CREATE INDEX assets_org_id_status_idx ON assets(org_id, status);
CREATE UNIQUE INDEX assets_org_id_asset_tag_key ON assets(org_id, asset_tag);
CREATE UNIQUE INDEX assets_current_assignment_id_key ON assets(current_assignment_id);

-- Asset Assignments
CREATE TABLE asset_assignments (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by_id TEXT NOT NULL,
  returned_at TIMESTAMP(3),
  returned_by_id TEXT,
  condition_at_assignment TEXT,
  condition_at_return TEXT,
  notes TEXT,
  CONSTRAINT asset_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT asset_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT asset_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT asset_assignments_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES employees(id),
  CONSTRAINT asset_assignments_returned_by_id_fkey FOREIGN KEY (returned_by_id) REFERENCES employees(id)
);
CREATE INDEX asset_assignments_org_id_idx ON asset_assignments(org_id);
CREATE INDEX asset_assignments_asset_id_idx ON asset_assignments(asset_id);
CREATE INDEX asset_assignments_employee_id_idx ON asset_assignments(employee_id);

-- Add FK from assets.current_assignment_id to asset_assignments after both tables exist
ALTER TABLE assets ADD CONSTRAINT assets_current_assignment_id_fkey
  FOREIGN KEY (current_assignment_id) REFERENCES asset_assignments(id);

-- RLS for asset_categories
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON asset_categories
  USING (org_id IN (SELECT public.user_org_ids()));

-- RLS for assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON assets
  USING (org_id IN (SELECT public.user_org_ids()));

-- RLS for asset_assignments
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON asset_assignments
  USING (org_id IN (SELECT public.user_org_ids()));
