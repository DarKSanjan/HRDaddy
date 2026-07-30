-- Add email_notifications_enabled preference to users table (defaults to true).
ALTER TABLE "users" ADD COLUMN "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
