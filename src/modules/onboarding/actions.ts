'use server'

// Registration barrel side-effect import — this 'use server' file is its own
// module graph, separate from any page/layout. Without this, requirePermission()
// throws against an empty registry on a cold instance that hasn't rendered a
// page which imports the barrel yet -- this is what silently broke saves.
import '@/modules/register'

/**
 * Onboarding module server actions.
 * Every mutation:
 *   1. Resolves org from slug (never trusts client-provided orgId)
 *   2. Checks permission
 *   3. Validates input with Zod
 *   4. Performs mutation via dbAs (RLS-scoped)
 *   5. Writes audit entry
 *   6. Revalidates cache
 */
import { revalidatePath } from 'next/cache'
import { getOrgContext, requirePermission } from '@/core/auth'
import { dbAs } from '@/core/db'
import { writeAudit } from '@/core/audit'
import { emit } from '@/core/events'
import { getNotificationAdapter } from '@/core/notifications'
import { getOrgSettings, getEmployeeIdForUser } from '@/core/employees'
import { hasPermission } from '@/core/permissions'
import { getHolidaysForRange } from '@/core/calendar/holidays-sg'
import {
  calculateWorkingDayDueDate,
  resolveOnboardingAssignee,
} from '@/core/onboarding'
import {
  createTemplateSchema,
  updateTemplateSchema,
  assignOnboardingSchema,
  cancelOnboardingSchema,
  completeTaskSchema,
  waiveTaskSchema,
  reopenTaskSchema,
} from './schemas'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  data?: unknown
}

// ─────────────────────────────────────────────
// Template CRUD
// ─────────────────────────────────────────────

export async function createTemplate(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.template.manage')

  const parsed = createTemplateSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { name, description, tasks } = parsed.data

  const template = await dbAs(userId, async (tx) => {
    return tx.onboardingTemplate.create({
      data: {
        orgId: org.id,
        name,
        description: description || null,
        tasks: {
          create: tasks.map((t, idx) => ({
            title: t.title,
            description: t.description || null,
            assigneeType: t.assigneeType,
            dueInDays: t.dueInDays,
            sortOrder: t.sortOrder ?? idx,
          })),
        },
      },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.template.created',
    targetType: 'onboarding_template',
    targetId: template.id,
    after: { name, taskCount: tasks.length },
  })

  revalidatePath(`/${orgSlug}/settings/onboarding`)
  return { success: true, data: { id: template.id } }
}

export async function updateTemplate(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.template.manage')

  const parsed = updateTemplateSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] = issue.message
    }
    return { success: false, fieldErrors }
  }

  const { templateId, name, description, tasks } = parsed.data

  const existing = await dbAs(userId, async (tx) => {
    return tx.onboardingTemplate.findFirst({
      where: { id: templateId, orgId: org.id },
      select: { id: true, isArchived: true },
    })
  })

  if (!existing) return { success: false, error: 'Template not found' }
  if (existing.isArchived) return { success: false, error: 'Cannot edit an archived template' }

  await dbAs(userId, async (tx) => {
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null

    if (Object.keys(updateData).length > 0) {
      await tx.onboardingTemplate.update({
        where: { id: templateId },
        data: updateData,
      })
    }

    if (tasks) {
      await tx.onboardingTemplateTask.deleteMany({ where: { templateId } })
      for (const [idx, t] of tasks.entries()) {
        await tx.onboardingTemplateTask.create({
          data: {
            templateId,
            title: t.title,
            description: t.description || null,
            assigneeType: t.assigneeType,
            dueInDays: t.dueInDays,
            sortOrder: t.sortOrder ?? idx,
          },
        })
      }
    }
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.template.updated',
    targetType: 'onboarding_template',
    targetId: templateId,
    after: { name, taskCount: tasks?.length },
  })

  revalidatePath(`/${orgSlug}/settings/onboarding`)
  return { success: true }
}

export async function archiveTemplate(
  orgSlug: string,
  templateId: string
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.template.manage')

  const activeCount = await dbAs(userId, async (tx) => {
    return tx.employeeOnboarding.count({
      where: {
        templateId,
        orgId: org.id,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
    })
  })

  if (activeCount > 0) {
    return {
      success: false,
      error: `Cannot archive template with ${activeCount} active onboarding(s) in progress`,
    }
  }

  await dbAs(userId, async (tx) => {
    await tx.onboardingTemplate.update({
      where: { id: templateId },
      data: { isArchived: true },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.template.archived',
    targetType: 'onboarding_template',
    targetId: templateId,
  })

  revalidatePath(`/${orgSlug}/settings/onboarding`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Assignment
// ─────────────────────────────────────────────

export async function assignOnboarding(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.assign')

  const parsed = assignOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { employeeId, templateId } = parsed.data

  const employee = await dbAs(userId, async (tx) => {
    return tx.employee.findFirst({
      where: { id: employeeId, orgId: org.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        startDate: true,
        managerId: true,
        employmentStatus: true,
      },
    })
  })

  if (!employee) return { success: false, error: 'Employee not found' }
  if (employee.employmentStatus === 'ARCHIVED' || employee.employmentStatus === 'DEACTIVATED') {
    return { success: false, error: 'Cannot assign onboarding to an inactive employee' }
  }

  const existingActive = await dbAs(userId, async (tx) => {
    return tx.employeeOnboarding.count({
      where: {
        employeeId,
        orgId: org.id,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
    })
  })

  if (existingActive > 0) {
    return { success: false, error: 'Employee already has an active onboarding process' }
  }

  const template = await dbAs(userId, async (tx) => {
    return tx.onboardingTemplate.findFirst({
      where: { id: templateId, orgId: org.id, isArchived: false },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    })
  })

  if (!template) return { success: false, error: 'Template not found' }

  const orgSettings = await getOrgSettings(org.id)
  const timezone = orgSettings?.timezone ?? 'Asia/Singapore'
  const workingDays = (orgSettings?.workingDays as number[]) ?? [1, 2, 3, 4, 5]

  const referenceDate = employee.startDate ?? new Date()
  const startYear = referenceDate.getFullYear()
  const holidays = getHolidaysForRange(startYear, startYear + 1)

  const onboarding = await dbAs(userId, async (tx) => {
    const ob = await tx.employeeOnboarding.create({
      data: {
        orgId: org.id,
        employeeId,
        templateId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    for (const task of template.tasks) {
      const dueDate = calculateWorkingDayDueDate(
        referenceDate,
        task.dueInDays,
        timezone,
        workingDays,
        holidays
      )
      const assigneeId = await resolveOnboardingAssignee(
        org.id,
        employeeId,
        employee.managerId,
        task.assigneeType
      )

      await tx.employeeOnboardingTask.create({
        data: {
          onboardingId: ob.id,
          orgId: org.id,
          title: task.title,
          description: task.description,
          assigneeType: task.assigneeType,
          assigneeId,
          dueDate,
          status: 'PENDING',
        },
      })
    }

    return ob
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.assigned',
    targetType: 'employee_onboarding',
    targetId: onboarding.id,
    after: {
      employeeId,
      templateId,
      templateName: template.name,
      taskCount: template.tasks.length,
    },
  })

  const notifications = getNotificationAdapter()
  await notifications.send({
    orgId: org.id,
    userId: employee.id,
    title: 'Onboarding assigned',
    message: `You have been assigned the "${template.name}" onboarding checklist.`,
    link: `/${orgSlug}/onboarding`,
  })

  await emit('onboarding.assigned', { onboardingId: onboarding.id, employeeId }, { orgId: org.id, userId })

  revalidatePath(`/${orgSlug}/onboarding`)
  return { success: true, data: { id: onboarding.id } }
}

// ─────────────────────────────────────────────
// Cancel onboarding
// ─────────────────────────────────────────────

export async function cancelOnboarding(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.assign')

  const parsed = cancelOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { onboardingId, reason } = parsed.data

  const onboarding = await dbAs(userId, async (tx) => {
    return tx.employeeOnboarding.findFirst({
      where: { id: onboardingId, orgId: org.id },
      select: { id: true, status: true, employeeId: true },
    })
  })

  if (!onboarding) return { success: false, error: 'Onboarding not found' }
  if (onboarding.status === 'COMPLETED' || onboarding.status === 'CANCELLED') {
    return { success: false, error: 'Onboarding is already completed or cancelled' }
  }

  await dbAs(userId, async (tx) => {
    await tx.employeeOnboardingTask.updateMany({
      where: {
        onboardingId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: { status: 'WAIVED', notes: `Cancelled: ${reason}` },
    })

    await tx.employeeOnboarding.update({
      where: { id: onboardingId },
      data: { status: 'CANCELLED' },
    })
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.cancelled',
    targetType: 'employee_onboarding',
    targetId: onboardingId,
    metadata: { reason },
  })

  await emit('onboarding.cancelled', { onboardingId }, { orgId: org.id, userId })

  revalidatePath(`/${orgSlug}/onboarding`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Task actions
// ─────────────────────────────────────────────

export async function completeTask(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.complete_task')

  const parsed = completeTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { taskId, notes } = parsed.data

  const task = await dbAs(userId, async (tx) => {
    return tx.employeeOnboardingTask.findFirst({
      where: { id: taskId, orgId: org.id },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        onboardingId: true,
        onboarding: { select: { status: true } },
      },
    })
  })

  // onboarding.complete_task is granted to every role so employees can work
  // their own checklist — without this, that permission alone would let any
  // employee complete anyone else's task by taskId. HR/Owner (onboarding.view_all)
  // retain full oversight, matching what they already see on the admin page.
  if (!hasPermission(membership.role, enabledModules, 'onboarding.view_all')) {
    const callerEmployeeId = await getEmployeeIdForUser(org.id, userId)
    if (!task || task.assigneeId !== callerEmployeeId) {
      return { success: false, error: 'You can only complete tasks assigned to you.' }
    }
  }

  if (!task) return { success: false, error: 'Task not found' }
  if (task.status === 'COMPLETED') return { success: false, error: 'Task is already completed' }
  if (task.status === 'WAIVED') return { success: false, error: 'Task has been waived' }
  if (task.onboarding.status === 'CANCELLED') {
    return { success: false, error: 'Cannot complete a task on a cancelled onboarding' }
  }

  await dbAs(userId, async (tx) => {
    await tx.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes || null,
      },
    })

    const remaining = await tx.employeeOnboardingTask.count({
      where: {
        onboardingId: task.onboardingId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    })

    if (remaining === 0) {
      await tx.employeeOnboarding.update({
        where: { id: task.onboardingId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.task.completed',
    targetType: 'onboarding_task',
    targetId: taskId,
    metadata: { notes },
  })

  revalidatePath(`/${orgSlug}/onboarding`)
  return { success: true }
}

export async function waiveTask(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.template.manage')

  const parsed = waiveTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { taskId, reason } = parsed.data

  const task = await dbAs(userId, async (tx) => {
    return tx.employeeOnboardingTask.findFirst({
      where: { id: taskId, orgId: org.id },
      select: {
        id: true,
        status: true,
        onboardingId: true,
        onboarding: { select: { status: true } },
      },
    })
  })

  if (!task) return { success: false, error: 'Task not found' }
  if (task.status === 'COMPLETED' || task.status === 'WAIVED') {
    return { success: false, error: 'Task is already completed or waived' }
  }

  await dbAs(userId, async (tx) => {
    await tx.employeeOnboardingTask.update({
      where: { id: taskId },
      data: { status: 'WAIVED', notes: `Waived: ${reason}` },
    })

    const remaining = await tx.employeeOnboardingTask.count({
      where: {
        onboardingId: task.onboardingId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    })

    if (remaining === 0) {
      await tx.employeeOnboarding.update({
        where: { id: task.onboardingId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.task.waived',
    targetType: 'onboarding_task',
    targetId: taskId,
    metadata: { reason },
  })

  revalidatePath(`/${orgSlug}/onboarding`)
  return { success: true }
}

// ─────────────────────────────────────────────
// Query wrappers (server actions for client use)
// ─────────────────────────────────────────────

export async function fetchOnboardingDetail(
  orgSlug: string,
  onboardingId: string
) {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.view_all')
  const { getOnboardingDetail } = await import('./queries')
  return getOnboardingDetail(userId, org.id, onboardingId)
}

export async function fetchTemplateDetail(
  orgSlug: string,
  templateId: string
) {
  const { org } = await getOrgContext(orgSlug)
  const { userId } = await requirePermission(org.id, 'onboarding.template.view')
  const { getTemplateDetail } = await import('./queries')
  return getTemplateDetail(userId, org.id, templateId)
}

export async function reopenTask(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const { org, membership, enabledModules } = await getOrgContext(orgSlug)
  // Same tier as completeTask, not onboarding.template.manage — reopening your
  // own task is the natural undo of completing it, and the M6 spec lists
  // "complete, reopen, waive" together as part of the self-service checklist.
  // The ownership check below is what actually keeps this safe.
  const { userId } = await requirePermission(org.id, 'onboarding.complete_task')

  const parsed = reopenTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { taskId } = parsed.data

  const task = await dbAs(userId, async (tx) => {
    return tx.employeeOnboardingTask.findFirst({
      where: { id: taskId, orgId: org.id },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        onboardingId: true,
        onboarding: { select: { status: true } },
      },
    })
  })

  if (!hasPermission(membership.role, enabledModules, 'onboarding.view_all')) {
    const callerEmployeeId = await getEmployeeIdForUser(org.id, userId)
    if (!task || task.assigneeId !== callerEmployeeId) {
      return { success: false, error: 'You can only reopen tasks assigned to you.' }
    }
  }

  if (!task) return { success: false, error: 'Task not found' }
  if (task.status === 'PENDING') return { success: false, error: 'Task is already pending' }
  if (task.onboarding.status === 'CANCELLED') {
    return { success: false, error: 'Cannot reopen a task on a cancelled onboarding' }
  }

  await dbAs(userId, async (tx) => {
    await tx.employeeOnboardingTask.update({
      where: { id: taskId },
      data: { status: 'PENDING', completedAt: null, notes: null },
    })

    if (task.onboarding.status === 'COMPLETED') {
      await tx.employeeOnboarding.update({
        where: { id: task.onboardingId },
        data: { status: 'IN_PROGRESS', completedAt: null },
      })
    }
  })

  await writeAudit({
    orgId: org.id,
    actorId: userId,
    action: 'onboarding.task.reopened',
    targetType: 'onboarding_task',
    targetId: taskId,
  })

  revalidatePath(`/${orgSlug}/onboarding`)
  return { success: true }
}
