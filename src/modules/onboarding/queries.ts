/**
 * Onboarding queries — data fetching with permission scoping.
 */
import 'server-only'
import { dbAs } from '@/core/db'
import type { OnboardingStatus, OnboardingTaskStatus, Prisma } from '@prisma/client'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface OnboardingTemplateListItem {
  id: string
  name: string
  description: string | null
  isArchived: boolean
  createdAt: Date
  _count: { tasks: number }
}

export interface OnboardingTemplateDetail {
  id: string
  name: string
  description: string | null
  isArchived: boolean
  createdAt: Date
  tasks: {
    id: string
    title: string
    description: string | null
    assigneeType: string
    dueInDays: number
    sortOrder: number
  }[]
}

export interface EmployeeOnboardingListItem {
  id: string
  status: OnboardingStatus
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  employee: { id: string; firstName: string; lastName: string }
  template: { id: string; name: string }
  _count: { tasks: number }
  completedTaskCount: number
  overdueTaskCount: number
}

export interface OnboardingTaskItem {
  id: string
  title: string
  description: string | null
  assigneeType: string
  assigneeId: string | null
  dueDate: Date | null
  status: OnboardingTaskStatus
  completedAt: Date | null
  notes: string | null
}

// ─────────────────────────────────────────────
// Template queries
// ─────────────────────────────────────────────

export async function listTemplates(
  userId: string,
  orgId: string,
  includeArchived = false
): Promise<OnboardingTemplateListItem[]> {
  return dbAs(userId, async (tx) => {
    return tx.onboardingTemplate.findMany({
      where: {
        orgId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isArchived: true,
        createdAt: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { name: 'asc' },
    })
  }) as unknown as OnboardingTemplateListItem[]
}

export async function getTemplateDetail(
  userId: string,
  orgId: string,
  templateId: string
): Promise<OnboardingTemplateDetail | null> {
  return dbAs(userId, async (tx) => {
    return tx.onboardingTemplate.findFirst({
      where: { id: templateId, orgId },
      select: {
        id: true,
        name: true,
        description: true,
        isArchived: true,
        createdAt: true,
        tasks: {
          select: {
            id: true,
            title: true,
            description: true,
            assigneeType: true,
            dueInDays: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
  }) as unknown as OnboardingTemplateDetail | null
}

// ─────────────────────────────────────────────
// Employee onboarding queries
// ─────────────────────────────────────────────

export async function listOnboardings(
  userId: string,
  orgId: string,
  params: { status?: OnboardingStatus; page?: number; pageSize?: number }
): Promise<{ onboardings: EmployeeOnboardingListItem[]; total: number }> {
  const { status, page = 1, pageSize = 20 } = params

  return dbAs(userId, async (tx) => {
    const where: Prisma.EmployeeOnboardingWhereInput = {
      orgId,
      ...(status ? { status } : {}),
    }

    const [onboardings, total] = await Promise.all([
      tx.employeeOnboarding.findMany({
        where,
        select: {
          id: true,
          status: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          template: { select: { id: true, name: true } },
          _count: { select: { tasks: true } },
          tasks: {
            select: { status: true, dueDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.employeeOnboarding.count({ where }),
    ])

    const now = new Date()
    const mapped = onboardings.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
      employee: o.employee,
      template: o.template,
      _count: o._count,
      completedTaskCount: o.tasks.filter(
        (t) => t.status === 'COMPLETED' || t.status === 'WAIVED'
      ).length,
      overdueTaskCount: o.tasks.filter(
        (t) =>
          t.status === 'PENDING' &&
          t.dueDate !== null &&
          t.dueDate < now
      ).length,
    }))

    return { onboardings: mapped, total }
  })
}

export async function getOnboardingDetail(
  userId: string,
  orgId: string,
  onboardingId: string
): Promise<{
  id: string
  status: OnboardingStatus
  employee: { id: string; firstName: string; lastName: string }
  template: { id: string; name: string }
  tasks: OnboardingTaskItem[]
} | null> {
  return dbAs(userId, async (tx) => {
    const onboarding = await tx.employeeOnboarding.findFirst({
      where: { id: onboardingId, orgId },
      select: {
        id: true,
        status: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        template: { select: { id: true, name: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            description: true,
            assigneeType: true,
            assigneeId: true,
            dueDate: true,
            status: true,
            completedAt: true,
            notes: true,
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    })
    return onboarding as typeof onboarding | null
  })
}

/**
 * Get tasks assigned to a specific user (either as onboarded employee or assignee).
 */
export async function getMyOnboardingTasks(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<{
  asEmployee: OnboardingTaskItem[]
  asAssignee: OnboardingTaskItem[]
}> {
  return dbAs(userId, async (tx) => {
    const [asEmployee, asAssignee] = await Promise.all([
      tx.employeeOnboardingTask.findMany({
        where: {
          orgId,
          onboarding: { employeeId },
          assigneeType: 'EMPLOYEE',
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        select: {
          id: true,
          title: true,
          description: true,
          assigneeType: true,
          assigneeId: true,
          dueDate: true,
          status: true,
          completedAt: true,
          notes: true,
        },
        orderBy: { dueDate: 'asc' },
      }),
      tx.employeeOnboardingTask.findMany({
        where: {
          orgId,
          assigneeId: employeeId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        select: {
          id: true,
          title: true,
          description: true,
          assigneeType: true,
          assigneeId: true,
          dueDate: true,
          status: true,
          completedAt: true,
          notes: true,
        },
        orderBy: { dueDate: 'asc' },
      }),
    ])

    return {
      asEmployee: asEmployee as unknown as OnboardingTaskItem[],
      asAssignee: asAssignee as unknown as OnboardingTaskItem[],
    }
  })
}

/**
 * Check if an employee has an active onboarding.
 */
export async function hasActiveOnboarding(
  userId: string,
  orgId: string,
  employeeId: string
): Promise<boolean> {
  return dbAs(userId, async (tx) => {
    const count = await tx.employeeOnboarding.count({
      where: {
        orgId,
        employeeId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
    })
    return count > 0
  })
}
