-- M14: Performance reviews module
-- Creates performance_cycles, performance_reviews, performance_competency_scores
-- with RLS enabled on all three tables from the start (avoiding the M12 gap).

-- Enums
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PUBLISHED');
CREATE TYPE "PerformanceCompetency" AS ENUM ('JOB_KNOWLEDGE', 'QUALITY_OF_WORK', 'COMMUNICATION', 'TEAMWORK', 'INITIATIVE', 'RELIABILITY');

-- performance_cycles
CREATE TABLE "performance_cycles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "performance_cycles_org_id_idx" ON "performance_cycles"("org_id");

ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on performance_cycles
ALTER TABLE performance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_cycles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON performance_cycles
  USING (org_id IN (SELECT public.user_org_ids()));

-- performance_reviews
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "overall_score" INTEGER,
    "strengths" TEXT,
    "improvements" TEXT,
    "goals" TEXT,
    "self_assessment" TEXT,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_reviews_cycle_id_employee_id_key" ON "performance_reviews"("cycle_id", "employee_id");
CREATE INDEX "performance_reviews_org_id_idx" ON "performance_reviews"("org_id");
CREATE INDEX "performance_reviews_employee_id_idx" ON "performance_reviews"("employee_id");

ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS on performance_reviews
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON performance_reviews
  USING (org_id IN (SELECT public.user_org_ids()));

-- performance_competency_scores
CREATE TABLE "performance_competency_scores" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "competency" "PerformanceCompetency" NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "performance_competency_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_competency_scores_review_id_competency_key" ON "performance_competency_scores"("review_id", "competency");

ALTER TABLE "performance_competency_scores" ADD CONSTRAINT "performance_competency_scores_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on performance_competency_scores
-- This table has no org_id column — RLS is enforced via the parent review's org_id.
-- Use a subquery join to the parent table for tenant isolation.
ALTER TABLE performance_competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_competency_scores FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON performance_competency_scores
  USING (review_id IN (
    SELECT id FROM performance_reviews
    WHERE org_id IN (SELECT public.user_org_ids())
  ));
