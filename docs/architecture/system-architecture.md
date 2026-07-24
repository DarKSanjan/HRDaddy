# System Architecture

This document defines the HR Daddy V1 system architecture covering context, containers, components, and cross-cutting concerns.

---

## 1. System Context Diagram

```mermaid
C4Context
    title System Context — HR Daddy

    Person(employee, "Employee", "Self-service: attendance, leave, documents, payslips")
    Person(manager, "Manager", "Team oversight: approvals, reports, onboarding")
    Person(hr_admin, "HR Administrator", "Employee lifecycle, policies, payroll, audit")
    Person(owner, "Owner", "Organisation setup, settings, ownership")

    System(hrdaddy, "HR Daddy", "Modular HR management platform for SMEs")

    System_Ext(email, "Email Provider", "SMTP relay for notifications and invitations")
    System_Ext(storage, "Object Storage", "Local filesystem or S3-compatible storage")
    System_Ext(db, "PostgreSQL", "Primary relational data store")

    Rel(employee, hrdaddy, "Uses", "HTTPS")
    Rel(manager, hrdaddy, "Uses", "HTTPS")
    Rel(hr_admin, hrdaddy, "Uses", "HTTPS")
    Rel(owner, hrdaddy, "Uses", "HTTPS")
    Rel(hrdaddy, email, "Sends emails", "SMTP/API")
    Rel(hrdaddy, storage, "Stores/retrieves files", "Filesystem/S3 API")
    Rel(hrdaddy, db, "Reads/writes data", "TCP/5432")
```

---

## 2. Container Diagram

```mermaid
C4Container
    title Container Diagram — HR Daddy

    Person(user, "User", "Any authenticated actor")

    Container_Boundary(browser, "Browser") {
        Container(spa, "Next.js Client", "React, Tailwind, shadcn/ui", "Server-rendered pages with client interactivity")
    }

    Container_Boundary(server, "Next.js Application Server") {
        Container(app, "App Router", "Next.js 14+, TypeScript", "Server components, server actions, API routes")
        Container(auth, "Auth Layer", "Session middleware", "httpOnly cookie sessions, CSRF protection")
        Container(services, "Domain Services", "TypeScript", "Business logic per module")
        Container(repos, "Repositories", "Prisma Client", "Tenant-scoped data access")
        Container(jobs, "Background Jobs", "Node.js workers", "Scheduled tasks: expiry checks, cleanup")
    }

    ContainerDb(db, "PostgreSQL", "Primary database", "All tenant and global data")
    Container_Ext(storage, "Object Storage", "Local/S3", "Employee documents, branding assets")
    Container_Ext(email, "Email Service", "SMTP/Resend/SES", "Transactional email delivery")

    Rel(user, spa, "Interacts", "HTTPS")
    Rel(spa, app, "Requests", "HTTP/Server Actions")
    Rel(app, auth, "Validates session")
    Rel(app, services, "Delegates business logic")
    Rel(services, repos, "Data access")
    Rel(repos, db, "SQL queries", "Prisma")
    Rel(services, storage, "File operations")
    Rel(services, email, "Send notifications")
    Rel(jobs, db, "Scheduled queries")
    Rel(jobs, email, "Async notifications")
```

---

## 3. Application Modules

HR Daddy is a modular monolith. Each module encapsulates its own domain logic, services, repositories, and UI routes while sharing infrastructure (auth, DB connection, notification bus).

| Module | Responsibility |
|--------|---------------|
| **Auth** | Registration, login, session, password reset, invitation acceptance |
| **Organisation** | Org CRUD, settings, membership, branding |
| **Employee** | Employee lifecycle, directory, profiles, departments, job titles, reporting |
| **Leave** | Leave types, policies, balances, requests, approvals, calendar |
| **Attendance** | Clock in/out, history, corrections, missing clock-out detection |
| **Onboarding** | Templates, task assignment, completion tracking |
| **Documents** | Categories, upload/download, expiry, visibility |
| **Payroll** | Periods, records, line items, approval, payslip publication |
| **Notifications** | In-app notifications, email dispatch, deduplication |
| **Audit** | Append-only event recording, query interface |

---

## 4. Component Diagrams

### 4.1 Authentication

```mermaid
graph TB
    subgraph "Auth Module"
        LoginPage[Login Page]
        RegisterPage[Register Page]
        ResetPage[Password Reset]
        InvitePage[Invitation Accept]
        
        AuthAction[Auth Server Actions]
        SessionService[Session Service]
        PasswordService[Password Service]
        InvitationService[Invitation Service]
        
        SessionStore[(Session Store / DB)]
        UserRepo[User Repository]
    end

    LoginPage --> AuthAction
    RegisterPage --> AuthAction
    ResetPage --> AuthAction
    InvitePage --> AuthAction
    
    AuthAction --> SessionService
    AuthAction --> PasswordService
    AuthAction --> InvitationService
    
    SessionService --> SessionStore
    PasswordService --> UserRepo
    InvitationService --> UserRepo
```

### 4.2 Employee Management

```mermaid
graph TB
    subgraph "Employee Module"
        Directory[Employee Directory]
        Profile[Employee Profile]
        CreateForm[Create Employee]
        
        EmployeeActions[Server Actions]
        EmployeeService[Employee Service]
        DepartmentService[Department Service]
        ReportingService[Reporting Service]
        
        EmployeeRepo[Employee Repository]
        DeptRepo[Department Repository]
        ReportingRepo[Reporting Repository]
    end

    subgraph "Shared"
        PermissionService[Permission Service]
        AuditService[Audit Service]
        NotificationService[Notification Service]
    end

    Directory --> EmployeeActions
    Profile --> EmployeeActions
    CreateForm --> EmployeeActions
    
    EmployeeActions --> PermissionService
    EmployeeActions --> EmployeeService
    EmployeeService --> EmployeeRepo
    EmployeeService --> DepartmentService
    EmployeeService --> ReportingService
    EmployeeService --> AuditService
    EmployeeService --> NotificationService
    
    DepartmentService --> DeptRepo
    ReportingService --> ReportingRepo
```

### 4.3 Leave Management

```mermaid
graph TB
    subgraph "Leave Module"
        LeaveForm[Leave Request Form]
        ApprovalInbox[Approval Inbox]
        Calendar[Team Calendar]
        BalanceView[Balance View]
        
        LeaveActions[Server Actions]
        LeaveService[Leave Service]
        BalanceService[Balance Service]
        WorkingDayCalc[Working Day Calculator]
        PolicyService[Leave Policy Service]
        
        LeaveRepo[Leave Repository]
        BalanceRepo[Balance Repository]
    end

    subgraph "Shared"
        PermSvc[Permission Service]
        AuditSvc[Audit Service]
        NotifSvc[Notification Service]
        OrgSettings[Org Settings Reader]
    end

    LeaveForm --> LeaveActions
    ApprovalInbox --> LeaveActions
    
    LeaveActions --> PermSvc
    LeaveActions --> LeaveService
    LeaveService --> BalanceService
    LeaveService --> WorkingDayCalc
    LeaveService --> PolicyService
    LeaveService --> AuditSvc
    LeaveService --> NotifSvc
    
    WorkingDayCalc --> OrgSettings
    BalanceService --> BalanceRepo
    LeaveService --> LeaveRepo
```

### 4.4 Attendance

```mermaid
graph TB
    subgraph "Attendance Module"
        ClockWidget[Clock In/Out Widget]
        History[Attendance History]
        CorrectionForm[Correction Form]
        
        AttActions[Server Actions]
        AttService[Attendance Service]
        DurationCalc[Duration Calculator]
        TimezoneService[Timezone Service]
        
        AttRepo[Attendance Repository]
    end

    subgraph "Shared"
        PermSvc[Permission Service]
        AuditSvc[Audit Service]
        NotifSvc[Notification Service]
        LeaveChecker[Leave Status Checker]
    end

    ClockWidget --> AttActions
    History --> AttActions
    CorrectionForm --> AttActions
    
    AttActions --> PermSvc
    AttActions --> AttService
    AttService --> DurationCalc
    AttService --> TimezoneService
    AttService --> LeaveChecker
    AttService --> AttRepo
    AttService --> AuditSvc
    AttService --> NotifSvc
```

### 4.5 Onboarding

```mermaid
graph TB
    subgraph "Onboarding Module"
        TemplateEditor[Template Editor]
        TaskList[Employee Task List]
        OverdueView[Overdue Tasks View]
        
        OnbActions[Server Actions]
        TemplateService[Template Service]
        OnboardingService[Onboarding Service]
        TaskService[Task Service]
        DueDateCalc[Due Date Calculator]
        
        TemplateRepo[Template Repository]
        OnboardingRepo[Onboarding Repository]
        TaskRepo[Task Repository]
    end

    subgraph "Shared"
        PermSvc[Permission Service]
        AuditSvc[Audit Service]
        NotifSvc[Notification Service]
    end

    TemplateEditor --> OnbActions
    TaskList --> OnbActions
    
    OnbActions --> PermSvc
    OnbActions --> OnboardingService
    OnboardingService --> TemplateService
    OnboardingService --> TaskService
    OnboardingService --> DueDateCalc
    OnboardingService --> AuditSvc
    OnboardingService --> NotifSvc
    
    TemplateService --> TemplateRepo
    TaskService --> TaskRepo
    OnboardingService --> OnboardingRepo
```

### 4.6 Documents

```mermaid
graph TB
    subgraph "Document Module"
        UploadForm[Upload Form]
        DocList[Document List]
        Download[Download Handler]
        
        DocActions[Server Actions]
        DocService[Document Service]
        StorageAdapter[Storage Adapter]
        ExpiryService[Expiry Service]
        VisibilityService[Visibility Service]
        
        DocRepo[Document Repository]
        CategoryRepo[Category Repository]
    end

    subgraph "Infrastructure"
        LocalFS[Local Filesystem]
        S3[S3-Compatible Storage]
    end

    subgraph "Shared"
        PermSvc[Permission Service]
        AuditSvc[Audit Service]
        NotifSvc[Notification Service]
    end

    UploadForm --> DocActions
    DocList --> DocActions
    Download --> DocActions
    
    DocActions --> PermSvc
    DocActions --> DocService
    DocService --> StorageAdapter
    DocService --> VisibilityService
    DocService --> ExpiryService
    DocService --> DocRepo
    DocService --> CategoryRepo
    DocService --> AuditSvc
    DocService --> NotifSvc
    
    StorageAdapter --> LocalFS
    StorageAdapter --> S3
```

### 4.7 Payroll

```mermaid
graph TB
    subgraph "Payroll Module"
        PeriodList[Period List]
        RecordEditor[Record Editor]
        PayslipView[Payslip View]
        
        PayActions[Server Actions]
        PeriodService[Period Service]
        RecordService[Record Service]
        CalcService[Calculation Service]
        PayslipService[Payslip Service]
        
        PeriodRepo[Period Repository]
        RecordRepo[Record Repository]
        LineItemRepo[Line Item Repository]
    end

    subgraph "Shared"
        PermSvc[Permission Service]
        AuditSvc[Audit Service]
        NotifSvc[Notification Service]
    end

    PeriodList --> PayActions
    RecordEditor --> PayActions
    PayslipView --> PayActions
    
    PayActions --> PermSvc
    PayActions --> PeriodService
    PeriodService --> RecordService
    RecordService --> CalcService
    RecordService --> LineItemRepo
    PeriodService --> PayslipService
    PeriodService --> PeriodRepo
    RecordService --> RecordRepo
    PeriodService --> AuditSvc
    PayslipService --> NotifSvc
```

### 4.8 Notifications

```mermaid
graph TB
    subgraph "Notification Module"
        NotifBell[Notification Bell]
        NotifList[Notification List]
        
        NotifActions[Server Actions]
        NotifService[Notification Service]
        DeduplicationService[Deduplication Service]
        EmailDispatcher[Email Dispatcher]
        
        NotifRepo[Notification Repository]
    end

    subgraph "External"
        SMTP[SMTP / Email API]
    end

    NotifBell --> NotifActions
    NotifList --> NotifActions
    
    NotifActions --> NotifService
    NotifService --> DeduplicationService
    NotifService --> NotifRepo
    NotifService --> EmailDispatcher
    EmailDispatcher --> SMTP
```

### 4.9 Audit

```mermaid
graph TB
    subgraph "Audit Module"
        AuditLogUI[Audit Log Page]
        
        AuditActions[Server Actions / Read-only]
        AuditService[Audit Service]
        
        AuditRepo[Audit Repository / Append-Only]
    end

    subgraph "All Modules"
        AnyService[Any Domain Service]
    end

    AuditLogUI --> AuditActions
    AuditActions --> AuditService
    AuditService --> AuditRepo
    
    AnyService -->|"recordEvent()"| AuditService
```

---

## 5. Backend Boundaries

```
src/
├── modules/
│   ├── auth/
│   │   ├── actions/          # Server actions (login, register, reset)
│   │   ├── services/         # SessionService, PasswordService
│   │   └── repositories/     # UserRepository
│   ├── organisation/
│   │   ├── actions/
│   │   ├── services/         # OrgService, MembershipService
│   │   └── repositories/
│   ├── employee/
│   │   ├── actions/
│   │   ├── services/         # EmployeeService, DepartmentService, ReportingService
│   │   └── repositories/
│   ├── leave/
│   │   ├── actions/
│   │   ├── services/         # LeaveService, BalanceService, PolicyService
│   │   └── repositories/
│   ├── attendance/
│   │   ├── actions/
│   │   ├── services/         # AttendanceService, DurationCalculator
│   │   └── repositories/
│   ├── onboarding/
│   │   ├── actions/
│   │   ├── services/         # OnboardingService, TemplateService
│   │   └── repositories/
│   ├── documents/
│   │   ├── actions/
│   │   ├── services/         # DocumentService, ExpiryService
│   │   └── repositories/
│   ├── payroll/
│   │   ├── actions/
│   │   ├── services/         # PeriodService, RecordService, CalcService
│   │   └── repositories/
│   ├── notifications/
│   │   ├── actions/
│   │   ├── services/         # NotificationService, EmailDispatcher
│   │   └── repositories/
│   └── audit/
│       ├── actions/
│       ├── services/         # AuditService (append-only)
│       └── repositories/
├── shared/
│   ├── auth/                 # Session middleware, context resolver
│   ├── permissions/          # PermissionService, role definitions
│   ├── storage/              # StorageAdapter interface + implementations
│   ├── email/                # EmailAdapter interface + implementations
│   ├── errors/               # Typed error hierarchy
│   ├── validation/           # Zod schemas, shared validators
│   └── types/                # Shared TypeScript types
└── infrastructure/
    ├── database/             # Prisma client, tenant-scoped base repo
    ├── jobs/                 # Background job runner
    └── config/               # Environment config loader
```

---

## 6. Frontend Boundaries

```
app/
├── (auth)/                   # Unauthenticated routes
│   ├── login/
│   ├── register/
│   ├── reset-password/
│   └── invite/[token]/
├── (app)/                    # Authenticated routes (layout with nav, org context)
│   ├── dashboard/            # Role-appropriate dashboard
│   ├── employees/            # Directory, profiles, create
│   ├── leave/                # Requests, approvals, calendar
│   ├── attendance/           # Clock widget, history, corrections
│   ├── onboarding/           # Templates, tasks
│   ├── documents/            # Upload, list, categories
│   ├── payroll/              # Periods, records, payslips
│   ├── notifications/        # Notification center
│   ├── audit/                # Audit log viewer
│   └── settings/             # Organisation and personal settings
├── api/                      # API routes (external integrations, webhooks)
│   └── v1/
└── components/               # Shared UI components (shadcn/ui based)
```

---

## 7. Authentication Architecture

- **Strategy:** Session-based with httpOnly secure cookies
- **Session store:** Database-backed (sessions table) for revocability
- **Cookie config:** httpOnly, Secure, SameSite=Lax, path=/
- **CSRF:** Double-submit cookie pattern for mutations
- **Password:** bcrypt with cost factor 12
- **Account lockout:** 5 failed attempts → 15-minute lock (BR-AUTH-004)
- **Session lifetime:** 24 hours idle, 7 days maximum
- **Org context:** Stored in session after org selection; validated on every request

---

## 8. Database Architecture

- **Engine:** PostgreSQL 15+
- **ORM:** Prisma with explicit tenant-scoped queries
- **Migrations:** Prisma Migrate (version-controlled, sequential)
- **Connection:** Single connection pool per application instance
- **Tenant isolation:** `organisation_id` column on all org-owned tables, enforced at repository layer
- **Audit table:** Separate DB role with REVOKE UPDATE/DELETE for immutability
- **Indexes:** Composite indexes on (organisation_id, ...) for all hot-path queries
- **Timestamps:** All stored as UTC (TIMESTAMP WITH TIME ZONE)
- **Monetary values:** Integer cents (no floating-point)

---

## 9. File Storage Architecture

- **Abstraction:** `StorageAdapter` interface with pluggable implementations
- **V1 default:** Local filesystem (Docker volume)
- **Production option:** S3-compatible (AWS S3, MinIO, Backblaze B2)
- **Path format:** `{organisation_id}/{entity_type}/{entity_id}/{filename}`
- **Access control:** Server-generated signed URLs with 5-minute expiry
- **Upload validation:** MIME type verification via magic bytes, 10MB max size
- **Cleanup:** Compensating transaction pattern — delete storage on DB write failure

---

## 10. Notification Architecture

- **In-app:** Synchronous insert into notifications table during request transaction
- **Email:** Asynchronous dispatch via email adapter (fire-and-forget from business logic)
- **Deduplication:** 5-minute window check by (recipient, event_type, event_id)
- **Delivery failure:** Logged but does not fail the originating operation
- **Channels:** In-app (V1), Email (V1), Push/SMS (future)
- **Templates:** Handlebars-based email templates with org branding

---

## 11. Background Jobs

- **Runner:** Simple Node.js cron-based scheduler (node-cron)
- **V1 jobs:**
  - Document expiry check (daily)
  - Missing clock-out detection (hourly)
  - Expired invitation cleanup (daily)
  - Soft-delete permanent removal after retention (daily)
- **Tenant context:** Jobs iterate per-organisation with isolated context
- **Failure handling:** Per-org failure does not block other orgs; errors logged
- **Scaling:** Single worker process in V1; queue-based in future

---

## 12. Audit System

- **Storage:** Append-only PostgreSQL table with restricted DB permissions
- **Write path:** `AuditService.record()` called within domain service transactions
- **Read path:** Paginated query with filters (actor, action, target, date range)
- **Immutability:** No UPDATE/DELETE permissions granted to application DB user
- **Retention:** Indefinite
- **Severity levels:** normal, high (permission changes, payroll), critical (ownership transfer, data deletion)
- **Captured fields:** actor_id, org_id, action, target_type, target_id, before_state, after_state, ip_address, metadata

---

## 13. Testing Architecture

| Level | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Business rules, calculations, state machines, validators |
| Integration | Vitest + test DB | Repository queries, tenant isolation, service orchestration |
| E2E | Playwright | Full browser workflows, permission enforcement, cross-tenant rejection |

- **Test database:** Separate PostgreSQL instance; truncated between test suites
- **Fixtures:** Factory functions for consistent test data creation
- **Cross-tenant tests:** Every repository/service tested for org isolation
- **CI:** Type check → Lint → Unit → Integration → E2E (fail-fast pipeline)

---

## 14. Deployment Architecture

```mermaid
graph TB
    subgraph "Docker Compose (V1)"
        App[Next.js Container<br/>Port 3000]
        DB[(PostgreSQL<br/>Port 5432)]
        Worker[Background Worker<br/>Same image, different entry]
        Vol[/Storage Volume/]
    end

    LB[Reverse Proxy / Caddy] --> App
    App --> DB
    Worker --> DB
    App --> Vol
    Worker --> Vol
```

- **V1 model:** Single Docker Compose stack
- **Containers:** Next.js app + PostgreSQL + background worker (optional)
- **Storage:** Docker volume for local file storage
- **Reverse proxy:** Caddy or nginx for TLS termination
- **Environment:** `.env` file with validated config at startup
- **Database migrations:** Run at container startup before accepting traffic
- **Health check:** `/api/health` endpoint verifying DB connectivity

---

## 15. Observability

- **Structured logging:** JSON format with request_id, org_id, user_id, action
- **Log levels:** error, warn, info, debug (configurable via env)
- **Request tracing:** Unique request ID propagated through middleware → services → repositories
- **Metrics (future):** Prometheus-compatible endpoint for request latency, error rate, queue depth
- **Alerting (future):** Error rate thresholds, failed job count, missing clock-out accumulation
- **Health endpoint:** `/api/health` returns DB connectivity and basic app status

---

## Architecture Principles

1. **Modular monolith** — Clear module boundaries without network overhead of microservices
2. **Tenant-first** — Every query, cache key, and file path includes organisation context
3. **Secure by default** — Server-side permission checks on every mutation and sensitive read
4. **Audit everything** — All state-changing operations recorded immutably
5. **Fail safe** — Notification failures don't break business operations
6. **Single source of truth** — Session-derived org context, never client-supplied
7. **Explicit over implicit** — Permission keys, not role-name string comparisons
8. **Testable** — Every layer independently testable with clear dependency boundaries
