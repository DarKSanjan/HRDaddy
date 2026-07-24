# Use-Case Diagrams

This document presents Mermaid use-case style diagrams (using `flowchart LR`) for all V1 modules. Actors appear on the left, the system boundary in the middle, and use cases are grouped by functional area.

---

## 1. Authentication & Organisation Setup

```mermaid
flowchart LR
    %% Actors
    User((Unregistered User))
    Auth((Authenticated User))
    Owner((Owner))
    Email[[Email Service]]

    %% System Boundary
    subgraph "Authentication & Organisation Setup"
        AUTH001[Register Account]
        AUTH002[Verify Email]
        AUTH003[Sign In]
        AUTH004[Sign Out]
        AUTH005[Reset Password]
        AUTH006[Accept Invitation]
        AUTH007[Switch Organisation]
        ORG001[Create Organisation]
        ORG002[Update Organisation Details]
        ORG003[Configure Timezone]
    end

    %% Relationships
    User --> AUTH001
    User --> AUTH002
    User --> AUTH003
    User --> AUTH005
    User --> AUTH006
    Auth --> AUTH004
    Auth --> AUTH007
    Auth --> ORG001
    Owner --> ORG002
    Owner --> ORG003
    AUTH001 --> Email
    AUTH005 --> Email
    AUTH006 --> Email
```

---

## 2. Employee Management

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Mgr((Manager))
    Emp((Employee))

    %% System Boundary
    subgraph "Employee Management"
        EMP001[Add Employee]
        EMP002[Invite Employee]
        EMP003[View Employee Directory]
        EMP004[Search Employees]
        EMP006[View Employee Profile]
        EMP007[Edit Personal Details]
        EMP008[Edit Employment Details]
        EMP011[Assign Manager]
        EMP012[Change Employment Status]
        EMP013[Deactivate Employee]
        EMP014[Reactivate Employee]
        EMP015[Archive Employee]
    end

    %% Relationships
    Owner --> EMP001
    Owner --> EMP002
    Owner --> EMP008
    Owner --> EMP011
    Owner --> EMP012
    Owner --> EMP013
    Owner --> EMP014
    Owner --> EMP015
    HR --> EMP001
    HR --> EMP002
    HR --> EMP007
    HR --> EMP008
    HR --> EMP011
    HR --> EMP012
    HR --> EMP013
    HR --> EMP014
    HR --> EMP015
    Mgr --> EMP003
    Mgr --> EMP004
    Mgr --> EMP006
    Emp --> EMP003
    Emp --> EMP004
    Emp --> EMP006
    Emp --> EMP007
```

---

## 3. Leave Management

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Mgr((Manager))
    Emp((Employee))
    Sys[[System]]

    %% System Boundary
    subgraph "Leave Management"
        LEAVE001[Create Leave Type]
        LEAVE002[Configure Leave Policy]
        LEAVE004[View Leave Balance]
        LEAVE005[Submit Leave Request]
        LEAVE006[Request Half-Day Leave]
        LEAVE010[Review Leave Request]
        LEAVE011[Approve Leave Request]
        LEAVE012[Reject Leave Request]
        LEAVE013[Cancel Approved Leave]
        LEAVE014[Withdraw Pending Request]
        LEAVE015[HR Override Decision]
        LEAVE020[Handle Weekends & Holidays]
    end

    %% Relationships
    Owner --> LEAVE001
    Owner --> LEAVE002
    Owner --> LEAVE011
    Owner --> LEAVE012
    Owner --> LEAVE015
    HR --> LEAVE001
    HR --> LEAVE002
    HR --> LEAVE010
    HR --> LEAVE011
    HR --> LEAVE012
    HR --> LEAVE013
    HR --> LEAVE015
    Mgr --> LEAVE004
    Mgr --> LEAVE010
    Mgr --> LEAVE011
    Mgr --> LEAVE012
    Emp --> LEAVE004
    Emp --> LEAVE005
    Emp --> LEAVE006
    Emp --> LEAVE013
    Emp --> LEAVE014
    Sys --> LEAVE020
```

---

## 4. Attendance

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Emp((Employee))
    Sys[[System]]

    %% System Boundary
    subgraph "Attendance"
        ATT001[Clock In]
        ATT002[Clock Out]
        ATT003[View Current State]
        ATT004[View Attendance History]
        ATT005[View Monthly Summary]
        ATT006[Correct Attendance Record]
        ATT007[Manually Add Record]
        ATT008[Record Remote Attendance]
        ATT009[Handle Missing Clock-Out]
        ATT013[Handle Leave/Holiday Conflict]
        ATT014[Export Attendance Data]
    end

    %% Relationships
    Emp --> ATT001
    Emp --> ATT002
    Emp --> ATT003
    Emp --> ATT004
    Emp --> ATT005
    Emp --> ATT008
    Owner --> ATT006
    Owner --> ATT007
    Owner --> ATT014
    HR --> ATT004
    HR --> ATT005
    HR --> ATT006
    HR --> ATT007
    HR --> ATT014
    Sys --> ATT009
    Sys --> ATT013
```

---

## 5. Onboarding

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Mgr((Manager))
    Emp((Employee))
    Sys[[System]]

    %% System Boundary
    subgraph "Onboarding"
        ONB001[Create Onboarding Template]
        ONB002[Add Task to Template]
        ONB003[Edit Template]
        ONB005[Assign Onboarding to Employee]
        ONB006[View Onboarding Progress]
        ONB009[Complete Onboarding Task]
        ONB010[Reopen Completed Task]
        ONB011[View Employee Checklist]
        ONB012[Track Onboarding Completion]
        ONB013[Cancel Onboarding]
        ONB015[Manager View New Hire Tasks]
    end

    %% Relationships
    Owner --> ONB001
    Owner --> ONB002
    Owner --> ONB003
    Owner --> ONB005
    Owner --> ONB010
    Owner --> ONB013
    HR --> ONB001
    HR --> ONB002
    HR --> ONB003
    HR --> ONB005
    HR --> ONB006
    HR --> ONB009
    HR --> ONB010
    HR --> ONB013
    Mgr --> ONB009
    Mgr --> ONB015
    Emp --> ONB009
    Emp --> ONB011
    Sys --> ONB012
```

---

## 6. Documents

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Mgr((Manager))
    Emp((Employee))
    Sys[[System]]

    %% System Boundary
    subgraph "Document Management"
        DOC001[Create Document Category]
        DOC002[Upload Document]
        DOC003[View Employee Documents]
        DOC004[Download Document]
        DOC005[Replace Document Version]
        DOC006[Archive Document]
        DOC007[Delete Document]
        DOC008[Control Document Visibility]
        DOC009[Track Document Expiry]
        DOC010[View Expiring Documents Report]
        DOC011[Validate File Upload]
    end

    %% Relationships
    Owner --> DOC001
    Owner --> DOC002
    Owner --> DOC003
    Owner --> DOC004
    Owner --> DOC005
    Owner --> DOC006
    Owner --> DOC007
    HR --> DOC001
    HR --> DOC002
    HR --> DOC003
    HR --> DOC004
    HR --> DOC005
    HR --> DOC006
    HR --> DOC010
    Mgr --> DOC003
    Mgr --> DOC004
    Emp --> DOC002
    Emp --> DOC003
    Emp --> DOC004
    Sys --> DOC008
    Sys --> DOC009
    Sys --> DOC011
```

---

## 7. Payroll

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Emp((Employee))
    Sys[[System]]

    %% System Boundary
    subgraph "Payroll"
        PAY001[Create Payroll Period]
        PAY002[Generate Payroll Records]
        PAY003[Add Earnings Line]
        PAY004[Add Deduction Line]
        PAY005[Calculate Net Pay]
        PAY007[Review Payroll Period]
        PAY009[Approve Payroll Period]
        PAY010[Publish Payslips]
        PAY011[View Own Payslip]
        PAY012[Download Payslip PDF]
        PAY013[Reopen Published Payroll]
    end

    %% Relationships
    Owner --> PAY001
    Owner --> PAY002
    Owner --> PAY003
    Owner --> PAY004
    Owner --> PAY007
    Owner --> PAY009
    Owner --> PAY010
    Owner --> PAY013
    HR --> PAY001
    HR --> PAY002
    HR --> PAY003
    HR --> PAY004
    HR --> PAY007
    HR --> PAY010
    Emp --> PAY011
    Emp --> PAY012
    Sys --> PAY005
```

---

## 8. Notifications & Audit

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))
    Owner((Owner))
    Auth((Authenticated User))
    Sys[[System]]

    %% System Boundary
    subgraph "Notifications & Audit"
        NOTIF001[Create In-App Notification]
        NOTIF002[Mark Notification as Read]
        NOTIF003[View Notification List]
        NOTIF004[Send Email Notification]
        NOTIF006[Route Notification by Role]
        AUDIT001[Record Audit Event]
        AUDIT002[View Audit Log]
        AUDIT003[Filter Audit Events]
        AUDIT004[Export Audit Log]
        AUDIT005[Track Employee Data Changes]
        AUDIT009[Ensure Audit Immutability]
    end

    %% Relationships
    Auth --> NOTIF002
    Auth --> NOTIF003
    Owner --> AUDIT002
    Owner --> AUDIT003
    Owner --> AUDIT004
    HR --> AUDIT002
    HR --> AUDIT003
    Sys --> NOTIF001
    Sys --> NOTIF004
    Sys --> NOTIF006
    Sys --> AUDIT001
    Sys --> AUDIT005
    Sys --> AUDIT009
```

---

## 9. Employee Self-Service

```mermaid
flowchart LR
    %% Actors
    Emp((Employee))

    %% System Boundary
    subgraph "Employee Self-Service"
        SS01[View Own Profile]
        SS02[Edit Personal Details]
        SS03[View Leave Balance]
        SS04[Submit Leave Request]
        SS05[Cancel/Withdraw Leave]
        SS06[Clock In / Clock Out]
        SS07[View Attendance History]
        SS08[View Onboarding Checklist]
        SS09[Complete Onboarding Task]
        SS10[View Own Documents]
        SS11[Upload Own Document]
        SS12[View Payslip]
    end

    %% Relationships
    Emp --> SS01
    Emp --> SS02
    Emp --> SS03
    Emp --> SS04
    Emp --> SS05
    Emp --> SS06
    Emp --> SS07
    Emp --> SS08
    Emp --> SS09
    Emp --> SS10
    Emp --> SS11
    Emp --> SS12
```

---

## 10. Manager Workflows

```mermaid
flowchart LR
    %% Actors
    Mgr((Manager))

    %% System Boundary
    subgraph "Manager Workflows"
        MW01[Review Leave Requests]
        MW02[Approve/Reject Leave]
        MW03[View Team Calendar]
        MW04[View Team Attendance]
        MW05[View Team Leave Balances]
        MW06[View Direct Reports]
        MW07[Complete Onboarding Tasks]
        MW08[View New Hire Progress]
        MW09[View Team Documents]
        MW10[View Employee Profiles]
    end

    %% Relationships
    Mgr --> MW01
    Mgr --> MW02
    Mgr --> MW03
    Mgr --> MW04
    Mgr --> MW05
    Mgr --> MW06
    Mgr --> MW07
    Mgr --> MW08
    Mgr --> MW09
    Mgr --> MW10
```

---

## 11. HR Administrator Workflows

```mermaid
flowchart LR
    %% Actors
    HR((HR Admin))

    %% System Boundary
    subgraph "HR Administrator Workflows"
        HR01[Manage Employee Lifecycle]
        HR02[Configure Leave Policies]
        HR03[Manage Onboarding Templates]
        HR04[Correct Attendance Records]
        HR05[Manage Document Categories]
        HR06[Process Payroll]
        HR07[View Audit Logs]
        HR08[Manage Departments & Structure]
        HR09[Invite & Manage Members]
        HR10[View Expiring Documents]
        HR11[View Onboarding Dashboard]
        HR12[Override Leave Decisions]
    end

    %% Relationships
    HR --> HR01
    HR --> HR02
    HR --> HR03
    HR --> HR04
    HR --> HR05
    HR --> HR06
    HR --> HR07
    HR --> HR08
    HR --> HR09
    HR --> HR10
    HR --> HR11
    HR --> HR12
```

---

## Actor Legend

| Actor | Description |
|-------|-------------|
| Unregistered User | Person without an account attempting to register or accept invitation |
| Authenticated User | Any signed-in user regardless of role |
| Owner | Organisation owner with full administrative control |
| HR Admin | Human resources administrator managing day-to-day HR operations |
| Manager | Team lead with approval authority over direct reports |
| Employee | Standard employee using self-service features |
| System | Automated processes, scheduled jobs, and internal enforcement |
| Email Service | External email delivery supporting notifications and invitations |
