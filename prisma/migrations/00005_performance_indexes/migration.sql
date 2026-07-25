-- Performance indexes for dashboard and directory queries
-- These cover the most common filter patterns: org_id + employment_status,
-- org_id + status (leave), and org_id + date (attendance).

-- Employees: most dashboard queries filter by org_id + employment_status
CREATE INDEX IF NOT EXISTS "employees_org_id_employment_status_idx"
  ON "employees" ("org_id", "employment_status");

-- Leave requests: pending count queries filter by org_id + status
CREATE INDEX IF NOT EXISTS "leave_requests_org_id_status_idx"
  ON "leave_requests" ("org_id", "status");

-- Attendance records: daily attendance queries filter by org_id + date
CREATE INDEX IF NOT EXISTS "attendance_records_org_id_date_idx"
  ON "attendance_records" ("org_id", "date");
