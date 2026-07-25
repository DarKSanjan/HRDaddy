/**
 * HR Daddy Demo Seed - Notifications and Audit logs.
 */
import { PrismaClient } from '@prisma/client'

export async function seedNotifications(
  db: PrismaClient,
  orgId: string,
  userIdMap: Map<string, string>
) {
  // Check if already seeded
  const existingCount = await db.notification.count({ where: { orgId } })
  if (existingCount > 0) return

  const avaUserId = userIdMap.get('ava.lim@northstarstudios.sg')!
  const rachelUserId = userIdMap.get('rachel.tan@northstarstudios.sg')!
  const danielUserId = userIdMap.get('daniel.chen@northstarstudios.sg')!

  const notifications = [
    {
      userId: avaUserId,
      title: 'Payroll Published',
      message: 'June 2026 payroll has been published. 12 payslips generated.',
      link: '/northstar-studios/payroll',
    },
    {
      userId: rachelUserId,
      title: 'Document Expiring',
      message: "Jun Nakamura's work permit expires in 10 days.",
      link: '/northstar-studios/documents',
    },
    {
      userId: danielUserId,
      title: 'Leave Request',
      message: 'Wei Zhang has requested 5 days of Annual Leave (Aug 18-22).',
      link: '/northstar-studios/leave/approvals',
    },
    {
      userId: avaUserId,
      title: 'Overdue Onboarding Task',
      message: "Mei Lin has 5 overdue onboarding tasks.",
      link: '/northstar-studios/onboarding',
    },
    {
      userId: rachelUserId,
      title: 'New Employee Added',
      message: 'Aiden Teo has been added to Northstar Studios.',
      link: '/northstar-studios/employees',
      isRead: true,
    },
  ]

  for (const n of notifications) {
    await db.notification.create({
      data: {
        orgId,
        userId: n.userId,
        title: n.title,
        message: n.message,
        link: n.link,
        isRead: n.isRead ?? false,
      },
    })
  }
}

export async function seedAuditLog(
  db: PrismaClient,
  orgId: string,
  userIdMap: Map<string, string>,
  employeeIdMap: Map<string, string>
) {
  // Check if already seeded
  const existingCount = await db.auditLog.count({ where: { orgId } })
  if (existingCount > 0) return

  const avaUserId = userIdMap.get('ava.lim@northstarstudios.sg')!
  const rachelUserId = userIdMap.get('rachel.tan@northstarstudios.sg')!
  const danielUserId = userIdMap.get('daniel.chen@northstarstudios.sg')!
  const aidenEmpId = employeeIdMap.get('aiden.teo@northstarstudios.sg')!

  const now = new Date()
  const events = [
    {
      actorId: avaUserId,
      action: 'payroll.published',
      targetType: 'PayrollPeriod',
      targetId: 'june-2026',
      createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      actorId: rachelUserId,
      action: 'employee.created',
      targetType: 'Employee',
      targetId: aidenEmpId,
      createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    },
    {
      actorId: rachelUserId,
      action: 'onboarding.assigned',
      targetType: 'EmployeeOnboarding',
      targetId: aidenEmpId,
      createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    },
    {
      actorId: danielUserId,
      action: 'leave.approved',
      targetType: 'LeaveRequest',
      targetId: 'marcus-annual',
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      actorId: avaUserId,
      action: 'module.enabled',
      targetType: 'OrganisationModule',
      targetId: 'payroll',
      createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
    },
    {
      actorId: avaUserId,
      action: 'employee.status_changed',
      targetType: 'Employee',
      targetId: aidenEmpId,
      metadata: JSON.stringify({ from: 'DRAFT', to: 'ACTIVE' }),
      createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    },
  ]

  for (const e of events) {
    await db.auditLog.create({
      data: {
        orgId,
        actorId: e.actorId,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
        createdAt: e.createdAt,
      },
    })
  }
}
