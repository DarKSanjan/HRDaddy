-- Add calendar_feed_token to employees for ICS calendar feed authentication
ALTER TABLE "employees" ADD COLUMN "calendar_feed_token" TEXT;

-- Unique index for fast token lookups (nullable — only employees who generate a feed URL get one)
CREATE UNIQUE INDEX "employees_calendar_feed_token_key" ON "employees"("calendar_feed_token");
