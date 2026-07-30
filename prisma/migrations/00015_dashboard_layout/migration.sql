-- Per-user dashboard layout customization (widget order + visibility)
CREATE TABLE "dashboard_layouts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "layout" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- One layout per user per org
CREATE UNIQUE INDEX "dashboard_layouts_user_id_org_id_key" ON "dashboard_layouts"("user_id", "org_id");
CREATE INDEX "dashboard_layouts_user_id_idx" ON "dashboard_layouts"("user_id");

ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: user-scoped, NOT org-scoped. A user's layout is private and never
-- visible to colleagues, even those with the same role in the same org.
-- Mirrors the pattern used for org_setup_progress.
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_dashboard_layout ON dashboard_layouts
  USING (user_id = auth.uid()::text);
