-- Calendar module — org-editable holidays and calendar events

-- Enum for calendar event audience
CREATE TYPE "CalendarEventAudience" AS ENUM ('COMPANY', 'DEPARTMENT', 'SPECIFIC_EMPLOYEES');

-- Holidays
CREATE TABLE holidays (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  date TIMESTAMP(3) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT holidays_pkey PRIMARY KEY (id),
  CONSTRAINT holidays_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX holidays_org_id_date_name_key ON holidays(org_id, date, name);
CREATE INDEX holidays_org_id_date_idx ON holidays(org_id, date);

-- RLS for holidays
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON holidays
  USING (org_id IN (SELECT public.user_org_ids()));

-- Calendar Events
CREATE TABLE calendar_events (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date TIMESTAMP(3) NOT NULL,
  audience "CalendarEventAudience" NOT NULL,
  department_id TEXT,
  created_by_id TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE,
  CONSTRAINT calendar_events_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT calendar_events_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES employees(id)
);
CREATE INDEX calendar_events_org_id_date_idx ON calendar_events(org_id, date);

-- RLS for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON calendar_events
  USING (org_id IN (SELECT public.user_org_ids()));

-- Calendar Event Recipients
CREATE TABLE calendar_event_recipients (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  CONSTRAINT calendar_event_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_event_recipients_event_id_fkey FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  CONSTRAINT calendar_event_recipients_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX calendar_event_recipients_event_id_employee_id_key ON calendar_event_recipients(event_id, employee_id);

-- RLS for calendar_event_recipients (indirectly scoped through calendar_events)
ALTER TABLE calendar_event_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_recipients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON calendar_event_recipients
  USING (event_id IN (SELECT id FROM calendar_events WHERE org_id IN (SELECT public.user_org_ids())));
