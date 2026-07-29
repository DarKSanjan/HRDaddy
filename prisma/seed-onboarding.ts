/**
 * HR Daddy Demo Seed - Onboarding data.
 * Creates template, one completed, one in-progress, one with overdue tasks.
 */
import { PrismaClient } from '@prisma/client'

export async function seedOnboarding(
  db: PrismaClient,
  orgId: string,
  employeeIdMap: Map<string, string>
) {
  // Check if already seeded
  const existing = await db.onboardingTemplate.findFirst({ where: { orgId } })
  if (existing) return

  // Create template
  const template = await db.onboardingTemplate.create({
    data: {
      orgId,
      name: 'New Hire Onboarding',
      description: 'Standard onboarding checklist for all new employees',
    },
  })

  // Template tasks
  const tasks = [
    { title: 'Complete personal information', assigneeType: 'EMPLOYEE' as const, dueInDays: 1, sortOrder: 1 },
    { title: 'Set up workstation', assigneeType: 'HR' as const, dueInDays: 1, sortOrder: 2 },
    { title: 'Review employee handbook', assigneeType: 'EMPLOYEE' as const, dueInDays: 3, sortOrder: 3 },
    { title: 'Meet with manager', assigneeType: 'MANAGER' as const, dueInDays: 3, sortOrder: 4 },
    { title: 'Complete safety training', assigneeType: 'EMPLOYEE' as const, dueInDays: 5, sortOrder: 5 },
    { title: 'Obtain building access card', assigneeType: 'HR' as const, dueInDays: 2, sortOrder: 6 },
    { title: '30-day check-in', assigneeType: 'MANAGER' as const, dueInDays: 30, sortOrder: 7 },
  ]

  for (const t of tasks) {
    await db.onboardingTemplateTask.create({
      data: { templateId: template.id, ...t },
    })
  }

  const aidenId = employeeIdMap.get('aiden.teo@northstarstudios.sg')!
  const meiId = employeeIdMap.get('mei.lin@northstarstudios.sg')!
  const kevinId = employeeIdMap.get('kevin.ng@northstarstudios.sg')!
  const hrAdminId = employeeIdMap.get('rachel.tan@northstarstudios.sg')!

  /**
   * Mirrors resolveOnboardingAssignee (src/core/onboarding) so seeded tasks
   * carry the same assigneeId a real assignOnboarding() call would produce —
   * without this, every seeded task has assigneeId: null, which fails the
   * assignee-ownership check on completeTask/reopenTask for every demo user.
   */
  function resolveAssigneeId(
    assigneeType: 'EMPLOYEE' | 'HR' | 'MANAGER',
    employeeId: string,
    managerEmail: string
  ): string {
    if (assigneeType === 'EMPLOYEE') return employeeId
    if (assigneeType === 'HR') return hrAdminId
    return employeeIdMap.get(managerEmail)!
  }

  // 1. Completed onboarding (Kevin - joined Feb 2023)
  const completedOb = await db.employeeOnboarding.create({
    data: {
      orgId,
      employeeId: kevinId,
      templateId: template.id,
      status: 'COMPLETED',
      startedAt: new Date('2023-02-01'),
      completedAt: new Date('2023-03-01'),
    },
  })
  for (const t of tasks) {
    await db.employeeOnboardingTask.create({
      data: {
        onboardingId: completedOb.id,
        orgId,
        title: t.title,
        assigneeType: t.assigneeType,
        assigneeId: resolveAssigneeId(t.assigneeType, kevinId, 'sarah.wong@northstarstudios.sg'),
        status: 'COMPLETED',
        completedAt: new Date('2023-02-15'),
        dueDate: new Date('2023-02-04'),
      },
    })
  }

  // 2. In-progress onboarding (Aiden - joined June 2026)
  const inProgressOb = await db.employeeOnboarding.create({
    data: {
      orgId,
      employeeId: aidenId,
      templateId: template.id,
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-06-15'),
    },
  })
  const aidenStartDate = new Date('2026-06-15')
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const dueDate = new Date(aidenStartDate)
    dueDate.setDate(dueDate.getDate() + t.dueInDays)

    await db.employeeOnboardingTask.create({
      data: {
        onboardingId: inProgressOb.id,
        orgId,
        title: t.title,
        assigneeType: t.assigneeType,
        assigneeId: resolveAssigneeId(t.assigneeType, aidenId, 'daniel.chen@northstarstudios.sg'),
        status: i < 4 ? 'COMPLETED' : 'PENDING', // First 4 done
        completedAt: i < 4 ? new Date('2026-06-20') : undefined,
        dueDate,
      },
    })
  }

  // 3. Onboarding with overdue tasks (Mei - we pretend she had a delayed onboarding)
  const overdueOb = await db.employeeOnboarding.create({
    data: {
      orgId,
      employeeId: meiId,
      templateId: template.id,
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-07-01'),
    },
  })
  const meiStartDate = new Date('2026-07-01')
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const dueDate = new Date(meiStartDate)
    dueDate.setDate(dueDate.getDate() + t.dueInDays)

    // Tasks due before today (July 25) with status PENDING = overdue
    await db.employeeOnboardingTask.create({
      data: {
        onboardingId: overdueOb.id,
        orgId,
        title: t.title,
        assigneeType: t.assigneeType,
        assigneeId: resolveAssigneeId(t.assigneeType, meiId, 'jun.nakamura@northstarstudios.sg'),
        status: i < 2 ? 'COMPLETED' : 'PENDING', // Only 2 completed, rest overdue
        completedAt: i < 2 ? new Date('2026-07-02') : undefined,
        dueDate,
      },
    })
  }
}
