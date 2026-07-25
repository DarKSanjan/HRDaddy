# Entity-Relationship Diagram

Generated from `prisma/schema/*.prisma` files. All IDs are UUIDs. Table names shown are the `@@map`'d Postgres names.

## Mermaid Diagram

```mermaid
erDiagram
    %% ─── Identity ───
    users {
        text id PK "UUID"
        text email UK
        text name
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    organisations {
        text id PK "UUID"
        text name
        text slug UK
        timestamp created_at
        timestamp updated_at
    }

    organisation_memberships {
        text id PK "UUID"
        text user_id FK
        text org_id FK
        OrgRole role "OWNER|HR_ADMIN|MANAGER|EMPLOYEE"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    invitations {
        text id PK "UUID"
        text org_id FK
        text email
        OrgRole role
        text token UK
        InvitationStatus status
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Organisation Config ───
    organisation_settings {
        text id PK "UUID"
        text org_id FK UK
        text timezone
        text currency
        text date_format
        json working_days
        text working_hours_start
        text working_hours_end
        int leave_year_start
        text brand_primary_color
        text brand_logo_url
        timestamp created_at
        timestamp updated_at
    }

    organisation_modules {
        text id PK "UUID"
        text org_id FK
        text module_id
        boolean enabled
        json settings
        timestamp enabled_at
        timestamp created_at
        timestamp updated_at
    }

    org_setup_progress {
        text id PK "UUID"
        text user_id FK
        int step
        json data
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Employees ───
    employees {
        text id PK "UUID"
        text org_id FK
        text user_id FK "nullable"
        text first_name
        text last_name
        text work_email
        text personal_email "nullable"
        text phone "nullable"
        date date_of_birth "nullable"
        text gender "nullable"
        text national_id "nullable"
        text address "nullable"
        EmploymentStatus employment_status
        date start_date "nullable"
        date end_date "nullable"
        text department_id FK "nullable"
        text job_title_id FK "nullable"
        text location_id FK "nullable"
        text employment_type_id FK "nullable"
        text manager_id FK "nullable, self-ref"
        int compensation_amount_cents "nullable"
        text compensation_currency "nullable"
        ResidencyStatus residency_status "nullable"
        date pr_start_date "nullable"
        PrArrangement pr_arrangement "nullable"
        timestamp created_at
        timestamp updated_at
    }

    departments {
        text id PK "UUID"
        text org_id FK
        text name
        text manager_id FK "nullable"
        boolean is_archived
        timestamp created_at
        timestamp updated_at
    }

    job_titles {
        text id PK "UUID"
        text org_id FK
        text name
        timestamp created_at
        timestamp updated_at
    }

    work_locations {
        text id PK "UUID"
        text org_id FK
        text name
        text address "nullable"
        timestamp created_at
        timestamp updated_at
    }

    employment_types {
        text id PK "UUID"
        text org_id FK
        text name
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Leave ───
    leave_types {
        text id PK "UUID"
        text org_id FK
        text name
        text color
        boolean requires_approval
        boolean requires_document
        int max_consecutive_days "nullable"
        timestamp created_at
        timestamp updated_at
    }

    leave_policies {
        text id PK "UUID"
        text org_id FK
        text leave_type_id FK
        decimal default_allowance
        int carry_over_limit
        boolean accrual_enabled
        boolean service_based
        timestamp created_at
        timestamp updated_at
    }

    leave_balances {
        text id PK "UUID"
        text org_id FK
        text employee_id FK
        text leave_type_id FK
        int year
        decimal allowance
        decimal used
        decimal pending
        timestamp created_at
        timestamp updated_at
    }

    leave_requests {
        text id PK "UUID"
        text org_id FK
        text employee_id FK
        text leave_type_id FK
        date start_date
        date end_date
        boolean is_half_day
        text half_day_period "nullable"
        decimal total_days
        text reason "nullable"
        LeaveRequestStatus status
        text reviewed_by_id FK "nullable"
        timestamp reviewed_at "nullable"
        text review_note "nullable"
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Attendance ───
    attendance_records {
        text id PK "UUID"
        text org_id FK
        text employee_id FK
        date date
        timestamp clock_in
        timestamp clock_out "nullable"
        int duration_minutes "nullable"
        AttendanceType type "OFFICE|REMOTE"
        AttendanceStatus status
        text corrected_by_id FK "nullable"
        text correction_reason "nullable"
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Onboarding ───
    onboarding_templates {
        text id PK "UUID"
        text org_id FK
        text name
        text description "nullable"
        boolean is_archived
        timestamp created_at
        timestamp updated_at
    }

    onboarding_template_tasks {
        text id PK "UUID"
        text template_id FK
        text title
        text description "nullable"
        OnboardingAssigneeType assignee_type
        int due_in_days
        int sort_order
        timestamp created_at
        timestamp updated_at
    }

    employee_onboardings {
        text id PK "UUID"
        text org_id FK
        text employee_id FK
        text template_id FK
        OnboardingStatus status
        timestamp started_at "nullable"
        timestamp completed_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    employee_onboarding_tasks {
        text id PK "UUID"
        text onboarding_id FK
        text org_id FK
        text title
        text description "nullable"
        OnboardingAssigneeType assignee_type
        text assignee_id FK "nullable"
        date due_date "nullable"
        OnboardingTaskStatus status
        timestamp completed_at "nullable"
        text notes "nullable"
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Documents ───
    document_categories {
        text id PK "UUID"
        text org_id FK
        text name
        boolean is_sensitive
        timestamp created_at
        timestamp updated_at
    }

    employee_documents {
        text id PK "UUID"
        text org_id FK
        text employee_id FK
        text category_id FK
        text file_name
        text file_key
        int file_size
        text mime_type
        timestamp expires_at "nullable"
        boolean is_archived
        text uploaded_by_id FK
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Payroll ───
    payroll_periods {
        text id PK "UUID"
        text org_id FK
        text name
        date start_date
        date end_date
        PayrollPeriodStatus status
        text approved_by_id FK "nullable"
        timestamp approved_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    payroll_records {
        text id PK "UUID"
        text org_id FK
        text period_id FK
        text employee_id FK
        int gross_amount_cents
        int net_amount_cents
        int cpf_total_cents "nullable"
        int cpf_employee_cents "nullable"
        int cpf_employer_cents "nullable"
        int ytd_ow_cents "nullable"
        boolean is_published
        timestamp published_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    payroll_line_items {
        text id PK "UUID"
        text record_id FK
        text org_id FK
        PayrollLineItemType type "EARNING|ALLOWANCE|DEDUCTION"
        text name
        int amount_cents
        timestamp created_at
        timestamp updated_at
    }

    %% ─── Audit & Notifications ───
    notifications {
        text id PK "UUID"
        text org_id FK
        text user_id FK
        text title
        text message
        text link "nullable"
        boolean is_read
        timestamp created_at
        timestamp updated_at
    }

    audit_logs {
        text id PK "UUID"
        text org_id FK
        text actor_id FK
        text action
        text target_type
        text target_id
        json before "nullable"
        json after "nullable"
        json metadata "nullable"
        timestamp created_at
    }

    %% ─── Relations ───
    users ||--o{ organisation_memberships : "has memberships"
    organisations ||--o{ organisation_memberships : "has members"
    organisations ||--|| organisation_settings : "has settings"
    organisations ||--o{ organisation_modules : "has modules"
    organisations ||--o{ invitations : "sends invitations"
    organisations ||--o{ employees : "employs"
    organisations ||--o{ departments : "has departments"
    organisations ||--o{ job_titles : "has job titles"
    organisations ||--o{ work_locations : "has locations"
    organisations ||--o{ employment_types : "has employment types"
    organisations ||--o{ leave_types : "has leave types"
    organisations ||--o{ leave_policies : "has leave policies"
    organisations ||--o{ leave_balances : "has leave balances"
    organisations ||--o{ leave_requests : "has leave requests"
    organisations ||--o{ attendance_records : "has attendance"
    organisations ||--o{ onboarding_templates : "has templates"
    organisations ||--o{ employee_onboardings : "has onboardings"
    organisations ||--o{ document_categories : "has doc categories"
    organisations ||--o{ employee_documents : "has documents"
    organisations ||--o{ payroll_periods : "has payroll periods"
    organisations ||--o{ payroll_records : "has payroll records"
    organisations ||--o{ notifications : "has notifications"
    organisations ||--o{ audit_logs : "has audit logs"

    users ||--o{ org_setup_progress : "has setup progress"
    users ||--o{ employees : "linked to employee"
    users ||--o{ notifications : "receives notifications"

    employees ||--o{ leave_balances : "has balances"
    employees ||--o{ leave_requests : "submits requests"
    employees ||--o{ attendance_records : "has attendance"
    employees ||--o{ employee_onboardings : "has onboarding"
    employees ||--o{ employee_documents : "has documents"
    employees ||--o{ payroll_records : "has payroll"
    employees }o--o| departments : "belongs to"
    employees }o--o| job_titles : "has title"
    employees }o--o| work_locations : "works at"
    employees }o--o| employment_types : "employment type"
    employees }o--o| employees : "reports to (manager)"

    departments }o--o| employees : "managed by"

    leave_types ||--o{ leave_policies : "has policies"
    leave_types ||--o{ leave_balances : "type for balance"
    leave_types ||--o{ leave_requests : "type for request"

    leave_requests }o--o| employees : "reviewed by"

    onboarding_templates ||--o{ onboarding_template_tasks : "has tasks"
    onboarding_templates ||--o{ employee_onboardings : "used by"
    employee_onboardings ||--o{ employee_onboarding_tasks : "has tasks"

    document_categories ||--o{ employee_documents : "categorises"
    employees ||--o{ employee_documents : "uploaded by (uploadedById)"

    payroll_periods ||--o{ payroll_records : "contains records"
    payroll_records ||--o{ payroll_line_items : "has line items"

    attendance_records }o--o| employees : "corrected by"
```

## Enums

| Enum | Values |
|------|--------|
| OrgRole | OWNER, HR_ADMIN, MANAGER, EMPLOYEE |
| InvitationStatus | PENDING, ACCEPTED, EXPIRED, REVOKED |
| EmploymentStatus | DRAFT, INVITED, ACTIVE, SUSPENDED, DEACTIVATED, ARCHIVED |
| LeaveRequestStatus | DRAFT, PENDING, APPROVED, REJECTED, CANCELLED, WITHDRAWN |
| AttendanceType | OFFICE, REMOTE |
| AttendanceStatus | OPEN, CLOSED, MISSING_CLOCK_OUT, CORRECTED |
| OnboardingStatus | NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED |
| OnboardingAssigneeType | EMPLOYEE, MANAGER, HR |
| OnboardingTaskStatus | PENDING, IN_PROGRESS, COMPLETED, WAIVED |
| PayrollPeriodStatus | DRAFT, UNDER_REVIEW, APPROVED, PUBLISHED, PAID, ARCHIVED, REOPENED |
| ResidencyStatus | CITIZEN, PR, FOREIGNER |
| PrArrangement | GRADUATED_GRADUATED, FULL_GRADUATED |
| PayrollLineItemType | EARNING, ALLOWANCE, DEDUCTION |

## Table Count

27 tables across 8 Prisma schema files.

## Notes

- All tables use UUID primary keys.
- All org-owned tables include `org_id` for RLS scoping (except `onboarding_template_tasks` which scopes through its parent template).
- `leave_balances` has a unique compound index on `(employee_id, leave_type_id, year)`.
- `organisation_modules` has a unique compound index on `(org_id, module_id)`.
- `organisation_memberships` has a unique compound index on `(user_id, org_id)`.
- `payroll_line_items` uses `org_id` independently (not derived from `payroll_records`) to enable direct RLS policy evaluation.
