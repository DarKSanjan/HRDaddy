-- Expense Management module

-- Enum for expense claim statuses
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED');

-- Expense Categories (org-scoped lookup table)
CREATE TABLE expense_categories (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expense_categories_pkey PRIMARY KEY (id),
  CONSTRAINT expense_categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE INDEX expense_categories_org_id_idx ON expense_categories(org_id);

-- Expense Claims
CREATE TABLE expense_claims (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  expense_date TIMESTAMP(3) NOT NULL,
  status "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
  receipt_document_id TEXT,
  submitted_at TIMESTAMP(3),
  reviewed_by_id TEXT,
  reviewed_at TIMESTAMP(3),
  review_notes TEXT,
  reimbursed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT expense_claims_pkey PRIMARY KEY (id),
  CONSTRAINT expense_claims_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT expense_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT expense_claims_category_id_fkey FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  CONSTRAINT expense_claims_receipt_document_id_fkey FOREIGN KEY (receipt_document_id) REFERENCES employee_documents(id),
  CONSTRAINT expense_claims_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES employees(id)
);
CREATE INDEX expense_claims_org_id_idx ON expense_claims(org_id);
CREATE INDEX expense_claims_org_id_status_idx ON expense_claims(org_id, status);
CREATE INDEX expense_claims_employee_id_idx ON expense_claims(employee_id);

-- RLS for expense_categories
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON expense_categories
  USING (org_id IN (SELECT public.user_org_ids()));

-- RLS for expense_claims
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON expense_claims
  USING (org_id IN (SELECT public.user_org_ids()));
