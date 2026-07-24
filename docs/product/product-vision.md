# Product Vision

## Vision Statement

To democratize professional HR management by providing small and medium businesses with an open-source, self-hostable platform that rivals enterprise HR systems in capability while remaining affordable, customizable, and easy to operate.

## Mission

Build the most accessible, secure, and extensible HR platform for companies with 5-500 employees, eliminating the need to choose between expensive enterprise software and inadequate spreadsheet-based processes.

## Target Customers

- Small businesses (5-50 employees) currently using spreadsheets or basic tools
- Medium businesses (50-500 employees) frustrated with expensive/rigid HR platforms
- Tech-savvy companies wanting self-hosted control over employee data
- Companies with unique HR workflows that commercial platforms cannot accommodate
- Startups scaling past the point where informal HR processes work

## Primary User Personas

### 1. Company Owner (Sarah - Startup Founder)

- **Age:** 35, **Company size:** 25 employees
- **Goals:** Quick company setup, workforce visibility, confidence in data security
- **Pain points:** Current tools too expensive, can't customize policies, no single source of truth
- **Tech comfort:** Medium - uses SaaS daily but isn't a developer

### 2. HR Administrator (Priya - HR Manager)

- **Age:** 30, **Company size:** 80 employees
- **Goals:** Efficient record-keeping, streamlined onboarding, leave/attendance admin, compliance
- **Pain points:** Manual processes, scattered information, audit anxiety, repetitive data entry
- **Tech comfort:** High for business software, expects modern UX

### 3. Manager (David - Engineering Lead)

- **Age:** 40, **Team size:** 12 direct reports
- **Goals:** Quick leave approvals, team visibility, onboarding new hires, minimal admin overhead
- **Pain points:** Too many tools, unclear who's in/out, delayed approvals block team
- **Tech comfort:** High

### 4. Employee (Alex - Software Developer)

- **Age:** 28
- **Goals:** Simple self-service for leave, attendance, documents, payslips
- **Pain points:** Can't find own information, unclear leave balance, no mobile access
- **Tech comfort:** Very high

### 5. System Administrator (Future - Platform Ops)

- **Age:** N/A (future role for managed hosting)
- **Goals:** Platform maintenance, tenant support, operational visibility
- **Pain points:** N/A for V1
- **Note:** Distinguished from organisation roles; this is a platform-level role for future hosted offering

## Main Customer Problems

1. Existing HR tools are prohibitively expensive for SMBs ($8-25/employee/month)
2. Commercial platforms force rigid workflows that don't match company culture
3. Employee data is scattered across spreadsheets, email, and disconnected tools
4. No audit trail for compliance-sensitive decisions
5. Self-hosted options are either ancient, unmaintained, or enterprise-complex
6. Onboarding is ad-hoc with no tracking or accountability
7. Leave/attendance management is manual and error-prone

## Product Principles

1. **Clarity over cleverness** - Every feature must be immediately understandable
2. **Secure by default** - Tenant isolation, permission enforcement, and audit logging are non-negotiable
3. **Complete workflows** - No half-built features; every flow handles success, failure, and edge cases
4. **Modular independence** - Modules can be enabled/disabled without breaking core functionality
5. **API-first internally** - All functionality accessible through well-defined contracts
6. **Progressive disclosure** - Simple for basic use, powerful for advanced needs
7. **Self-hostable always** - No feature should require proprietary infrastructure

## Business Assumptions

- SMBs will prefer open-source + self-hosted if setup is straightforward
- A Docker Compose deployment is acceptable complexity for target market
- PostgreSQL is widely available and understood
- Companies with 5-500 employees have similar core HR needs
- V1 does not require real payroll integration (records only)
- Email notifications are sufficient for V1 (no SMS/push)

## V1 Scope

### Included:

- Organisation creation and configuration
- Role-based access (Owner, HR Admin, Manager, Employee)
- Employee lifecycle management
- Department/job title/location structure
- Reporting relationships
- Leave management (types, policies, balances, requests, approvals)
- Attendance tracking (clock in/out, history, corrections)
- Onboarding (templates, task assignment, tracking)
- Document management (upload, categorize, permissions, expiry)
- Payroll records (periods, line items, payslips - NOT actual payroll processing)
- Notifications (in-app)
- Audit logging
- Employee self-service portal
- Manager team workflows
- HR admin dashboards
- Multi-tenant data isolation
- Seed data for demonstration

### Explicit Non-Goals (V1):

- Actual payroll processing/calculation with tax rules
- External payroll provider integration
- Recruitment/applicant tracking
- Performance reviews
- Training/learning management
- Benefits administration
- Time tracking (project-based)
- Shift scheduling
- Multi-language support
- White-labeling
- Mobile native apps
- SSO/SAML integration
- Workflow builder/custom forms
- Reporting builder
- Data import/export wizards
- Platform admin console (multi-tenant management)

## Success Criteria

1. A reviewer can run the project and complete all core workflows end-to-end
2. Cross-tenant data isolation is provably enforced
3. All CRUD operations enforce role-based permissions server-side
4. Audit trail captures all sensitive operations
5. The application is responsive (desktop, tablet, mobile)
6. Production build passes type checking and linting
7. Critical paths have automated test coverage
8. Documentation is sufficient for another team to maintain/extend

## Main Risks

1. **Scope creep** - HR is a broad domain; V1 must be disciplined
2. **Permission complexity** - Role/scope combinations can explode; keep it manageable
3. **Multi-tenancy bugs** - Data leakage between organisations is unacceptable
4. **Payroll sensitivity** - Even record-only payroll has high accuracy expectations
5. **State machine complexity** - Multiple lifecycle models intersecting (leave + employee + attendance)
6. **Performance at scale** - Dashboard queries with large employee counts

## Long-term Extensibility Goals

- Plugin/module system for custom HR workflows
- Marketplace for community modules
- Payroll provider integrations (Xero, QuickBooks, Gusto)
- Communication integrations (Slack, Teams, Email)
- SSO/SAML for enterprise customers
- Advanced analytics and reporting
- Mobile applications
- Managed hosting offering with billing
- Custom form builder
- Workflow automation engine
