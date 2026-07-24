/**
 * Core onboarding service — functions that need dbAdmin access.
 * Located in src/core/ to satisfy the ESLint boundary rule.
 */
import { dbAdmin } from '@/core/db/admin'
import { getOrgSettings } from '@/core/employees'
import { toOrgDate, isWorkingDay } from '@/core/calendar'
import { getHolidaysForRange } from '@/core/calendar/holidays-sg'
import { addDays } from 'date-fns'
import { TZDate } from '@date-fns/tz'

/**
 * Recompute due dates for all incomplete tasks in active onboardings
 * for a given employee. Called when an employee's start date changes.
 */
export async function recomputeOnboardingDueDates(
  orgId: string,
  employeeId: string,
  newStartDate: Date
): Promise<void> {
  const orgSettings = await getOrgSettings(orgId)
  const timezone = orgSettings?.timezone ?? 'Asia/Singapore'
  const workingDays = (orgSettings?.workingDays as number[]) ?? [1, 2, 3, 4, 5]
  const startYear = newStartDate.getFullYear()
  const holidays = getHolidaysForRange(startYear, startYear + 1)

  // Get active onboardings for this employee
  const onboardings = await dbAdmin.employeeOnboarding.findMany({
    where: {
      employeeId,
      orgId,
      status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
    },
    include: {
      tasks: {
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      },
      template: {
        include: { tasks: true },
      },
    },
  })

  for (const onboarding of onboardings) {
    for (const task of onboarding.tasks) {
      // Find the original template task to get dueInDays
      const templateTask = onboarding.template.tasks.find(
        (tt) => tt.title === task.title && tt.assigneeType === task.assigneeType
      )
      if (!templateTask) continue

      const newDueDate = calculateWorkingDayDueDate(
        newStartDate,
        templateTask.dueInDays,
        timezone,
        workingDays,
        holidays
      )

      await dbAdmin.employeeOnboardingTask.update({
        where: { id: task.id },
        data: { dueDate: newDueDate },
      })
    }
  }
}

/**
 * Cancel active onboardings for an employee (e.g. on deactivation).
 */
export async function cancelOnboardingsForEmployee(
  orgId: string,
  employeeId: string,
  reason: string
): Promise<void> {
  const activeOnboardings = await dbAdmin.employeeOnboarding.findMany({
    where: {
      employeeId,
      orgId,
      status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
    },
    select: { id: true },
  })

  for (const ob of activeOnboardings) {
    await dbAdmin.employeeOnboardingTask.updateMany({
      where: {
        onboardingId: ob.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: { status: 'WAIVED', notes: `Cancelled: ${reason}` },
    })

    await dbAdmin.employeeOnboarding.update({
      where: { id: ob.id },
      data: { status: 'CANCELLED' },
    })
  }
}

/**
 * Resolve assignee for a task based on the assignee type.
 * EMPLOYEE = the onboarded employee themselves.
 * MANAGER = the employee's manager, falling back to an HR admin.
 * HR = an HR admin in the org.
 */
export async function resolveOnboardingAssignee(
  orgId: string,
  employeeId: string,
  managerId: string | null,
  assigneeType: 'EMPLOYEE' | 'MANAGER' | 'HR'
): Promise<string | null> {
  switch (assigneeType) {
    case 'EMPLOYEE':
      return employeeId
    case 'MANAGER': {
      if (managerId) return managerId
      // Fall back to HR admin
      const hrAdmin = await dbAdmin.organisationMembership.findFirst({
        where: {
          orgId,
          role: { in: ['HR_ADMIN', 'OWNER'] },
          isActive: true,
        },
        select: { userId: true },
      })
      if (hrAdmin) {
        const hrEmployee = await dbAdmin.employee.findFirst({
          where: { orgId, userId: hrAdmin.userId },
          select: { id: true },
        })
        return hrEmployee?.id ?? null
      }
      return null
    }
    case 'HR': {
      const hrMember = await dbAdmin.organisationMembership.findFirst({
        where: {
          orgId,
          role: { in: ['HR_ADMIN', 'OWNER'] },
          isActive: true,
        },
        select: { userId: true },
      })
      if (hrMember) {
        const hrEmp = await dbAdmin.employee.findFirst({
          where: { orgId, userId: hrMember.userId },
          select: { id: true },
        })
        return hrEmp?.id ?? null
      }
      return null
    }
    default:
      return null
  }
}

/**
 * Calculate a due date by advancing dueInDays working days from startDate.
 * Skips non-working days (weekends + public holidays).
 */
export function calculateWorkingDayDueDate(
  startDate: Date,
  dueInDays: number,
  timezone: string,
  workingDays: number[],
  holidays: { date: string; name: string }[]
): Date {
  if (dueInDays === 0) return startDate

  const settings = { timezone, workingDays }
  let current = toOrgDate(startDate, timezone)
  let counted = 0

  while (counted < dueInDays) {
    current = new TZDate(
      addDays(current, 1).getTime(),
      timezone
    )
    if (isWorkingDay(current, settings, holidays)) {
      counted++
    }
  }

  return current
}
