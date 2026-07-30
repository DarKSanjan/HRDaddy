-- Asset Requests — employee-initiated asset request workflow

-- Enum for asset request statuses
CREATE TYPE "AssetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- Asset Requests
CREATE TABLE asset_requests (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  requested_asset_id TEXT,
  reason TEXT NOT NULL,
  status "AssetRequestStatus" NOT NULL DEFAULT 'PENDING',
  requested_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by_id TEXT,
  reviewed_at TIMESTAMP(3),
  review_note TEXT,
  fulfilled_asset_id TEXT,
  CONSTRAINT asset_requests_pkey PRIMARY KEY (id),
  CONSTRAINT asset_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT asset_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT asset_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE,
  CONSTRAINT asset_requests_requested_asset_id_fkey FOREIGN KEY (requested_asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  CONSTRAINT asset_requests_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES employees(id),
  CONSTRAINT asset_requests_fulfilled_asset_id_fkey FOREIGN KEY (fulfilled_asset_id) REFERENCES assets(id) ON DELETE SET NULL
);
CREATE INDEX asset_requests_org_id_idx ON asset_requests(org_id);
CREATE INDEX asset_requests_org_id_status_idx ON asset_requests(org_id, status);
CREATE INDEX asset_requests_employee_id_idx ON asset_requests(employee_id);

-- RLS for asset_requests
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON asset_requests
  USING (org_id IN (SELECT public.user_org_ids()));
